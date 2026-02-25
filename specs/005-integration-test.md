# Spec 005: Integration Tests

## Objective
End-to-end test that memory edits persist across sessions.

## Test Scenarios

### Test 1: Edit persists across sessions
1. Create a memory via MemoryRepo with content "original"
2. Start agent session → memory loaded into StateBackend
3. Agent edits the memory file (simulated write)
4. Verify MemoryRepo now has updated content
5. Start new agent session → verify updated content is loaded

### Test 2: Only memory files synced
1. Agent writes to a non-memory path (e.g., /scratch/notes.txt)
2. Verify MemoryRepo is NOT updated with that content

### Test 3: Multiple edits in one session
1. Agent edits memory file multiple times
2. Final content is what gets synced

### Test 4: New memory file created during session
1. Agent creates a new file at a memory-sourced path
2. Verify it's synced to MemoryRepo

## Tests
- All integration tests pass
- Typecheck passes
