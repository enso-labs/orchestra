# Proposal: Schema Unifier -- Exa + SearXNG Unified Search Output

## 1. Executive Summary

Both Exa and SearXNG must produce identical output consumed by the frontend `SearchEngineTool` component. The frontend expects a JSON array of objects with `title`, `link`, `snippet`, and `engines` fields. A thin normalization layer per provider will map each provider's native response to this canonical format, requiring minimal frontend changes.

## 2. Current Schema Analysis

### 2.1 Frontend Expectations (`SearchEngine.tsx`)

The component at `/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/tools/SearchEngine.tsx` parses `selectedToolMessage.content` as JSON and renders each result expecting:

```typescript
{
  title: string;    // Rendered as clickable link text
  link: string;     // Used as href for the anchor tag
  snippet: string;  // Displayed as description text
  engines: string[];// Rendered as pill badges (e.g., "google", "exa")
}
```

If JSON parsing fails, it falls back to rendering raw markdown via `MarkdownCard`.

### 2.2 SearXNG Output Format (Current Primary Provider)

LangChain's `SearxSearchWrapper.aresults()` returns a list of dicts:

```python
{
  "title": str,
  "link": str,          # URL of the result
  "snippet": str,       # Text excerpt
  "engines": [str],     # e.g., ["google", "duckduckgo"]
  "category": str,      # e.g., "general"
  # possibly other fields: score, parsed_url, etc.
}
```

This matches the frontend expectations exactly -- `title`, `link`, `snippet`, `engines` are all present.

### 2.3 Tavily Output Format (Current Fallback)

The existing `_normalize_tavily_results()` in `search.py` maps Tavily output to:

```python
{
  "title": str,
  "link": str,       # mapped from url
  "snippet": str,    # mapped from content
  "score": float,
  "source": "tavily"
}
```

**Problem:** This normalized format is missing `engines` -- the frontend will crash on `result.engines.map(...)` since `engines` is undefined. This is a pre-existing bug.

### 2.4 Exa Output Format (Not Yet Implemented)

The Exa Python SDK (`exa_py`) returns `SearchResult` objects with:

```python
{
  "title": str,
  "url": str,           # Note: "url" not "link"
  "published_date": str | None,
  "author": str | None,
  "score": float,
  "text": str | None,        # If contents requested
  "highlights": [str] | None, # If highlights requested
  "summary": str | None,      # If summary requested
}
```

Key differences from the frontend contract:
- Uses `url` instead of `link`
- Has no `snippet` field -- closest equivalent is `highlights[0]`, `summary`, or `text` (truncated)
- Has no `engines` field

## 3. Unified Schema Design

The canonical search result format that ALL providers must produce:

```python
# backend/src/schemas/entities/search.py (proposed)
from pydantic import BaseModel
from typing import List, Optional

class SearchResult(BaseModel):
    """Canonical search result format consumed by the frontend."""
    title: str
    link: str                    # URL of the result
    snippet: str                 # Short text excerpt/description
    engines: List[str]           # Provider identifiers, e.g. ["exa"], ["google"]
    score: Optional[float] = None  # Relevance score (provider-specific, optional)
    source: Optional[str] = None   # Provider name for debugging ("exa", "searxng", "tavily")
```

This is the **minimum viable contract**. The `engines` field is required because the frontend iterates over it unconditionally.

## 4. Mapping Strategy

### 4.1 SearXNG -> Unified (No Change Needed)

SearXNG already returns `title`, `link`, `snippet`, and `engines`. Pass through as-is. Optionally add `source: "searxng"`.

### 4.2 Exa -> Unified

```python
def _normalize_exa_results(exa_results: list) -> list:
    normalized = []
    for item in exa_results:
        snippet = ""
        if item.highlights:
            snippet = item.highlights[0]
        elif item.summary:
            snippet = item.summary
        elif item.text:
            snippet = item.text[:300]

        normalized.append({
            "title": item.title or "",
            "link": item.url or "",
            "snippet": snippet,
            "engines": ["exa"],
            "score": item.score,
            "source": "exa",
        })
    return normalized
```

**Important:** When calling Exa search, request `highlights` or `summary` in the `contents` parameter to ensure we get snippet-quality text. Without this, `text` may be very long or absent.

### 4.3 Tavily -> Unified (Fix Existing Bug)

The existing `_normalize_tavily_results()` must be updated to include `engines`:

```python
def _normalize_tavily_results(tavily_response: dict) -> list:
    normalized = []
    for item in tavily_response.get("results", []):
        normalized.append({
            "title": item.get("title", ""),
            "link": item.get("url", ""),
            "snippet": item.get("content", ""),
            "engines": ["tavily"],         # <-- ADD THIS
            "score": item.get("score", 0.0),
            "source": "tavily",
        })
    return normalized
```

### 4.4 Provider Priority in `web_search`

The updated fallback chain should be:

1. **Exa** (primary) -- use `EXA_API_KEY` env var
2. **SearXNG** (first fallback) -- use `SEARX_SEARCH_HOST_URL`
3. **Tavily** (second fallback) -- use `TAVILY_API_KEY`

```python
async def web_search(query, num_results=5, engines=["google"], categories=["general"]):
    # Phase 1: Exa (primary)
    if EXA_API_KEY:
        results, err = await _search_with_exa(query, num_results, EXA_API_KEY)
        if results:
            return results
        if err:
            logger.warning(f"[Exa] Search failed: {err}")

    # Phase 2: SearXNG (fallback)
    if SEARX_SEARCH_HOST_URL:
        results, err = await _search_with_searx(query, num_results, ...)
        if results:
            return results
        if err:
            logger.warning(f"[SearXNG] Search failed: {err}")

    # Phase 3: Tavily (last resort)
    if TAVILY_API_KEY:
        results, err = await _search_with_tavily(query, num_results, TAVILY_API_KEY)
        if results:
            return results

    # Phase 4: No providers
    ...
```

## 5. Frontend Compatibility

### 5.1 Current State

The `SearchEngine.tsx` component accesses `result.engines.map(...)` unconditionally. If `engines` is missing or not an array, this crashes and the catch block renders raw markdown instead.

### 5.2 Required Changes

**Minimal (backend-only):** If all providers reliably return `engines: [str]`, no frontend changes are needed. This is the recommended approach.

**Defensive (recommended):** Add a null guard in the frontend for robustness:

```tsx
// Replace:
{result.engines.map(...)}

// With:
{(result.engines ?? []).map(...)}
```

This is a one-line change that protects against any future provider that might omit `engines`.

### 5.3 No Structural Changes Needed

The frontend does not need new fields, new components, or layout changes. The unified schema is fully compatible with the existing rendering logic.

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Exa `highlights` empty when not requested | **High** | Always pass `contents={"highlights": True}` in Exa search call |
| Exa free tier rate limit / quota exhaustion | **Medium** | Fallback chain handles this -- if Exa returns error, SearXNG takes over |
| Tavily missing `engines` field (existing bug) | **Medium** | Fix in `_normalize_tavily_results` -- add `"engines": ["tavily"]` |
| Exa `url` vs SearXNG `link` field name mismatch | **High** | Normalization function maps `url` -> `link` |
| Exa score range differs from other providers | **Low** | Score is optional/informational only, not used by frontend |
| Type safety: no Pydantic validation on output | **Low** | Consider adding `SearchResult` Pydantic model for validation, but not strictly required since LangChain tools return raw dicts |
| Frontend crash on missing `engines` | **Medium** | Add `?? []` guard in `SearchEngine.tsx` |

## 7. Files to Modify

| File | Change |
|------|--------|
| `backend/src/constants/__init__.py` | Add `EXA_API_KEY` env var |
| `backend/src/tools/search.py` | Add `_search_with_exa()`, `_normalize_exa_results()`, update `web_search()` fallback chain, fix `_normalize_tavily_results()` to include `engines` |
| `frontend/src/components/tools/SearchEngine.tsx` | Add `?? []` guard on `result.engines` |
| `backend/pyproject.toml` | Add `exa-py` dependency |

## 8. New Dependencies

- `exa-py` (Exa Python SDK) -- pip/uv installable, MIT licensed
