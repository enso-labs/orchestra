# PROPOSAL: Bug #612 - web_scrape Cannot Fetch text/plain Pages

**Author:** AGENT_2 (API_GUARDIAN)
**Date:** 2026-01-31
**Status:** DRAFT

---

## 1. Executive Summary

The `web_scrape` tool's `fetch_html` function explicitly rejects any response whose `Content-Type` is not `text/html` or `application/xhtml+xml`, causing all `text/plain` URLs (and other text-based content types like `application/json`, `text/xml`, `text/csv`) to fail with a `ValueError`. The fix requires broadening the content-type gate in `fetch_html` to accept text-based responses and routing them through an appropriate conversion path instead of forcing everything through the HTML-to-Markdown pipeline.

## 2. Architectural Analysis

### 2.1 Current State

The scraping pipeline lives entirely in `backend/src/tools/search.py` and follows this flow:

```
web_scrape(urls)
  -> urls_to_markdown(urls)
    -> url_to_markdown(client, url, sem)   [per URL, concurrency-limited]
      -> fetch_html(client, url)           [HTTP fetch + content-type gate]
      -> html_to_markdown(html)            [markdownify conversion]
```

**The bug is at line 94 of `search.py`:**

```python
if ("text/html" not in ctype) and ("application/xhtml+xml" not in ctype):
    raise ValueError(f"Non-HTML content-type: {ctype or 'unknown'}")
```

This is a hard reject. Any `text/plain`, `application/json`, `text/xml`, `text/csv`, or similar text-based content type triggers a `ValueError` that gets caught by `url_to_markdown` and rendered as an error block in the output.

The error message shown to the LLM agent is misleading: it says "This often happens when the URL returns a PDF/image, or the payload is compressed/binary" -- but the actual cause is a plain text page.

### 2.2 Proposed Changes

Rename `fetch_html` to `fetch_content` (or keep the name but change its semantics) and return a tuple of `(content_string, content_type)`. Then in `url_to_markdown`, branch on the content type:

- **HTML/XHTML**: existing path through `html_to_markdown`
- **text/plain**: wrap in a markdown code block or return as-is (already readable)
- **application/json**: pretty-print and wrap in a fenced code block
- **text/xml, text/csv, etc.**: wrap in a fenced code block with language hint
- **Binary types**: reject as today

This keeps the API contract of `web_scrape` unchanged -- it still returns `str` (markdown-formatted content). No schema changes needed. No route changes needed. The tool signature and return type are preserved.

### 2.3 Integration Points

| Component | Impact |
|-----------|--------|
| `backend/src/tools/search.py` | Primary change location. `fetch_html`, `url_to_markdown`, `urls_to_markdown` |
| `backend/src/loaders/__init__.py` | No change needed. The `Loader` class uses `WebBaseLoader` for `web_scrape` which is a separate code path (document ingestion, not the tool) |
| `backend/src/schemas/examples/__init__.py` | No change needed. Example schema is unaffected |
| API consumers (LLM agents) | No breaking change. Output is still markdown `str`. Agents will now receive content instead of error blocks for text URLs |

## 3. Implementation Strategy

### Step 1: Refactor `fetch_html` to `fetch_content`

**File:** `backend/src/tools/search.py`

Replace the content-type gate with an allowlist of text-based types and return a typed result:

```python
from dataclasses import dataclass

@dataclass
class FetchResult:
    """Result of fetching a URL."""
    text: str
    content_type: str  # simplified: "html", "plain", "json", "xml", "other_text"

ALLOWED_TEXT_TYPES = {
    "text/html": "html",
    "application/xhtml+xml": "html",
    "text/plain": "plain",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/csv": "csv",
    "text/markdown": "markdown",
    "application/rss+xml": "xml",
    "application/atom+xml": "xml",
}

async def fetch_content(client: httpx.AsyncClient, url: str) -> FetchResult:
    r = await client.get(url)
    r.raise_for_status()

    ctype = (r.headers.get("content-type") or "").lower()
    data = r.content

    if looks_binary(data):
        raise ValueError("Response looks binary/compressed; refusing to decode as text")

    # Match against allowed types
    matched_type = None
    for type_prefix, category in ALLOWED_TEXT_TYPES.items():
        if type_prefix in ctype:
            matched_type = category
            break

    # Fallback: if content-type starts with "text/", allow it
    if matched_type is None and ctype.startswith("text/"):
        matched_type = "plain"

    if matched_type is None:
        raise ValueError(f"Non-text content-type: {ctype or 'unknown'}")

    html = str(from_bytes(data).best())
    return FetchResult(text=strip_control_chars(html), content_type=matched_type)
```

### Step 2: Update `url_to_markdown` to branch on content type

```python
async def content_to_markdown(result: FetchResult) -> str:
    """Convert fetched content to markdown based on its type."""
    if result.content_type == "html":
        return await html_to_markdown(result.text)
    elif result.content_type == "markdown":
        return clean_markdown(result.text)
    elif result.content_type in ("json", "xml", "csv"):
        lang = result.content_type
        return clean_markdown(f"```{lang}\n{result.text}\n```")
    else:
        # text/plain and other text types
        return clean_markdown(result.text)


async def url_to_markdown(
    client: httpx.AsyncClient,
    url: str,
    sem: asyncio.Semaphore,
) -> Tuple[str, Union[str, Exception]]:
    try:
        async with sem:
            result = await fetch_content(client, url)
            md_text = await content_to_markdown(result)
            return url, md_text
    except Exception as e:
        return url, e
```

### Step 3: Update the `Accept` header

In `urls_to_markdown`, broaden the `Accept` header to signal willingness to receive text content:

```python
"Accept": "text/html,application/xhtml+xml,text/plain,application/json,application/xml,text/xml,*/*;q=0.5",
```

### Step 4: Update error tip message

In `urls_to_markdown`, update the error tip from the current misleading message to:

```python
"> Tip: This often happens when the URL returns binary content "
"> (PDF, image, etc.) or the server blocks automated requests."
```

### Step 5: Add tests

**File:** `backend/tests/unit/tools/test_web_scrape.py` (new)

Test cases:
1. `text/html` response -- existing behavior preserved, HTML converted to markdown
2. `text/plain` response -- plain text returned as-is (cleaned)
3. `application/json` response -- JSON wrapped in fenced code block
4. `text/xml` response -- XML wrapped in fenced code block
5. `image/png` response -- raises ValueError
6. Binary payload with `text/html` header -- raises ValueError (binary detection)
7. Missing `Content-Type` header -- raises ValueError
8. `text/plain; charset=utf-8` (with params) -- correctly matched as plain

## 4. Design Decisions

### Decision 1: Return dataclass vs. tuple from fetch

**Chosen:** `FetchResult` dataclass
**Alternative:** Return `Tuple[str, str]`
**Rationale:** Named fields are clearer and extensible (could add `status_code`, `url` later). Minimal overhead.

### Decision 2: Plain text rendering -- raw vs. code block

**Chosen:** Return plain text as-is (not in a code block)
**Alternative:** Wrap in triple-backtick code block
**Rationale:** Plain text is already readable by LLM agents. Wrapping in a code block would add noise and prevent the agent from treating it as natural language. JSON/XML/CSV are wrapped because the language hint aids parsing.

### Decision 3: Allowlist vs. blocklist for content types

**Chosen:** Allowlist of known text types + fallback for `text/*`
**Alternative:** Block only known binary types
**Rationale:** Allowlist is safer. Unknown types like `application/octet-stream` could be binary. The `text/*` fallback handles edge cases like `text/calendar` gracefully.

### Decision 4: No schema or route changes

**Chosen:** Keep `web_scrape` tool signature and return type identical
**Rationale:** The tool returns `str` (markdown). This is a pure implementation fix, not an API contract change. LLM agents calling `web_scrape` need zero changes.

## 5. Risk Assessment

### Pitfalls

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large plain text files (e.g., log dumps) producing huge output | Medium | Consider adding a max content length truncation (e.g., 100KB) with a note that content was truncated |
| Servers returning `text/plain` for binary content (misconfigured) | Low | The `looks_binary` check already handles this |
| Breaking existing HTML scraping behavior | High | Ensure HTML path is unchanged; the refactor only adds branches, does not modify the HTML flow |
| `charset_normalizer` failing on some plain text encodings | Low | Already used today for HTML; same risk profile |

### Edge Cases

- **No Content-Type header**: Treated as unknown, rejected. Could optionally attempt binary detection and treat as plain text if it passes, but safer to reject.
- **`text/plain` with HTML inside**: Will be returned as plain text, not parsed as HTML. This is correct -- respect the server's declared content type.
- **Redirects changing content type**: Already handled by `follow_redirects=True` in httpx; the final response's content type is checked.
- **Empty response body**: Returns empty string after cleaning. Not harmful.

## 6. Estimated Complexity

| Dimension | Assessment |
|-----------|------------|
| **Scope** | Small. One file changed (`search.py`), one test file added. ~60 lines of new/modified code. |
| **Risk Level** | Low. The change is additive -- existing HTML path is preserved. No schema, route, or database changes. |
| **Priority Order** | 1. Refactor `fetch_html` to `fetch_content` with `FetchResult` dataclass |
|  | 2. Add `content_to_markdown` branching function |
|  | 3. Update `url_to_markdown` to use new functions |
|  | 4. Update `Accept` header and error messages |
|  | 5. Write unit tests |

**Estimated effort:** 1-2 hours for implementation + tests.

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `backend/src/tools/search.py` | Modify: `fetch_html` -> `fetch_content`, add `FetchResult`, add `content_to_markdown`, update `url_to_markdown`, update `Accept` header, update error tip |
| `backend/tests/unit/tools/test_web_scrape.py` | New: unit tests for all content type scenarios |
