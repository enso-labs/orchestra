# Implementation Tasks: Web Search Tavily Fallback

**GitHub Issue:** #634
**Feature:** IF default search does not return results, fall back to Tavily API
**Generated:** 2026-01-13
**Based on:** REVIEW.md Council Synthesis

---

## Pre-Implementation

- [x] Verify development environment setup
- [x] Create feature branch: `feat/634-web-search-tavily-fallback`
- [x] Review REVIEW.md council decisions

---

## Core Implementation

### Task 1: Add langchain-tavily dependency
- **Files:** `backend/pyproject.toml`
- **Action:** Add `"langchain-tavily>=0.2.16"` to dependencies array
- **Acceptance:** `uv sync` completes without errors
- **Status:** [x] COMPLETED

### Task 2: Add TAVILY_API_KEY to UserTokenKey enum
- **Files:** `backend/src/constants/__init__.py`
- **Action:** Add `TAVILY_API_KEY = "TAVILY_API_KEY"` to UserTokenKey enum
- **Acceptance:** Enum value exists and is accessible
- **Status:** [x] COMPLETED

### Task 3: Add TAVILY_API_KEY module constant
- **Files:** `backend/src/constants/__init__.py`
- **Action:** Add `TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)` after existing constants
- **Acceptance:** Constant is exported and returns env value or None
- **Status:** [x] COMPLETED

### Task 4: Implement _search_with_searx helper function
- **Files:** `backend/src/tools/search.py`
- **Action:** Create async helper that returns `tuple[list, Exception | None]`
- **Acceptance:** Function isolates SearXNG logic with clean error handling
- **Status:** [x] COMPLETED

### Task 5: Implement _normalize_tavily_results function
- **Files:** `backend/src/tools/search.py`
- **Action:** Create function to convert Tavily format to SearXNG format
- **Acceptance:** Returns normalized dict with `title`, `link`, `snippet`, `source` keys
- **Status:** [x] COMPLETED

### Task 6: Implement _search_with_tavily helper function
- **Files:** `backend/src/tools/search.py`
- **Action:** Create async helper with lazy import and normalization
- **Acceptance:** Function returns normalized results or empty list with error
- **Status:** [x] COMPLETED

### Task 7: Update web_search tool with fallback logic
- **Files:** `backend/src/tools/search.py`
- **Action:** Modify web_search to use helpers with sequential fallback
- **Acceptance:**
  - SearXNG success returns results
  - SearXNG empty/error triggers Tavily fallback
  - Both fail returns empty list (not exception)
  - No providers configured raises ToolException
- **Status:** [x] COMPLETED

---

## Testing

### Task 8: Create test file for search tool
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Create new test file with pytest imports and mocks
- **Acceptance:** File exists with proper imports
- **Status:** [x] COMPLETED

### Task 9: Test SearXNG success path (no fallback)
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test that Tavily is not called when SearXNG succeeds
- **Acceptance:** Test passes, fallback not triggered
- **Status:** [x] COMPLETED

### Task 10: Test SearXNG empty triggers fallback
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test that empty SearXNG results trigger Tavily
- **Acceptance:** Test passes, Tavily called on empty
- **Status:** [x] COMPLETED

### Task 11: Test SearXNG exception triggers fallback
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test that SearXNG exceptions trigger Tavily
- **Acceptance:** Test passes, Tavily called on exception
- **Status:** [x] COMPLETED

### Task 12: Test Tavily result normalization
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test _normalize_tavily_results produces correct format
- **Acceptance:** Test passes, output matches expected format
- **Status:** [x] COMPLETED

### Task 13: Test no providers configured
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test ToolException raised when neither provider configured
- **Acceptance:** Test passes, clear error message
- **Status:** [x] COMPLETED

### Task 14: Test all providers fail returns empty
- **Files:** `backend/tests/unit/tools/test_search.py`
- **Action:** Test that empty list returned when both fail
- **Acceptance:** Test passes, returns [] not exception
- **Status:** [x] COMPLETED

---

## Verification

### Task 15: Run code formatter
- **Command:** `make format` (from backend directory)
- **Acceptance:** No formatting errors, code passes Ruff
- **Status:** [x] COMPLETED

### Task 16: Run full test suite
- **Command:** `make test` (from backend directory)
- **Acceptance:** All tests pass including new search tests
- **Status:** [x] COMPLETED (67 passed, 2 skipped)

### Task 17: Self-review against REVIEW.md
- **Action:** Verify all acceptance criteria from REVIEW.md Section 6.4
- **Acceptance:** All checkboxes can be marked complete
- **Status:** [x] COMPLETED

---

## Completion Signature

- **Total Tasks:** 17
- **Core Implementation:** 7 tasks - ALL COMPLETED
- **Testing:** 7 tasks - ALL COMPLETED
- **Verification:** 3 tasks - ALL COMPLETED
- **Dependencies:** langchain-tavily>=0.2.16

---

## Progress Log

- 2026-01-13: All 17 tasks completed
- Core implementation: Added langchain-tavily dependency, TAVILY_API_KEY constant, and fallback logic
- Testing: 15 unit tests covering all fallback scenarios
- Verification: `make format` passed, `make test` passed (67 passed, 2 skipped)

## Validation Results

### Acceptance Criteria (from REVIEW.md Section 6.4)
- [x] SearXNG success returns results (no fallback)
- [x] SearXNG empty triggers Tavily fallback
- [x] SearXNG exception triggers Tavily fallback
- [x] Tavily results normalized to match SearXNG format
- [x] Both providers fail returns empty list (not exception)
- [x] No providers configured raises clear ToolException
- [x] All unit tests pass
- [x] `make format` and `make test` succeed

**Final Status:** PASS - Ready for commit and PR

