# Proposal: Exa Primary / SearXNG Fallback Search Strategy

**Author:** AGENT_2 — FALLBACK_STRATEGIST
**Date:** 2026-01-29
**Branch:** `bug/705-fallback-searxng-from-exa`

---

## 1. Executive Summary

The current `web_search` tool uses SearXNG as primary and Tavily as fallback. This proposal replaces that ordering: **Exa becomes the primary search provider**, with **SearXNG as the fallback** when Exa's free tier quota is exhausted or errors occur. Both providers must normalize results to the same `{title, link, snippet, ...}` schema so the frontend `SearchEngineTool` component renders them identically.

---

## 2. Architectural Analysis

### 2.1 Current State

**File:** `backend/src/tools/search.py`

The `web_search` tool follows a two-phase fallback pattern:

```
Phase 1: SearXNG (primary) -> if fails/empty ->
Phase 2: Tavily (fallback) -> if fails/empty ->
Phase 3: Return [] or raise ToolException
```

Key observations:
- Each provider has a dedicated `_search_with_<provider>()` helper returning `(results, error)` tuples -- clean error propagation pattern.
- Tavily results are normalized via `_normalize_tavily_results()` to match SearXNG's `{title, link, snippet}` shape.
- Provider availability is gated by environment constants: `SEARX_SEARCH_HOST_URL`, `TAVILY_API_KEY`.
- The tool returns `list` (not a custom schema), which the frontend parses as JSON expecting `{title, link, snippet, engines[]}`.

**File:** `backend/src/constants/__init__.py`

```python
SEARX_SEARCH_HOST_URL = os.getenv("SEARX_SEARCH_HOST_URL", "http://localhost:8080")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
```

No Exa configuration exists yet.

**File:** `frontend/src/components/tools/SearchEngine.tsx`

The frontend expects each result to have: `title`, `link`, `snippet`, and `engines[]`. The `engines` field is iterated to render badges. If JSON parsing fails, it falls back to rendering raw markdown. This means any new provider MUST include the `engines` field or the frontend will throw and fall back to markdown rendering.

### 2.2 Existing Fallback/Retry Patterns

The codebase has a mature `retry_db_operation` decorator (`backend/src/utils/retry.py`) with exponential backoff, jitter, error classification, and hooks. The checkpoint service (`backend/src/services/errors.py`) has a full retryable-vs-permanent error taxonomy. These patterns inform the design but are DB-specific -- search fallback needs a simpler, provider-switching approach rather than retry-of-same-provider.

### 2.3 Exa Error Surface (Expected)

Exa's API (via `exa-py` or `langchain-exa`) typically raises:
- **`httpx.HTTPStatusError` with 429**: Rate limit / quota exhausted
- **`httpx.HTTPStatusError` with 402/403**: Free tier expired, payment required
- **Generic `Exception`**: Network failures, timeouts

Quota exhaustion specifically manifests as HTTP 429 or 402 responses. These are the critical signals for triggering fallback.

---

## 3. Implementation Strategy

### 3.1 New Provider Helper: `_search_with_exa()`

Add a new helper following the existing `(results, error)` tuple pattern:

```python
async def _search_with_exa(
    query: str,
    num_results: int,
    api_key: str,
) -> tuple[list, Exception | None]:
    try:
        from exa_py import Exa
        exa = Exa(api_key=api_key)
        response = exa.search_and_contents(
            query=query,
            num_results=num_results,
            text=True,
            highlights=True,
        )
        results = _normalize_exa_results(response.results)
        return results, None
    except Exception as e:
        return [], e
```

### 3.2 Normalizer: `_normalize_exa_results()`

```python
def _normalize_exa_results(exa_results: list) -> list:
    normalized = []
    for item in exa_results:
        snippet = ""
        if hasattr(item, "highlights") and item.highlights:
            snippet = " ".join(item.highlights)
        elif hasattr(item, "text") and item.text:
            snippet = item.text[:300]

        normalized.append({
            "title": getattr(item, "title", ""),
            "link": getattr(item, "url", ""),
            "snippet": snippet,
            "score": getattr(item, "score", 0.0),
            "engines": ["exa"],
            "source": "exa",
        })
    return normalized
```

The `engines` field is critical -- without it, the frontend `SearchEngineTool` component will crash on `result.engines.map(...)`.

### 3.3 Updated `web_search` Flow

Replace the current SearXNG-primary/Tavily-fallback with:

```
Phase 1: Exa (primary, if EXA_API_KEY set)
    -> success: return results
    -> quota error (429/402/403): log, set _exa_quota_exhausted flag, fall through
    -> other error: log, fall through

Phase 2: SearXNG (fallback, if SEARX_SEARCH_HOST_URL set)
    -> success: return results
    -> error: log, fall through

Phase 3: Tavily (tertiary fallback, if TAVILY_API_KEY set) [optional, preserve backward compat]
    -> success: return results
    -> error: log, fall through

Phase 4: Return [] or raise ToolException
```

### 3.4 Quota Exhaustion Detection

**Approach: Error inspection in the `_search_with_exa` helper.**

Rather than a global circuit breaker (which adds complexity for minimal benefit in a stateless tool), detect quota exhaustion per-call:

```python
def _is_exa_quota_error(error: Exception) -> bool:
    """Check if an Exa error indicates quota/billing exhaustion."""
    error_str = str(error).lower()
    if hasattr(error, "status_code"):
        if error.status_code in (402, 403, 429):
            return True
    if any(kw in error_str for kw in ["quota", "rate limit", "exceeded", "payment required", "billing"]):
        return True
    return False
```

**Optional Enhancement: In-memory circuit breaker.** If Exa quota is exhausted, it will remain exhausted for the billing period. A module-level flag can skip Exa calls for subsequent requests in the same process lifetime:

```python
_exa_quota_exhausted: bool = False

# In web_search:
if EXA_API_KEY and not _exa_quota_exhausted:
    results, exa_error = await _search_with_exa(...)
    if exa_error and _is_exa_quota_error(exa_error):
        global _exa_quota_exhausted
        _exa_quota_exhausted = True
        logger.warning("[Exa] Quota exhausted, disabling for this process lifetime")
```

This is a simple optimization to avoid repeated failing calls. It requires no external state store and resets on process restart (which is acceptable since billing cycles reset periodically).

### 3.5 Configuration Changes

**File:** `backend/src/constants/__init__.py`

Add:
```python
class UserTokenKey(str, Enum):
    ...
    EXA_API_KEY = "EXA_API_KEY"

EXA_API_KEY = os.getenv(UserTokenKey.EXA_API_KEY.value)
```

### 3.6 SearXNG Result Normalization

SearXNG results already include `engines` as a list. Exa results need `engines: ["exa"]` injected. Tavily results from `_normalize_tavily_results()` should also gain `engines: ["tavily"]` for frontend consistency. Update the existing normalizer:

```python
def _normalize_tavily_results(tavily_response: dict) -> list:
    ...
    normalized.append({
        ...
        "engines": ["tavily"],  # ADD THIS
    })
```

### 3.7 Frontend Impact

**No frontend changes required** if the normalized output includes `title`, `link`, `snippet`, and `engines[]`. The `SearchEngineTool` component already handles this shape. The `engines` badges will show "exa" or "google"/"duckduckgo" depending on which provider served the result, giving the user implicit visibility into which backend was used.

---

## 4. Design Decisions

### 4.1 Why Try/Except in Helper (Not Decorator or Middleware)

| Approach | Pros | Cons |
|----------|------|------|
| **Try/except in helper** (chosen) | Matches existing `_search_with_searx`/`_search_with_tavily` pattern; explicit control; easy to add quota detection | Slightly verbose |
| Retry decorator | Good for transient errors | Wrong tool -- we want to switch providers, not retry the same one |
| Middleware/interceptor | Clean separation | Over-engineered for 3 providers; no HTTP middleware layer exists for tool calls |

The existing codebase convention is clear: each provider gets a `_search_with_<name>()` helper returning `(results, error)`. Following this pattern is the lowest-risk, most readable approach.

### 4.2 Why Module-Level Flag (Not Redis/DB State)

- The tool is stateless by design ("maintains no internal state across calls" per docstring).
- A module-level `_exa_quota_exhausted` bool is the minimum viable circuit breaker.
- Redis/DB would add a dependency for a simple boolean that can reset on restart.
- Multiple workers each discover quota exhaustion independently -- this is acceptable since the first Exa call per worker is cheap (one HTTP request).

### 4.3 Why Exa Primary Over SearXNG Primary

- Exa provides semantic search with higher relevance for research queries.
- SearXNG is self-hosted and free but depends on upstream engine availability.
- The feature request explicitly states "Exa as primary."

---

## 5. Risk Assessment

### 5.1 Risks and Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Exa SDK not installed / import fails | Medium | Low | Wrap import in try/except; skip to SearXNG if unavailable |
| Exa quota error format changes | Low | Low | Use broad keyword matching in `_is_exa_quota_error`; log unrecognized errors |
| Race condition on `_exa_quota_exhausted` flag | Negligible | Low | Bool assignment is atomic in CPython; worst case is one extra failed call |
| SearXNG also fails after Exa fallback | Medium | Medium | Tavily tertiary fallback preserved; final empty `[]` return prevents agent loops |
| Frontend breaks on missing `engines` field | High | Medium | Ensure ALL normalizers include `engines[]`; add optional chaining in frontend as defense |
| Increased latency on quota exhaustion (Exa timeout + SearXNG) | Medium | Medium | Circuit breaker flag skips Exa after first quota error; Exa timeout should be short (5-10s) |

### 5.2 Logging Strategy

All provider transitions must be logged at appropriate levels:
- `INFO`: Successful search with provider name and result count
- `WARNING`: Provider failure with error details, fallback activation
- `WARNING`: Quota exhaustion detected (one-time per process)
- `ERROR`: All providers exhausted

Existing logging in `web_search` already follows this pattern.

---

## 6. Estimated Complexity

| Aspect | Estimate |
|--------|----------|
| **Files modified** | 2 (`backend/src/tools/search.py`, `backend/src/constants/__init__.py`) |
| **Files optionally modified** | 1 (`frontend/src/components/tools/SearchEngine.tsx` -- add optional chaining on `engines`) |
| **New dependencies** | 1 (`exa-py` in `pyproject.toml`) |
| **Lines of code** | ~80-100 new lines (helper + normalizer + constants + flag logic) |
| **Risk level** | Low -- follows existing patterns exactly, no architectural changes |
| **Estimated effort** | 2-4 hours for implementation + testing |
| **Breaking changes** | None -- additive only; existing SearXNG/Tavily paths preserved |

---

## 7. Summary of Changes

1. **Add** `EXA_API_KEY` to constants
2. **Add** `_search_with_exa()` helper + `_normalize_exa_results()` normalizer
3. **Add** `_is_exa_quota_error()` classifier + module-level circuit breaker flag
4. **Reorder** `web_search` phases: Exa -> SearXNG -> Tavily -> empty
5. **Update** `_normalize_tavily_results()` to include `engines` field
6. **Add** `exa-py` to project dependencies
7. **(Optional)** Add `result.engines?.map(...)` optional chaining in `SearchEngine.tsx`
