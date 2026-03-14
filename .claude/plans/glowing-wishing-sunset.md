# Fix: Production SSE Stream Never Returns (2026.3.8 → 2026.3.12)

## Context

Between tags `2026.3.8` and `2026.3.12`, production streaming broke: POST `/llm/stream` returns 202 with `run_id` successfully, but the SSE stream from `GET /threads/{thread_id}/stream?run_id=X` never delivers data to the frontend. This only manifests in production (Redis 7, distributed workers via TaskIQ).

PR #862 (merged after `2026.3.12` into `2026.3.12.1`) fixed worker crash/reconnect issues (`ResilientRedisStreamBroker`, `_RunScopedStore`, `WorkerState` singleton). **Those fixes address worker-side failures but do NOT fix the root cause: a race condition between the frontend connecting and the worker writing its first event.**

## Root Cause

**Race condition in `stream_thread` route (thread.py:267-277):**

1. `POST /llm/stream` writes `stream_status: "running"` to thread metadata, enqueues TaskIQ task, returns 202
2. Frontend immediately connects to `GET /threads/{thread_id}/stream?run_id=X`
3. Route calls `distributed_stream_exists()` — checks if Redis stream key exists
4. Worker hasn't picked up the task yet → no Redis stream key → returns **false**
5. Route checks `active_run_id == run_id AND stream_status == "running"` → returns **503** (retryable)
6. **BUT** if the thread metadata write from step 1 hasn't propagated (new thread, DB lag), or if `active_run_id` doesn't match, it falls through to **404** (NOT retryable)
7. Frontend's `classifyError` (streamError.ts:49) only retries 500-503. **404 is terminal** → stream dies silently

The irony: `stream_from_redis()` already has a 30-second wait loop for the stream to appear (stream.py:437-446), but the route's pre-check at line 267 prevents ever reaching it.

## Fixes (ordered by priority)

### Fix 1 (P0): Remove premature stream existence pre-check
**File:** `backend/src/routes/v0/thread.py` (lines 267-277)

When `active_run_id == run_id` and `stream_status == "running"`, skip the `distributed_stream_exists()` check entirely and proceed directly to `stream_from_redis()`. The internal wait loop handles the stream not existing yet.

Only check `distributed_stream_exists()` when `stream_status != "running"` (for replaying completed streams still within Redis TTL).

```
# Pseudocode for the new logic:
if active_run_id == run_id and stream_status == "running":
    # Worker is active — let stream_from_redis() wait for the stream
    return StreamingResponse(stream_from_redis(...))

# For completed/errored/aborted streams, check if Redis still has the data
stream_exists = await distributed_stream_exists(thread_id, run_id)
if not stream_exists:
    raise HTTPException(404, ...)

return StreamingResponse(stream_from_redis(...))
```

### Fix 2 (P0 safety net): Make 404 retryable for distributed streams
**File:** `frontend/src/lib/utils/streamSource.ts` (lines 157-186)

In `startWithRetry()`, treat 404 as retryable for the first 3 attempts. After a fresh POST /llm/stream 202, a 404 on the stream endpoint almost certainly means the worker hasn't created the key yet.

```
// In startWithRetry, modify the canRetry logic:
const is404Race = status === 404 && attempt < 3;
const canRetry = isError && (is404Race || this.isRecoverableClose(error) || isRetryableError(error, status)) && attempt < MAX_ATTEMPTS - 1;
```

### Fix 3 (P1): Add max lifetime timeout to stream_from_redis
**File:** `backend/src/utils/stream.py` (line 448+)

The `while True` loop has no exit condition other than receiving `done`/`error` from Redis. If the worker crashes mid-stream, the consumer hangs forever.

Add:
- `MAX_STREAM_LIFETIME_SECONDS` env var (default 600 = 10 minutes)
- Track `start_time = time.monotonic()` before the loop
- Check elapsed time each iteration; if exceeded, yield error + `[DONE]` and return
- Also track consecutive empty XREAD results; after 5 consecutive (= 5 minutes of silence), yield error and close

### Fix 4 (P2): Stale stream_status cleanup
**File:** `backend/src/routes/v0/thread.py`

If `stream_status == "running"` but `active_stream_started_at` is older than `MAX_STREAM_LIFETIME_SECONDS`, the worker is dead. Update `stream_status` to `"error"` and return 410 Gone.

This is a read-side check — no background task needed.

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/routes/v0/thread.py` | Fix 1: Restructure stream existence check. Fix 4: Stale status detection |
| `backend/src/utils/stream.py` | Fix 3: Add max lifetime timeout to `stream_from_redis` |
| `frontend/src/lib/utils/streamSource.ts` | Fix 2: Make 404 retryable for early attempts |

## Verification

1. **Manual test:** Submit a chat in distributed mode, verify stream connects and delivers data
2. **Race condition test:** Add artificial delay before worker writes initializing event; verify frontend retries and eventually connects
3. **Timeout test:** Kill worker mid-stream; verify `stream_from_redis` terminates after timeout instead of hanging forever
4. **Existing tests:** Run `make test` (backend) and `npm run test` (frontend) to verify no regressions
