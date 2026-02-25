# Spec 003: Wire MemorySyncMiddleware into Agent Creation

## Objective
Add MemorySyncMiddleware to the agent middleware stack during `create_agent()`.

## Files Modified
- `backend/src/agents/__init__.py` — `create_agent()` function

## Changes

### In `create_agent()`
1. Call `prepare_memory_files()` (already done)
2. Extract `original_content` from the new return value
3. Create `MemorySyncMiddleware(memory_repo, memory_sources, original_content)`
4. Add to middleware stack

### MemoryRepo access
- `create_agent()` already has `user_id` and `store` available
- Create `MemoryRepo(user_id, store)` instance for the middleware

## Notes
- Middleware should be near the end of the stack (after tool execution)
- Only added when memory_sources is not None (user has memories)

## Tests
- Agent creates successfully with MemorySyncMiddleware
- Middleware receives correct memory sources and original content
- Typecheck passes
