# Proposal: BUG #612 - web_scrape cannot fetch plain/text pages

## 1. Executive Summary

The `web_scrape` tool fails on any URL returning `text/plain` content because `fetch_html()` in `backend/src/tools/search.py` explicitly rejects non-HTML content types with a `ValueError`. The fix is to detect textual content types and bypass HTML-to-markdown conversion for plain text responses, returning the text content directly (wrapped in a markdown code block for consistency).

## 2. Architectural Analysis

### Current State

The scraping pipeline in `backend/src/tools/search.py` flows as:

```
web_scrape() -> urls_to_markdown() -> url_to_markdown() -> fetch_html() -> html_to_markdown()
```

The bug is on **line 94** of `search.py`:

```python
if ("text/html" not in ctype) and ("application/xhtml+xml" not in ctype):
    raise ValueError(f"Non-HTML content-type: {ctype or 'unknown'}")
```

This guard was intentionally added to reject binary content (PDFs, images, etc.), but it also rejects legitimate textual content like `text/plain`, `text/xml`, `text/csv`, `application/json`, and `application/xml`.

### Proposed Changes

Modify the fetch layer to distinguish between three content categories:

1. **HTML content** (`text/html`, `application/xhtml+xml`) -- existing path, convert via `markdownify`
2. **Plain text content** (`text/plain`, `text/csv`, `text/xml`, `application/json`, `application/xml`, etc.) -- new path, return as-is or in a fenced code block
3. **Binary content** (everything else) -- existing path, reject with `ValueError`

### Integration Points

- **Single file change**: `backend/src/tools/search.py`
- No schema changes, no API route changes, no database changes
- The `Accept` header (line 150) should be updated to express willingness to accept `text/plain`

## 3. Implementation Strategy

### Step 1: Rename `fetch_html` to `fetch_url_content` and return a tagged result

Replace the single function with one that returns both the content and a flag indicating whether it is HTML or plain text.

```python
from dataclasses import dataclass

@dataclass
class FetchResult:
    content: str
    is_html: bool
```

### Step 2: Update content-type gate in the fetch function

```python
TEXTUAL_TYPES = ("text/", "application/json", "application/xml", "application/xhtml+xml")

async def fetch_url_content(client: httpx.AsyncClient, url: str) -> FetchResult:
    r = await client.get(url)
    r.raise_for_status()

    ctype = (r.headers.get("content-type") or "").lower()
    is_html = ("text/html" in ctype) or ("application/xhtml+xml" in ctype)
    is_textual = any(t in ctype for t in TEXTUAL_TYPES)

    if not is_textual:
        raise ValueError(f"Non-text content-type: {ctype or 'unknown'}")

    data = r.content
    if looks_binary(data):
        raise ValueError("Response looks binary/compressed; refusing to decode as text")

    text = str(from_bytes(data).best())
    return FetchResult(content=strip_control_chars(text), is_html=is_html)
```

### Step 3: Update `url_to_markdown` to branch on content type

```python
async def url_to_markdown(client, url, sem):
    try:
        async with sem:
            result = await fetch_url_content(client, url)
            if result.is_html:
                md_text = await html_to_markdown(result.content)
            else:
                # Wrap plain text in a fenced code block for readability
                md_text = f"```\n{result.content}\n```"
            return url, md_text
    except Exception as e:
        return url, e
```

### Step 4: Update the `Accept` header

```python
"Accept": "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.8",
```

### Step 5: Add unit tests

Create `backend/tests/unit/tools/test_search_scrape.py`:

- Test that `text/plain` responses are returned wrapped in a code block
- Test that `text/html` responses still go through markdownify
- Test that `application/pdf` responses are rejected
- Test that binary payloads are rejected regardless of content-type header
- Test that `application/json` responses are accepted as textual content

## 4. Design Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Plain text wrapping | Fenced code block | Raw text | Maintains markdown consistency; agents downstream expect markdown |
| Textual type detection | Prefix match on `text/` + allow-list | Strict allow-list only | `text/*` is a broad MIME family that is always textual by definition |
| Return type | `FetchResult` dataclass | Tuple `(str, bool)` | More readable, extensible if we later add content-type metadata |
| Scope of text types | `text/*` + `application/json` + `application/xml` | Only `text/plain` | Minimal extra cost, significantly broader coverage for common use cases |

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Very large plain text files (e.g., logs) could overwhelm LLM context | Medium | Add a max content length truncation (e.g., 100KB) with a truncation notice |
| Some servers misreport content-type | Low | The existing `looks_binary()` heuristic catches this |
| `application/json` may contain large API responses | Low | Same truncation mitigation as above |
| Breaking change to existing behavior | Very Low | Only previously-failing URLs now succeed; no existing success paths change |

### Edge Cases

- URLs returning `text/plain; charset=utf-8` (content-type with parameters) -- handled by substring match
- Empty responses -- `looks_binary()` returns `False` for empty data, will return empty string (acceptable)
- Encoded content (gzip) -- httpx handles `Content-Encoding` decompression automatically

## 6. Estimated Complexity

| Dimension | Rating |
|-----------|--------|
| **Scope** | Small -- single file change + new test file |
| **Risk Level** | Low -- additive change, no existing behavior modified |
| **Effort** | 1-2 hours |
| **Priority** | High -- this is a user-facing bug blocking a core tool capability |

### Implementation Order

1. Add `FetchResult` dataclass and `TEXTUAL_TYPES` constant
2. Refactor `fetch_html` to `fetch_url_content` with broadened content-type handling
3. Update `url_to_markdown` branching logic
4. Update `Accept` header
5. Add content length truncation safety valve
6. Write unit tests
7. Run `make format` and `make test`

### Files Changed

| File | Change Type |
|------|-------------|
| `backend/src/tools/search.py` | Modified (core fix) |
| `backend/tests/unit/tools/test_search_scrape.py` | New (tests) |
