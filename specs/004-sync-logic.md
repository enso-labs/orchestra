# Spec 004: Implement Sync Logic

## Objective
Implement the actual sync logic that writes changed memory files back to MemoryRepo.

## Implementation

### Change detection
After each agent turn (after model call + tool execution):
1. Get current file contents from StateBackend/graph state
2. For each path in `memory_sources`:
   - Compare current content with `original_content[path]`
   - If different, call `MemoryRepo.update(memory_id=path_without_leading_slash, content=new_content)`
3. Update `original_content` with new values (avoid re-syncing unchanged files)

### Async sync
- Use `asyncio.create_task()` for the MemoryRepo write so it doesn't block the agent response
- Log sync operations for debugging

### Error handling
- If MemoryRepo.update() fails, log warning but don't crash the agent
- If memory was deleted externally, use `MemoryRepo.create()` as fallback

## Tests
- Test: file content changed → MemoryRepo.update() called with correct content
- Test: file content unchanged → MemoryRepo.update() NOT called
- Test: MemoryRepo.update() failure → agent continues without error
- Test: multiple files changed → all synced
- Typecheck passes
- Tests pass
