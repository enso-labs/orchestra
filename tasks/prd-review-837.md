# PRD: Review PR #837 — Persist Memory File Edits

## Introduction

Structured code review of PR #837 which adds a `MemorySyncMiddleware` to persist memory file edits from the agent's `StateBackend` back to `MemoryRepo` across sessions. The review validates static analysis, code quality, test coverage, and produces a final verdict.

## Goals

- Verify all static analysis checks pass on changed files
- Validate code correctness and adherence to existing patterns
- Confirm test coverage is adequate for the feature
- Ensure no regressions to existing functionality
- Produce a clear review verdict with actionable findings

## User Stories

### US-001: Static Analysis
**Description:** As a reviewer, I want to run static analysis on all changed files so that code quality standards are met.

**Acceptance Criteria:**
- [ ] Run `ruff format --check backend/` and confirm all files pass
- [ ] Run `ruff check backend/` and confirm no lint errors
- [ ] Document any findings with file and line references

### US-002: Code Review
**Description:** As a reviewer, I want to inspect the implementation for correctness, patterns, and edge cases.

**Acceptance Criteria:**
- [ ] Review `prepare_memory_files()` 3-tuple return — verify backward compatibility, all 3 callers updated, original_content captures raw strings
- [ ] Review `MemorySyncMiddleware` — verify `aafter_agent` usage, memory_sources iteration, content join with `\n`, leading `/` strip for memory_id, error handling (caught + logged, never propagated)
- [ ] Review `construct_agent()` wiring — verify precondition checks (memory, original_content, user_id), MemoryRepo construction, existing middleware preserved
- [ ] Review test coverage — unit tests cover happy path, no-change, non-memory files, error handling, partial failure; integration tests use real objects
- [ ] Check for any `.env` file reads, `vite.config.ts` changes, or leaked secrets
- [ ] Document all findings as a numbered list with severity (info/warning/issue)

### US-003: Test Suite Validation
**Description:** As a reviewer, I want to run the full backend test suite to confirm no regressions.

**Acceptance Criteria:**
- [ ] Run `make test-backend` from the worktree
- [ ] All tests pass except known pre-existing failures in `test_search.py` (6 tests)
- [ ] New tests (unit + integration) all pass
- [ ] Document test counts and any unexpected failures

### US-004: Review Report & Cleanup
**Description:** As a reviewer, I want to produce a final review report and ensure no artifacts are left behind.

**Acceptance Criteria:**
- [ ] Generate review summary with verdict (APPROVE / REQUEST CHANGES / COMMENT)
- [ ] Include static analysis results, test results, and numbered findings
- [ ] Verify `git status` shows no uncommitted review artifacts
- [ ] Commit review report and all review pipeline files

## Functional Requirements

- FR-1: Run ruff format and lint checks on all backend files
- FR-2: Read and analyze every changed file in the PR diff
- FR-3: Run full backend test suite and capture results
- FR-4: Generate structured review report with findings
- FR-5: Commit all review artifacts cleanly

## Non-Goals

- No code modifications to the PR branch (review only)
- No browser/UI validation (backend-only PR)
- No performance benchmarking

## Technical Considerations

- Worktree is at `~/.openclaw/workspace/orchestra/.worktrees/review-837`
- PR branch: `feat/836-persist-memory-edits`, base: `development`
- Pre-existing test failures in `test_search.py` are known and unrelated
- Review runs on `review/837-persist-memory-edits` branch

## Success Metrics

- All static analysis checks pass
- Test suite shows no new failures
- Review findings are documented with file:line references
- Final verdict is clear and actionable
