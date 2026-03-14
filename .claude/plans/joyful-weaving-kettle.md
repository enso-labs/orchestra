# Plan: Resolve Production Worker Stability & SSE Streaming Issues

## Context

After 19+ hours of uptime, the production worker accumulates orphaned asyncio tasks and Pydantic serializer warnings. Additionally, both worker processes crash simultaneously due to unhandled Redis `ConnectionError` in the TaskIQ broker's `listen()` loop. These issues compound to cause SSE streaming responses not being delivered to users in production, despite healthy backend health checks. Four GitHub issues are needed.

---

## Issue 1: Redis Connection Drops Kill Worker Processes (CRITICAL)

**Problem:** `RedisStreamBroker.listen()` in taskiq-redis has **no error handling** for `ConnectionError`. When Redis closes the connection (server restart, network blip, idle timeout), the exception propagates up through TaskIQ's receiver, killing the worker process. Both worker-0 and worker-1 crash simultaneously. TaskIQ's process manager restarts them, but any in-flight tasks are lost and streams are never completed.

**Evidence:** Logs show `redis.exceptions.ConnectionError: Connection closed by server.` causing `ExceptionGroup: unhandled errors in a TaskGroup` in both workers.

**Note:** `ListQueueBroker.listen()` (line 135 of `redis_broker.py`) already handles this with `except ConnectionError: continue`, but `RedisStreamBroker` does not.

**Fix:** Configure Redis connection pool with `retry_on_error` and `health_check_interval`, and add a custom broker subclass with connection error handling.

### Files to modify

1. **`backend/src/workers/broker.py`** — Subclass `RedisStreamBroker` to add `ConnectionError` handling in `listen()`, and pass `retry_on_error` + `health_check_interval` kwargs to the connection pool

### Implementation details

```python
from redis.asyncio import Redis
from redis.exceptions import ConnectionError
from taskiq_redis import RedisStreamBroker

class ResilientRedisStreamBroker(RedisStreamBroker):
    """RedisStreamBroker with ConnectionError retry handling."""

    async def listen(self):
        """Listen with automatic reconnect on ConnectionError."""
        while True:
            try:
                async for message in super().listen():
                    yield message
            except ConnectionError as exc:
                logger.warning("Redis connection error in broker listen: %s. Reconnecting...", exc)
                await asyncio.sleep(1)  # Brief backoff before reconnect
                continue

broker = ResilientRedisStreamBroker(
    url=REDIS_URL,
    queue_name="orchestra_tasks",
    health_check_interval=30,  # Ping Redis every 30s to detect dead connections
    retry_on_error=[ConnectionError],
).with_result_backend(result_backend)
```

---

## Issue 2: Orphaned Asyncio Tasks in Worker (LangGraph Store Batch Loop)

**Problem:** Each worker task creates a new `AsyncPostgresStore` via `get_store_db()`. The store's internal batch loop task (`asyncio.create_task(_run())`) is not properly awaited on context manager exit, leaving orphaned tasks that accumulate over hours.

**Fix:** Add a singleton store to `WorkerState`, mirroring the existing checkpointer pattern in `state.py`.

### Files to modify

1. **`backend/src/workers/state.py`** — Add `_store` field, `_store_exit_stack`, initialize in `initialize()`, cleanup in `shutdown()`, add `get_store()` and `get_worker_store()` convenience function
2. **`backend/src/workers/tasks.py`** — Replace `async with get_store_db() as store:` with `store = await get_worker_store()`
3. **`backend/src/workers/broker.py`** — Ensure lifecycle hooks call store init/shutdown (already structured for this)

### Implementation details

- Use `contextlib.AsyncExitStack` to manage the store context manager lifecycle in `WorkerState`
- On shutdown, exit the stack (which calls `__aexit__`), then cancel the store's internal `_task` and await with timeout as defense-in-depth
- Keep `get_store_db()` in `db.py` unchanged for non-worker callers (API routes)

---

## Issue 3: Pydantic Serializer Warnings

**Problem:** Worker produces repeated Pydantic serializer warnings from legacy `.dict()` calls and `model_dump()` on LangChain `BaseMessage` objects (which extend `Serializable`, not Pydantic `BaseModel`).

**Fix:** Update serialization calls to use correct methods per object type.

### Files to modify

1. **`backend/src/agents/__init__.py`** (lines 64, 104) — Replace `memory.dict()` with `memory.model_dump()` or access `.value` directly
2. **`backend/src/repos/thread_repo.py`** (line 67) — Replace `.dict()` with `.model_dump()`
3. **`backend/src/utils/messages.py`** (line 20) — Use LangChain's `message_to_dict()` for `BaseMessage` instead of `.model_dump()`
4. **`backend/src/utils/stream.py`** (line 62) — Same fix in `_to_dict()`: type-check for `BaseMessage` before calling serialization

---

## Issue 4: Production SSE Streaming Not Returning Responses

**Problem:** Production uses distributed mode (nginx + Redis streams). Responses not reaching users despite healthy backend. Root causes are a combination of Issues 1-3 plus missing nginx buffering headers and stream race conditions.

**Fix:** Multiple targeted changes to eliminate buffering and race conditions.

### Files to modify

1. **`backend/src/routes/v0/llm.py`** (line 150) — Add `"X-Accel-Buffering": "no"` header to sync-mode `StreamingResponse` (already present on distributed endpoint in `thread.py:285`)
2. **`backend/src/workers/tasks.py`** (~line 105) — Write an "initializing" event to Redis stream immediately on task start, before heavy init work, to eliminate the race where client polls before stream exists
3. **`backend/src/utils/stream.py`** — In `stream_from_redis()`, add a wait-loop when stream doesn't exist yet (up to 30s with keep-alive comments) instead of immediately raising `FileNotFoundError`

---

## Deployment Order

1. **Issue 1 (Redis resilience)** — CRITICAL. Workers crashing is the most likely cause of missing responses. Lowest risk fix (subclass + config).
2. **Issue 4 (SSE headers + race conditions)** — High user impact, low risk. `X-Accel-Buffering` header is a one-liner.
3. **Issue 3 (Pydantic warnings)** — Low risk, reduces log noise, aids debugging.
4. **Issue 2 (Singleton store)** — Medium risk, fixes long-running stability. Deploy after validating Issue 1 fix.

## Verification

- **Issue 1:** Simulate Redis restart (`docker restart orchestra-dev-redis-1`), verify workers reconnect without crashing
- **Issue 2:** Run worker for extended period, monitor for "Task was destroyed" warnings via `docker logs`
- **Issue 3:** Check worker logs for absence of Pydantic serializer warnings
- **Issue 4:** Send chat message in production, verify SSE stream delivers response. Test with `curl -N` behind nginx.
- All: `make test` passes, `make format` clean

## GitHub Issues

Create 4 separate issues on the repo, each referencing the relevant files and fix approach above. Label with `bug` and `backend`.
