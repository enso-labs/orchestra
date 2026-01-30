# PRD: Exa Primary Search with SearXNG Fallback

## Introduction

Replace SearXNG as the primary web search provider with Exa, a neural search API that delivers higher-quality, more relevant results. SearXNG becomes the secondary fallback and Tavily remains as the tertiary fallback. The change is additive -- all existing search paths are preserved, and the system gracefully degrades when Exa is unavailable or not configured.

## Goals

- Improve search result quality for end users by using Exa as the primary search provider
- Maintain full fallback redundancy: Exa -> SearXNG -> Tavily
- Normalize all provider outputs to a single canonical schema (title, link, snippet, engines, score, source)
- Fix pre-existing bug where Tavily results lack the `engines` field
- Prevent frontend crashes when any provider omits the `engines` field
- Gracefully degrade when `exa-py` is not installed (soft dependency)

## User Stories

### US-001: Add `exa-py` dependency and `EXA_API_KEY` constant
**Description:** As a developer, I need the Exa SDK available and the API key wired into the constants system so the search module can use it.

**Acceptance Criteria:**
- [ ] `exa-py` added to `backend/pyproject.toml` dependencies
- [ ] `EXA_API_KEY` added to `UserTokenKey` enum in `backend/src/constants/__init__.py`
- [ ] Module-level `EXA_API_KEY = os.getenv(...)` variable exported
- [ ] `EXA_API_KEY=` added to `backend/.example.env` in the Tool section
- [ ] `from exa_py import Exa` works after install; import failure does not crash the app

### US-002: Normalize Exa search results
**Description:** As an end user, I want Exa results to display the same title, link, snippet, and engine badge as other providers so the UI is consistent.

**Acceptance Criteria:**
- [ ] `_normalize_exa_results()` function added to `backend/src/tools/search.py`
- [ ] Maps `item.title` -> `title`, `item.url` -> `link`
- [ ] Maps `item.highlights[0]` -> `snippet`, falling back to `item.text[:300]` when highlights are empty
- [ ] Each result includes `engines: ["exa"]`, `source: "exa"`, and `score`
- [ ] Returns a list of dicts matching the canonical search result format

### US-003: Search with Exa as primary provider
**Description:** As an end user, I want my searches to use Exa first so I get higher-quality results.

**Acceptance Criteria:**
- [ ] `_search_with_exa()` async helper added to `backend/src/tools/search.py`
- [ ] Uses `exa.search_and_contents(query, num_results=num_results, highlights=True)`
- [ ] Sync Exa SDK call wrapped in `asyncio.to_thread()` to avoid blocking the event loop
- [ ] Returns `(results, None)` on success, `([], exception)` on failure
- [ ] Import of `exa_py` is inside try/except; import failure returns error tuple gracefully
- [ ] Logs warning on failure with provider name and error message

### US-004: Reorder fallback chain to Exa -> SearXNG -> Tavily
**Description:** As an end user, I want the system to automatically try alternative search providers if the primary one fails, so I always get results.

**Acceptance Criteria:**
- [ ] `web_search()` attempts Exa first (if `EXA_API_KEY` is set)
- [ ] On Exa failure, falls through to SearXNG (if `SEARX_SEARCH_HOST_URL` is set)
- [ ] On SearXNG failure, falls through to Tavily (if `TAVILY_API_KEY` is set)
- [ ] If all providers fail or none are configured, returns empty results or raises `ToolException`
- [ ] Each provider failure is logged with provider name and error
- [ ] Existing SearXNG-primary behavior is preserved when `EXA_API_KEY` is not set

### US-005: Fix Tavily normalizer missing `engines` field
**Description:** As an end user, I want Tavily results to show the correct engine badge instead of crashing or showing nothing.

**Acceptance Criteria:**
- [ ] `_normalize_tavily_results()` includes `"engines": ["tavily"]` in each result dict
- [ ] Frontend renders "tavily" engine badge for Tavily results

### US-006: Add defensive guard on `engines` in frontend
**Description:** As an end user, I don't want the search UI to crash if a provider omits the `engines` field.

**Acceptance Criteria:**
- [ ] `result.engines.map(...)` replaced with `(result.engines ?? []).map(...)` in `SearchEngine.tsx`
- [ ] Component renders without crash when `engines` is `undefined` or `null`
- [ ] No JS console errors when rendering results from any provider

## Functional Requirements

- FR-1: Add `exa-py` as a project dependency in `backend/pyproject.toml`
- FR-2: Add `EXA_API_KEY` to the `UserTokenKey` enum and as a module-level env var in constants
- FR-3: Add `EXA_API_KEY=` to `backend/.example.env`
- FR-4: Implement `_normalize_exa_results()` mapping Exa fields to `{title, link, snippet, engines, score, source}`
- FR-5: Implement `_search_with_exa()` using `search_and_contents(highlights=True)`, wrapped in `asyncio.to_thread()`, with try/except on import
- FR-6: Reorder `web_search()` fallback chain: Exa (primary) -> SearXNG (secondary) -> Tavily (tertiary)
- FR-7: Log a warning on each provider failure including provider name and error
- FR-8: Add `"engines": ["tavily"]` to `_normalize_tavily_results()`
- FR-9: Replace `result.engines.map(...)` with `(result.engines ?? []).map(...)` in `SearchEngine.tsx`

## Non-Goals

- No circuit breaker or quota-exhaustion flag for Exa (deferred -- per-call fallback is sufficient)
- No `SEARCH_PROVIDER_PRIORITY` env var for operator-configurable ordering (deferred)
- No Pydantic `SearchResult` model (deferred -- codebase uses plain dicts)
- No TypeScript `SearchResult` interface (deferred)
- No removal of the SearXNG default URL (`http://localhost:8080`)
- No new frontend UI beyond the defensive `?? []` guard

## Technical Considerations

- **Async handling:** The `exa-py` SDK is synchronous. All calls must be wrapped in `asyncio.to_thread()` to avoid blocking the LangGraph async event loop.
- **Soft dependency:** `exa-py` import is inside try/except. If the package is not installed, Exa is skipped silently and the fallback chain continues.
- **Existing patterns:** Follow the `(results, error)` tuple return pattern used by `_search_with_searx()` and `_search_with_tavily()`.
- **Files changed:** `backend/pyproject.toml`, `backend/.example.env`, `backend/src/constants/__init__.py`, `backend/src/tools/search.py`, `frontend/src/components/tools/SearchEngine.tsx`
- **New dependency:** `exa-py` (1 package)
- **Breaking changes:** None. All changes are additive.

## Success Metrics

- Search results from Exa render correctly with title, link, snippet, and "exa" engine badge
- When Exa fails, SearXNG and Tavily fallbacks activate without user-visible errors
- When `EXA_API_KEY` is not set, existing SearXNG -> Tavily behavior is unchanged (no regression)
- No frontend console errors from missing `engines` field on any provider

## Open Questions

- None. All divergences resolved in the Elite Council REVIEW.md.
