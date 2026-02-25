# Spec 001: Memory Sync Middleware

## Objective
Create a middleware that intercepts StateBackend file writes for memory-sourced paths and syncs changes to MemoryRepo.

## Files Created/Modified
- `backend/src/utils/middleware.py` — add `MemorySyncMiddleware` class
- `backend/src/agents/__init__.py` — pass memory sources info to middleware, add to stack

## Design

### MemorySyncMiddleware
An `AgentMiddleware` subclass that:
1. Receives the list of memory-sourced file paths (from `prepare_memory_files()`)
2. After each agent turn, checks if any memory-sourced files were modified in the StateBackend
3. If modified, writes the updated content back to MemoryRepo via `MemoryRepo.update()`

### How to detect file changes
- `StateBackend` stores files in graph state under `files` key
- After model call or tool execution, compare current file content with original loaded content
- Only sync paths that are in the `memory_sources` list

### Alternative: Hook into StateBackend.write()
- If `deepagents` exposes a write hook/callback, use that instead of polling after each turn
- Check `deepagents` API for `on_write` or similar

## Integration
```python
class MemorySyncMiddleware(AgentMiddleware):
    def __init__(self, memory_repo: MemoryRepo, memory_sources: list[str], original_content: dict[str, str]):
        self.memory_repo = memory_repo
        self.memory_sources = set(memory_sources)
        self.original_content = original_content  # path -> original content

    # After each turn, check for changes and sync
```

## Tests
- Test: edit a memory file → content synced to MemoryRepo
- Test: edit a non-memory file → NOT synced
- Test: no edits → no MemoryRepo calls
- Typecheck passes
