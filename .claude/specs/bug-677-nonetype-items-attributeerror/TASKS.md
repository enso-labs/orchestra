# Implementation Tasks: Fix AttributeError in _file_data_reducer (Issue #677)

## Pre-Implementation
- [x] Verify development environment setup
- [x] Review REVIEW.md council decisions
- [x] Identify all files state initialization points

## Core Implementation

### Task 1: Fix LLM Controller initialization
- Files: `backend/src/controllers/llm.py`
- Line: ~33
- Change: Add `or {}` to `request.input.files`
- Acceptance: State initialization never passes None for files
- **Status: COMPLETED**

### Task 2: Fix AutoEvictMiddleware accumulated files
- Files: `backend/src/utils/middleware.py`
- Line: ~227
- Change: Verify `.get("files", {})` pattern
- Acceptance: Command update never contains None for files
- **Status: VERIFIED - Already defensive with `.get("files", {})`**

### Task 3: Verify init_config defensive pattern
- Files: `backend/src/flows/__init__.py`
- Line: ~186
- Change: Verify existing `or {}` pattern is correct
- Acceptance: Files configurable always has dict value
- **Status: VERIFIED - Already defensive with `or {}`**

### Task 4: Verify stream handler files accumulation
- Files: `backend/src/workers/tasks.py`
- Line: ~142
- Change: Verify `if chunk_data.get("files")` pattern is safe
- Acceptance: None files values are skipped during accumulation
- **Status: VERIFIED - `if` falsy check skips None values**

## Testing

### Task 5: Add unit test for files state edge cases
- Files: `backend/tests/unit/controllers/test_files_state.py` (new)
- Content: Test None handling in files state
- Acceptance: Tests cover both None, empty dict, and valid dict cases
- **Status: COMPLETED**

### Task 6: Run existing test suite
- Command: `make test`
- Acceptance: All existing tests pass
- **Status: BLOCKED - Requires database environment**

## Verification

### Task 7: Format code
- Command: `make format`
- Acceptance: No formatting changes needed after initial format
- **Status: COMPLETED - 162 files unchanged**

### Task 8: Final verification
- Run test that reproduces the original bug
- Acceptance: No AttributeError occurs
- **Status: PENDING - Manual verification recommended**

## Completion Signature
- Total Tasks: 8
- Scope: Small
- Risk: Low
- Dependencies: deepagents==0.3.1

---

## Progress Log

- 2026-01-16: Task 1 COMPLETED - Fixed `llm.py:33` to use `request.input.files or {}`
- 2026-01-16: Task 2 VERIFIED - Already defensive at `middleware.py:227`
- 2026-01-16: Task 3 VERIFIED - Already defensive in `flows/__init__.py:186`
- 2026-01-16: Task 4 VERIFIED - Falsy check at `tasks.py:142` skips None
- 2026-01-16: Task 5 COMPLETED - Added `tests/unit/controllers/test_files_state.py`
- 2026-01-16: Task 7 COMPLETED - Code formatted
