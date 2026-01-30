# TASKS: Exa Primary Search with SearXNG Fallback

**Source:** Elite Council REVIEW.md
**Branch:** `bug/705-fallback-searxng-from-exa`

---

## Pre-Implementation

- [ ] **T1: Add `exa-py` dependency**
  - File: `backend/pyproject.toml`
  - Action: Add `exa-py` to project dependencies
  - Acceptance: `uv pip install` or `pip install` succeeds; `from exa_py import Exa` works in Python shell

- [ ] **T2: Add `EXA_API_KEY` to constants**
  - File: `backend/src/constants/__init__.py`
  - Action: Add `EXA_API_KEY = "EXA_API_KEY"` to `UserTokenKey` enum; add `EXA_API_KEY = os.getenv(UserTokenKey.EXA_API_KEY.value)` as module-level variable
  - Acceptance: `from src.constants import EXA_API_KEY` resolves without error

- [ ] **T3: Update `.example.env`**
  - File: `backend/.example.env`
  - Action: Add `EXA_API_KEY=` in the Tool section alongside existing `TAVILY_API_KEY`
  - Acceptance: New env var is documented with comment

---

## Core Implementation

- [ ] **T4: Implement `_normalize_exa_results()`**
  - File: `backend/src/tools/search.py`
  - Action: Add normalizer function that maps Exa results to canonical format:
    - `item.title` -> `title`
    - `item.url` -> `link`
    - `item.highlights[0]` or `item.text[:300]` -> `snippet`
    - Hardcode `engines: ["exa"]`
    - Include `score` and `source: "exa"`
  - Acceptance: Given an Exa response object, returns list of dicts with `title`, `link`, `snippet`, `engines`, `score`, `source`

- [ ] **T5: Implement `_search_with_exa()`**
  - File: `backend/src/tools/search.py`
  - Action: Add async helper following `(results, error)` tuple pattern:
    - Import `exa_py.Exa` inside try/except
    - Use `exa.search_and_contents(query, num_results=num_results, highlights=True)`
    - Wrap sync call in `asyncio.to_thread()`
    - Normalize results via `_normalize_exa_results()`
    - Return `(results, None)` on success, `([], exception)` on failure
  - Acceptance: Returns tuple; handles import errors, API errors, and empty results gracefully

- [ ] **T6: Reorder `web_search()` fallback chain**
  - File: `backend/src/tools/search.py`
  - Action: Change `web_search` function body to:
    1. Phase 1: Exa (if `EXA_API_KEY` is set) -- call `_search_with_exa()`
    2. Phase 2: SearXNG (if `SEARX_SEARCH_HOST_URL` is set) -- existing `_search_with_searx()`
    3. Phase 3: Tavily (if `TAVILY_API_KEY` is set) -- existing `_search_with_tavily()`
    4. Phase 4: All exhausted -- return `[]` or raise `ToolException`
  - Log warnings on each provider failure with provider name and error
  - Acceptance: With `EXA_API_KEY` set, Exa is attempted first; on Exa failure, falls through to SearXNG; on SearXNG failure, falls through to Tavily

- [ ] **T7: Fix `_normalize_tavily_results()` -- add `engines` field**
  - File: `backend/src/tools/search.py`
  - Action: Add `"engines": ["tavily"]` to each result dict in the existing Tavily normalizer
  - Acceptance: Tavily results include `engines` array; frontend renders engine badges for Tavily results

---

## Frontend

- [ ] **T8: Add defensive guard on `engines` in `SearchEngine.tsx`**
  - File: `frontend/src/components/tools/SearchEngine.tsx`
  - Action: Replace `result.engines.map(...)` with `(result.engines ?? []).map(...)`
  - Acceptance: Component renders without crash when `engines` is undefined or null

---

## Testing

- [ ] **T9: Manual test -- Exa primary path**
  - Precondition: `EXA_API_KEY` set to a valid key
  - Action: Trigger a `web_search` tool call from the agent
  - Acceptance: Results render in UI with "exa" engine badge; no errors in backend logs

- [ ] **T10: Manual test -- Exa fallback to SearXNG**
  - Precondition: `EXA_API_KEY` set to invalid/empty value; `SEARX_SEARCH_HOST_URL` set
  - Action: Trigger a `web_search` tool call
  - Acceptance: Backend logs show Exa failure + SearXNG fallback; results render with SearXNG engine badges

- [ ] **T11: Manual test -- All providers fallback**
  - Precondition: `EXA_API_KEY` invalid; `SEARX_SEARCH_HOST_URL` points to unreachable host; `TAVILY_API_KEY` set
  - Action: Trigger a `web_search` tool call
  - Acceptance: Tavily results render; backend logs show Exa and SearXNG failures

- [ ] **T12: Manual test -- No providers configured**
  - Precondition: All search env vars unset
  - Action: Trigger a `web_search` tool call
  - Acceptance: Agent receives empty results or `ToolException`; no unhandled crash

---

## Verification

- [ ] **T13: Verify no regressions -- existing SearXNG path**
  - Precondition: `EXA_API_KEY` unset; `SEARX_SEARCH_HOST_URL` set
  - Action: Trigger search
  - Acceptance: Behavior identical to pre-change (SearXNG primary, Tavily fallback)

- [ ] **T14: Verify frontend renders all providers correctly**
  - Action: Check that results from Exa, SearXNG, and Tavily all display title, link, snippet, and engine badges
  - Acceptance: No JS console errors; badges show correct provider name

- [ ] **T15: Code review checklist**
  - [ ] `asyncio.to_thread()` wraps sync Exa SDK call
  - [ ] All normalizers include `engines` array
  - [ ] Import of `exa_py` is inside try/except
  - [ ] Logging on each provider failure
  - [ ] No hardcoded API keys
  - [ ] `.example.env` updated
