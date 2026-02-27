---
task: review-pr-837-persist-memory-edits (Review #837)
test_command: "make test-backend"
---

# Task: Review PR #837 — Persist Memory File Edits via StateBackend-to-MemoryRepo Sync

> **⚠️ IMPORTANT**: Before implementing this review, READ `/CLAUDE.md` first.

_Code review of PR #837 which adds a MemorySyncMiddleware to persist memory file edits across agent sessions. The middleware detects changes to memory-sourced files in the StateBackend after agent execution and writes them back to MemoryRepo._

## PR Context

- **PR**: https://github.com/ruska-ai/orchestra/pull/837
- **Issue**: #836 — persist memory file edits across sessions
- **Branch**: `feat/836-persist-memory-edits` → `development`
- **Files Changed**: 12 files, +1328 / -33 lines

### Key Changes
1. `prepare_memory_files()` returns 3-tuple with `original_content` dict
2. New `MemorySyncMiddleware` in `backend/src/utils/middleware.py`
3. Middleware wired into `construct_agent()` when memory + original_content present
4. 13 unit tests + 10 integration tests + 4 prepare_memory_files tests

## Requirements

1. Static analysis passes (ruff format, ruff lint, typecheck)
2. All existing + new tests pass
3. Code follows existing patterns (middleware, repos, services)
4. No regressions to memory loading or agent construction
5. Error handling is resilient (sync failures don't crash agents)
6. Only memory-sourced files are synced (not all StateBackend files)
7. No secrets or env files committed

## Success Criteria

1. [ ] **Static Analysis**: `ruff format --check` and `ruff check` pass on all changed files
2. [ ] **Test Suite**: `make test-backend` passes (excluding known pre-existing failures in test_search.py)
3. [ ] **Code Review — prepare_memory_files**: 3-tuple return is backward-compatible; all 3 callers updated correctly; original_content dict captures raw content before file_data conversion
4. [ ] **Code Review — MemorySyncMiddleware**: Uses `aafter_agent` hook correctly; only iterates `memory_sources`; correctly joins file content lines with `\n`; strips leading `/` for memory_id; errors caught and logged, never propagated
5. [ ] **Code Review — construct_agent wiring**: Middleware only added when all preconditions met (memory, original_content, user_id); MemoryRepo constructed with correct user_id and store; existing middleware preserved
6. [ ] **Code Review — Test Coverage**: Unit tests cover happy path, no-change, non-memory files, error handling, partial failure; integration tests use real objects (InMemoryStore, MemoryRepo, MemoryService); no mocked internals in integration tests
7. [ ] **Cleanup Verification**: No `.env` files read or committed; no `vite.config.ts` changes; no stale review artifacts left uncommitted
8. [ ] **Final Verdict**: Approve, request changes, or comment with findings

## Example Output

```
## Review Summary — PR #837

**Verdict**: ✅ APPROVE / ⚠️ REQUEST CHANGES / 💬 COMMENT

### Static Analysis
- ruff format: PASS
- ruff lint: PASS

### Test Results
- Total: 468 | Pass: 462 | Fail: 6 (pre-existing)

### Code Review Findings
1. [severity] finding description — file:line
2. ...

### Recommendation
[Summary of verdict with any conditions]
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
