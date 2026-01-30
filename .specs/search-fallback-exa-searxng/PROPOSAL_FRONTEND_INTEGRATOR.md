# Proposal: Frontend Integration for Unified Search Results (Exa/SearXNG/Tavily)

**Author:** AGENT_4 — FRONTEND_INTEGRATOR
**Date:** 2026-01-29

---

## 1. Executive Summary

The `SearchEngineTool` component in the frontend expects a JSON array of objects with `title`, `link`, `snippet`, and `engines` fields. SearXNG results natively include `engines`, but Tavily (the current fallback) normalizes to `source` instead. The frontend will crash on `.engines.map()` when rendering Tavily results because `engines` is undefined. A small defensive change in the frontend component and a minor backend normalization fix will ensure all providers render identically.

## 2. Frontend Component Analysis

### SearchEngineTool (`frontend/src/components/tools/SearchEngine.tsx`)

The component:
1. Receives `selectedToolMessage` (typed as `any`) with a `content` string property
2. Parses `content` as JSON — expects a **JSON array**
3. For each result object, renders:
   - `result.title` — as a clickable link
   - `result.link` — as the `href`
   - `result.snippet` — as description text
   - `result.engines` — mapped with `.map()` to render engine badges

**Critical fields the component reads:**

| Field | Usage | Required |
|-------|-------|----------|
| `title` | Link text | Yes |
| `link` | `<a href>` | Yes |
| `snippet` | Description paragraph | Yes |
| `engines` | Array iterated with `.map()` | **Yes — will throw if missing** |

### ToolTimelineItem routing (`frontend/src/components/timeline/ToolTimelineItem.tsx`)

Line 46: Both `search_engine` and `web_search` tool names route to `SearchEngineTool`:
```ts
if (["search_engine", "web_search"].includes(message.name)) {
    return {
        element: <SearchEngineTool selectedToolMessage={message} />,
        hasOwnScroll: true,
    };
}
```

The `ToolMessage` interface defines `content: string`, which gets passed as `selectedToolMessage.content`.

## 3. Data Flow

```
Backend (web_search tool)
  -> returns list[dict] from SearXNG or Tavily
  -> LangGraph serializes as ToolMessage.content (JSON string)
  -> SSE stream sends to frontend as MessagesEvent / ValuesEvent
  -> ToolTimelineItem receives message with name="web_search"
  -> Routes to SearchEngineTool
  -> JSON.parse(content) -> renders each result
```

### Provider Output Formats

**SearXNG** (via `SearxSearchWrapper.aresults`):
```json
{
  "title": "Example",
  "link": "https://example.com",
  "snippet": "Description text",
  "engines": ["google", "duckduckgo"],
  "category": "general"
}
```

**Tavily** (after `_normalize_tavily_results`):
```json
{
  "title": "Example",
  "link": "https://example.com",
  "snippet": "Description text",
  "score": 0.95,
  "source": "tavily"
}
```

**The problem:** Tavily normalized results have `source` (a string) but no `engines` (an array). The frontend calls `result.engines.map(...)` which will throw `TypeError: Cannot read properties of undefined`.

## 4. Required Changes

### Change 1 (Backend — Recommended): Add `engines` to Tavily normalization

In `backend/src/tools/search.py`, function `_normalize_tavily_results`:

```python
# Current
normalized.append({
    "title": item.get("title", ""),
    "link": item.get("url", ""),
    "snippet": item.get("content", ""),
    "score": item.get("score", 0.0),
    "source": "tavily",
})

# Proposed
normalized.append({
    "title": item.get("title", ""),
    "link": item.get("url", ""),
    "snippet": item.get("content", ""),
    "engines": ["tavily"],       # <-- ADD THIS
    "score": item.get("score", 0.0),
    "source": "tavily",
})
```

### Change 2 (Frontend — Defensive): Guard against missing `engines`

In `frontend/src/components/tools/SearchEngine.tsx`, replace the engines rendering block (lines 32-42):

```tsx
// Current (crashes if engines is undefined)
{result.engines.map((engine: string, engineIndex: number) => (...))}

// Proposed (defensive)
{(result.engines ?? (result.source ? [result.source] : [])).map(
    (engine: string, engineIndex: number) => (
        <span key={engineIndex} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {engine}
        </span>
    ),
)}
```

This ensures:
- SearXNG results: use `engines` array as-is
- Tavily results: fall back to `[result.source]` if `engines` is missing
- Unknown providers: render no badges (empty array)

### Change 3 (Frontend — Optional): Add TypeScript interface

Replace `any` typing with a proper interface:

```tsx
interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    engines?: string[];
    source?: string;
    score?: number;
    category?: string;
}
```

## 5. Type Safety

### Current State
- `SearchEngineTool` props typed as `{ selectedToolMessage: any }` — no type safety
- `ToolMessage` in `ToolTimelineItem.tsx` defines `content: string` but no further structure
- No shared interface for search result shape

### Recommended Types

```typescript
// frontend/src/lib/entities/search.ts (new file)

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    engines?: string[];    // SearXNG native field
    source?: string;       // Tavily/Exa provider identifier
    score?: number;        // Tavily relevance score
    category?: string;     // SearXNG category
}

export type SearchResults = SearchResult[];
```

Update `SearchEngineTool` to use this type for the parsed JSON array.

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `engines.map()` crash on Tavily results | **HIGH** — Runtime error, component fails to render | Backend Change 1 + Frontend Change 2 |
| SearXNG results missing `engines` field | LOW — unlikely but possible on edge-case queries | Frontend Change 2 (defensive guard) |
| `content` is not valid JSON | LOW — already handled by try/catch falling back to `MarkdownCard` | No change needed |
| Empty results array `[]` | LOW — renders nothing, no crash | No change needed |
| Backward compatibility | NONE — changes are additive; existing SearXNG results unchanged | N/A |

### Priority

1. **Backend Change 1** — Ensures Tavily output matches expected schema. Simple one-line addition.
2. **Frontend Change 2** — Defensive guard prevents crashes regardless of backend provider. Essential.
3. **Frontend Change 3** — Type safety improvement. Nice-to-have, not blocking.

### Note on "Exa" in the Feature Description

The codebase currently uses **Tavily** as the fallback provider (not Exa). The `_normalize_tavily_results` function and `_search_with_tavily` helper confirm this. If Exa is intended as a future or replacement provider, the same normalization pattern should be applied: ensure output includes `title`, `link`, `snippet`, and `engines` fields. The frontend changes proposed here are provider-agnostic and will work with any provider that follows this schema.
