# Proposal: Exa Primary Search with SearXNG Fallback

## 1. Executive Summary

Replace the current SearXNG-primary/Tavily-fallback search chain with Exa-primary/SearXNG-fallback. Both providers must normalize output to the same format consumed by the frontend `SearchEngineTool` component, which expects an array of `{ title, link, snippet, engines[] }` objects.

## 2. Architectural Analysis

### Current State

**Backend (`backend/src/tools/search.py`):**
- `web_search` tool uses a two-phase fallback: SearXNG (primary) -> Tavily (secondary).
- SearXNG returns results with `{ title, link, snippet, engines, ... }` natively via `SearxSearchWrapper`.
- Tavily results are normalized via `_normalize_tavily_results()` to `{ title, link, snippet, score, source }`.
- Provider selection is driven by env vars: `SEARX_SEARCH_HOST_URL` and `TAVILY_API_KEY` (from `backend/src/constants/__init__.py`).

**Frontend (`frontend/src/components/tools/SearchEngine.tsx`):**
- Parses `message.content` as JSON array.
- Renders each result using: `result.title`, `result.link`, `result.snippet`, `result.engines` (mapped to badge chips).
- Falls back to `MarkdownCard` if JSON parse fails.
- Routed via `ToolTimelineItem.tsx` for tool names `search_engine` and `web_search`.

**Key observation:** The frontend **requires** `engines` as an array of strings on each result. The Tavily normalizer currently does NOT include `engines`, meaning Tavily results would crash the `engines.map()` call in the frontend. This is a pre-existing bug.

### No Exa Code Exists

There is zero Exa integration in the codebase today. This is a greenfield addition for the Exa provider.

## 3. Implementation Strategy

### Step 1: Add Exa dependency and env var

**File: `backend/pyproject.toml`** (or equivalent)
- Add `exa-py` package.

**File: `backend/src/constants/__init__.py`**
- Add `EXA_API_KEY` to `UserTokenKey` enum.
- Add `EXA_API_KEY = os.getenv(UserTokenKey.EXA_API_KEY.value)` module-level constant.

### Step 2: Implement Exa search helper

**File: `backend/src/tools/search.py`**

Add `_search_with_exa()` function following the existing pattern:

```python
async def _search_with_exa(
    query: str,
    num_results: int,
    api_key: str,
) -> tuple[list, Exception | None]:
    try:
        from exa_py import Exa

        exa = Exa(api_key=api_key)
        response = exa.search(
            query=query,
            num_results=num_results,
            use_autoprompt=True,
        )
        results = _normalize_exa_results(response)
        return results, None
    except Exception as e:
        return [], e
```

Add normalizer:

```python
def _normalize_exa_results(exa_response) -> list:
    normalized = []
    for item in exa_response.results:
        normalized.append({
            "title": item.title or "",
            "link": item.url or "",
            "snippet": item.text or item.highlights[0] if item.highlights else "",
            "engines": ["exa"],
            "score": item.score if hasattr(item, "score") else 0.0,
            "source": "exa",
        })
    return normalized
```

### Step 3: Update fallback chain in `web_search`

**File: `backend/src/tools/search.py`**

Change the `web_search` function body to:

```
Phase 1: Try Exa (if EXA_API_KEY is set)
Phase 2: Fallback to SearXNG (if SEARX_SEARCH_HOST_URL is set)
Phase 3: Fallback to Tavily (if TAVILY_API_KEY is set)  [optional, keep for resilience]
Phase 4: All providers exhausted -> return []
```

The `engines` and `categories` parameters only apply to SearXNG. For Exa, they are ignored (Exa has its own search types but they don't map 1:1).

### Step 4: Fix Tavily normalizer (pre-existing bug)

**File: `backend/src/tools/search.py`**

In `_normalize_tavily_results`, add `"engines": ["tavily"]` to each result dict so the frontend doesn't crash.

### Step 5: Fix SearXNG normalizer consistency (optional)

SearXNG results already include `engines` natively (as a list of engine names like `["google", "bing"]`). No change needed, but add `"source": "searxng"` for traceability if desired.

### Step 6: No frontend changes required

The frontend `SearchEngine.tsx` already handles the format correctly as long as every result has `{ title, link, snippet, engines[] }`. No frontend modifications needed.

## 4. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Exa as primary | Yes | Exa provides higher quality semantic search results; use while free tier lasts |
| SearXNG as fallback | Yes | Self-hosted, no API limits, always available |
| Keep Tavily as tertiary | Yes | Defense in depth; costs nothing if unused |
| Sync vs Async Exa client | Use sync `exa.search()` wrapped in `asyncio.to_thread` | `exa-py` SDK is synchronous; wrapping avoids blocking the event loop |
| Normalize all providers to same format | Yes | Single contract for frontend; `engines` array is required by UI |
| Exa error = fallback, not crash | Yes | Match existing pattern: return `([], error)` tuple |
| `engines` and `categories` params | Pass through to SearXNG only; ignore for Exa | Exa has different taxonomy; forcing mapping would be fragile |

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Exa free tier exhaustion is silent (no clear error) | Medium | Catch Exa 429/402 errors specifically and log them; fallback handles it |
| `exa-py` SDK is sync-only | Low | Wrap in `asyncio.to_thread()` |
| Exa result format may lack `text`/`highlights` | Low | Use defensive `.get()` / `getattr()` with fallbacks |
| Exa `search()` vs `search_and_contents()` | Medium | `search()` alone may not return snippets; may need `search_and_contents()` with `highlights=True` for snippet data |
| Pre-existing bug: Tavily results missing `engines` field | High | Fix in this PR (Step 4) |
| Rate limiting differences between providers | Low | Existing `num_results` cap applies uniformly |

## 6. Estimated Complexity

| Dimension | Assessment |
|-----------|------------|
| Files changed | 2 (`search.py`, `constants/__init__.py`) + `pyproject.toml` |
| New dependencies | 1 (`exa-py`) |
| Lines of code | ~60-80 new lines |
| Frontend changes | 0 (bug fix for Tavily `engines` is backend-only) |
| Risk level | Low-Medium |
| Estimated effort | 2-4 hours |
| Testing | Manual: verify Exa results render in UI; verify fallback triggers when Exa key is missing/invalid |
