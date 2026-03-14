# Fix: SSE Stream URL Construction Breaks in Production (Distributed Mode)

## Context

Since tag `2026.3.12`, submitting a chat message on **chat.ruska.ai** creates a thread but never redirects to `/thread/:threadId`. The response never streams. Browser console shows 5 retries of `Failed to construct 'URL': Invalid URL` then gives up.

**Working tag**: `2026.3.8` — **Broken tags**: `2026.3.12`, `2026.3.12.1`, `2026.3.13`

### Root Cause

Commit `ee578277` (March 10, "feat: add stream recovery and docker dev stack") changed `DistributedStreamSource.createAndStartReader()` from passing a plain string to `fetch()` to using `new URL()` to support query parameters (`run_id`, `after`):

```typescript
// Before ee578277 (working) — plain string, fetch() resolves relative paths natively
this.reader = new FetchStreamReader(`${VITE_API_URL}/threads/${this.threadId}/stream`, ...);

// After ee578277 (broken) — new URL() requires absolute URL or base parameter
const url = new URL(`${VITE_API_URL}/threads/${this.threadId}/stream`);
url.searchParams.set("run_id", this.runId);
```

`VITE_API_URL` defaults to `"/api"` (relative path). `new URL("/api/...")` throws `TypeError: Invalid URL`. The error is classified as "NETWORK" (retryable), causing 5 retry attempts that all fail identically.

**Why it works locally**: Vite dev server with `DISTRIBUTED_WORKERS=false` returns 200 (sync mode) → uses `SyncStreamSource` which reads from the POST response body directly. The broken `DistributedStreamSource` path is never hit.

## Fix

### 1. Add `window.location.origin` as base URL parameter

**File**: `frontend/src/lib/utils/streamSource.ts:201`

```typescript
// Before
const url = new URL(`${VITE_API_URL}/threads/${this.threadId}/stream`);

// After
const url = new URL(`${VITE_API_URL}/threads/${this.threadId}/stream`, window.location.origin);
```

This is the only instance of `new URL()` with `VITE_API_URL` in the codebase. The `window.location.origin` base makes `/api/threads/.../stream` resolve to `https://chat.ruska.ai/api/threads/.../stream`.

**Already applied** in the working tree.

### 2. Graceful decrypt handling (unrelated but included)

**File**: `backend/src/repos/user_settings_repo.py:42-51`

The `_decrypt_keys()` method now catches `ValueError` from `APP_SECRET_KEY` mismatch and returns empty dict with a warning log, instead of crashing with a 500.

**Already applied** in the working tree.

## Verification

1. **Typecheck**: `cd frontend && npx tsc --noEmit` — passes
2. **Local test**: Submit query on `localhost:5173` → redirects to `/thread/:threadId` with streamed response
3. **Prod test (post-deploy)**: Submit query on `chat.ruska.ai` → should redirect to `/thread/:threadId` instead of staying on `/chat`
4. **Console check**: No more `Failed to construct 'URL': Invalid URL` errors in browser console

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/lib/utils/streamSource.ts` | Add `window.location.origin` base to `new URL()` |
| `backend/src/repos/user_settings_repo.py` | Graceful `APP_SECRET_KEY` mismatch handling |
