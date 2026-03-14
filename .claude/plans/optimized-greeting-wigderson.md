# Plan: Fix #858 — Redis connection drops kill worker processes

## Context

Issue [#858](https://github.com/ruska-ai/orchestra/issues/858): When Redis closes connections (restart, network blip, idle timeout), `RedisStreamBroker.listen()` raises an unhandled `ConnectionError` that propagates up and kills the worker processes. Both worker-0 and worker-1 crash simultaneously.

The fix is **already implemented** as unstaged changes on `development`. The changes also include related improvements to worker resilience and streaming reliability that were developed alongside the broker fix.

## Changes (already implemented, need commit + PR)

### 1. `backend/src/workers/broker.py` — Core fix for #858
- Subclasses `RedisStreamBroker` as `ResilientRedisStreamBroker`
- Wraps `listen()` with `ConnectionError` catch → logs warning → 1s backoff → reconnects
- Swaps `broker` instantiation to use the new subclass

### 2. `backend/src/utils/stream.py` — Stream polling for worker init lag
- Instead of immediately raising `FileNotFoundError` when the Redis stream doesn't exist, polls up to 30s (1s interval) sending SSE `: waiting\n\n` keepalive comments
- Prevents client-side errors when the worker is still initializing

### 3. `backend/src/workers/state.py` — Shared `AsyncPostgresStore` singleton
- Adds `_store` and `_store_exit_stack` to `WorkerState` for a worker-level store singleton
- Adds `get_store()` class method and `get_worker_store()` convenience function
- Properly shuts down store (exit stack + internal task cancellation) in `shutdown()`

### 4. `backend/src/workers/tasks.py` — Use worker-level store + early stream init
- Writes an `initializing` event to the Redis stream immediately so clients see activity before heavy init
- Uses `get_worker_store()` instead of per-task `get_store_db()` context manager (eliminates per-task DB connection overhead)

### 5. `backend/src/routes/v0/llm.py` — Disable proxy buffering
- Adds `X-Accel-Buffering: no` header to SSE responses to prevent nginx/reverse proxy buffering

## Steps to complete

1. **Run tests**: `cd backend && make test` — verify all existing tests pass with these changes
2. **Run format/lint**: `cd backend && make format && make lint`
3. **Commit** all 4 changed files with a descriptive message referencing #858
4. **Create PR** targeting `development`

## Verification

1. Run `make test` — all backend tests pass
2. Manual: `docker restart orchestra-dev-redis-1` while workers are running — workers should log a warning and reconnect within ~1s, not crash
3. Manual: Start a streaming request immediately after kicking a worker task — the client should receive `: waiting` keepalive comments until the stream appears
