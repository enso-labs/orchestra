# Plan: Cache User Settings with Redis

## Context

User settings are fetched from the LangGraph PostgreSQL store on **every request** that needs them -- chat/agent invocations, model listing, settings page loads, context file resolution, and worker tasks. Settings rarely change (user-initiated updates only) but are read constantly. This is an unnecessary database round-trip that can be eliminated with caching.

**Decision: Redis (not lru_cache)**
- Workers run in separate processes -- in-memory cache won't share across backend + worker
- Redis is already running, connected, and used by both processes (`REDIS_URL`, `redis>=5.0.0`)
- Single Redis key per user provides cross-process consistency with trivial invalidation
- Settings object is small -- serialization overhead is negligible
- `try/except` around all Redis ops means graceful degradation to DB on Redis failure

## Implementation

### 1. Create `backend/src/common/utils/redis_cache.py` (~15 lines)

Async Redis client singleton using `redis.asyncio.from_url(REDIS_URL, decode_responses=True)`. Import `REDIS_URL` from `src.workers.broker`. Follows pattern of existing `InMemoryCache` singleton.

### 2. Modify `backend/src/repos/user_settings_repo.py` (~50 lines added)

Add private cache methods (all wrapped in `try/except` for graceful degradation):

- `_cache_key() -> str` -- `f"user_settings:{self.user_id}"`
- `async _get_cached() -> UserSettings | None` -- Redis GET, deserialize JSON, return None on miss/error
- `async _set_cached(settings) -> None` -- Redis SET with 300s TTL
- `async _invalidate_cache() -> None` -- Redis DEL

Modify `_get_or_create()`:
1. Try `_get_cached()` first
2. On miss, hit database (existing logic)
3. On DB hit/create, call `_set_cached()`

Add `_invalidate_cache()` call to **all mutation methods**:
- `set_default_model`, `set_default_sandbox`, `patch_defaults`
- `upsert_provider_key`, `delete_provider_key`

Strategy: invalidate-on-write (not update-on-write) to avoid cache/DB divergence.

### 3. Add tests `backend/tests/unit/repos/test_user_settings_cache.py` (~80 lines)

Using `fakeredis` (already a dependency):
- Cache populated on first `_get_or_create` call
- Second call returns from cache (DB not hit)
- Each mutation method invalidates the cache key
- Redis failure gracefully falls through to database
- TTL set correctly

### Zero Consumer Changes

No modifications needed to:
- `routes/v0/settings.py` -- calls `repo.get_settings()` which calls `_get_or_create()`
- `controllers/llm.py` -- calls `_get_or_create()` directly
- `routes/v0/llm.py` -- calls `repo.get_settings()`
- `services/context_files.py` -- creates `UserSettingsRepo` and reads settings
- `workers/tasks.py` -- creates `UserSettingsRepo` in worker process

All benefit automatically because the cache lives inside `UserSettingsRepo._get_or_create()`.

### Security

`encrypted_keys` in Redis is the same Fernet-encrypted blob already in PostgreSQL. Decryption happens in `_decrypt_keys()` after retrieval. Redis is already trusted infrastructure (stores task results, SSE streams).

## Critical Files

| File | Role |
|------|------|
| `backend/src/repos/user_settings_repo.py` | Primary modification target |
| `backend/src/common/utils/redis_cache.py` | New -- async Redis client singleton |
| `backend/src/workers/broker.py` | Source of `REDIS_URL` constant |
| `backend/src/schemas/entities/settings.py` | `UserSettings` model for serialization |
| `backend/src/common/utils/in_memory_cache.py` | Pattern reference |
| `backend/tests/unit/repos/test_user_settings_cache.py` | New -- cache tests |

## Verification

1. `make test` -- all existing + new tests pass
2. Manual: start dev server, hit `GET /settings`, verify Redis key created (`redis-cli GET user_settings:{user_id}`)
3. Manual: `PATCH /settings/default`, verify Redis key deleted then re-populated on next GET
4. Worker: trigger agent invocation, verify worker reads from Redis cache (check logs)
5. Redis down: stop Redis, verify settings endpoints still work (graceful degradation)

## GitHub Issue & Branch

- **Issue title**: `feat: cache user settings reads with Redis`
- **Branch**: `feat/{issue#}-settings-redis-cache`
- **Labels**: `enhancement`
