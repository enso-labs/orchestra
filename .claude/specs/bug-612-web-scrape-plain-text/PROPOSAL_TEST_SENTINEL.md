# PROPOSAL: Bug #612 - web_scrape Cannot Fetch plain/text Pages

**Agent:** TEST_SENTINEL
**Date:** 2026-01-31
**Branch:** development

---

## 1. Executive Summary

The `fetch_html` function in `backend/src/tools/search.py` (line 94) explicitly rejects any response whose `Content-Type` is not `text/html` or `application/xhtml+xml`, causing all `text/plain` URLs to fail with `ValueError: Non-HTML content-type`. The fix requires broadening content-type acceptance to include text-based types (especially `text/plain`) and routing them through an appropriate conversion path instead of the HTML-to-markdown pipeline. A comprehensive test suite for the scraping functions is entirely missing today and must be created alongside the fix.

---

## 2. Architectural Analysis

### 2.1 Current State

The scraping pipeline in `backend/src/tools/search.py` follows this call chain:

```
web_scrape(urls)
  -> urls_to_markdown(urls)
     -> url_to_markdown(client, url, sem)   [per URL, concurrently]
        -> fetch_html(client, url)           [fetches + validates]
        -> html_to_markdown(html)            [markdownify conversion]
```

**Key files:**
- `/home/ryaneggz/ruska-ai/orchestra/.worktrees/bug-612/backend/src/tools/search.py` -- all scraping logic lives here (lines 24-179)

**The bug (line 94):**
```python
if ("text/html" not in ctype) and ("application/xhtml+xml" not in ctype):
    raise ValueError(f"Non-HTML content-type: {ctype or 'unknown'}")
```

This guard was added to prevent binary content from being processed but is overly restrictive -- it blocks `text/plain`, `text/xml`, `application/json`, and other perfectly scrapable text formats.

**Existing test coverage for scraping: NONE.** The file `backend/tests/unit/tools/test_search.py` covers only `web_search` and its Tavily/SearXNG fallback logic. There are zero tests for `fetch_html`, `html_to_markdown`, `url_to_markdown`, `urls_to_markdown`, `web_scrape`, `clean_markdown`, `looks_binary`, or `strip_control_chars`.

### 2.2 Proposed Changes

1. **Rename `fetch_html` to `fetch_content`** (or add a new function) that accepts a whitelist of text-based content types.
2. **Branch conversion logic** based on content type:
   - `text/html`, `application/xhtml+xml` -> existing `html_to_markdown` path
   - `text/plain` -> wrap in a markdown code fence or return as-is after `clean_markdown`
   - `application/json`, `text/xml`, `text/csv` etc. -> wrap in appropriate code fence
   - Binary types -> reject as today
3. **Update `url_to_markdown`** to pass content type downstream so the correct converter is selected.

### 2.3 Integration Points

- `web_scrape` tool (line 469) -- no change needed, it delegates to `urls_to_markdown`.
- `Loader` class in `backend/src/loaders/__init__.py` -- uses `WebBaseLoader` for `web_scrape` loader type; this is a separate code path (LangChain loader) and is NOT affected by this bug.
- The `Accept` header in `urls_to_markdown` (line 150) already sends `*/*;q=0.8`, so servers will respond with `text/plain` when appropriate.

---

## 3. Implementation Strategy

### Step 1: Refactor `fetch_html` into `fetch_content`

**File:** `/home/ryaneggz/ruska-ai/orchestra/.worktrees/bug-612/backend/src/tools/search.py`

Replace the content-type guard at line 94 with a whitelist approach:

```python
TEXT_CONTENT_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "text/xml",
    "application/xml",
    "application/json",
    "text/csv",
    "text/markdown",
    "application/rss+xml",
    "application/atom+xml",
}

async def fetch_content(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    """
    Fetch textual content from a URL safely.
    Returns (decoded_text, content_type).
    """
    r = await client.get(url)
    r.raise_for_status()
    ctype = (r.headers.get("content-type") or "").lower()

    # Extract base content type (strip charset params)
    base_ctype = ctype.split(";")[0].strip()

    # Accept any text/* type plus known safe application types
    if not (base_ctype.startswith("text/") or base_ctype in TEXT_CONTENT_TYPES):
        raise ValueError(f"Non-text content-type: {ctype or 'unknown'}")

    data = r.content
    if looks_binary(data):
        raise ValueError("Response looks binary/compressed; refusing to decode as text")

    html = str(from_bytes(data).best())
    return strip_control_chars(html), base_ctype
```

### Step 2: Add content-type-aware conversion

```python
async def content_to_markdown(text: str, content_type: str) -> str:
    """Convert fetched content to markdown based on content type."""
    if content_type in ("text/html", "application/xhtml+xml"):
        return await html_to_markdown(text)
    elif content_type == "text/plain":
        return clean_markdown(text)
    elif content_type in ("application/json", "text/xml", "application/xml",
                          "application/rss+xml", "application/atom+xml"):
        lang = "json" if "json" in content_type else "xml"
        return f"```{lang}\n{text.strip()}\n```"
    elif content_type == "text/csv":
        return f"```csv\n{text.strip()}\n```"
    elif content_type == "text/markdown":
        return clean_markdown(text)
    else:
        return clean_markdown(text)
```

### Step 3: Update `url_to_markdown`

```python
async def url_to_markdown(client, url, sem):
    try:
        async with sem:
            text, ctype = await fetch_content(client, url)
            md_text = await content_to_markdown(text, ctype)
            return url, md_text
    except Exception as e:
        return url, e
```

### Step 4: Create comprehensive test file

**File:** `/home/ryaneggz/ruska-ai/orchestra/.worktrees/bug-612/backend/tests/unit/tools/test_web_scrape.py`

```python
"""
Unit tests for web_scrape / URL fetching and content conversion.

Tests cover:
- fetch_content with various content types (HTML, plain text, JSON, XML, binary)
- content_to_markdown routing for each content type
- clean_markdown normalization
- looks_binary heuristic
- strip_control_chars
- url_to_markdown error handling
- urls_to_markdown concurrent fetching with mixed results
- web_scrape tool integration
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.tools.search import (
    clean_markdown,
    looks_binary,
    strip_control_chars,
    # After refactor:
    # fetch_content,
    # content_to_markdown,
)


class TestStripControlChars:
    def test_preserves_newlines_and_tabs(self):
        assert strip_control_chars("hello\n\tworld") == "hello\n\tworld"

    def test_removes_null_bytes(self):
        assert strip_control_chars("hello\x00world") == "helloworld"

    def test_removes_other_control_chars(self):
        assert strip_control_chars("a\x01b\x02c") == "abc"


class TestLooksBinary:
    def test_empty_data_not_binary(self):
        assert looks_binary(b"") is False

    def test_plain_text_not_binary(self):
        assert looks_binary(b"Hello, world!\n") is False

    def test_html_not_binary(self):
        assert looks_binary(b"<html><body>Hello</body></html>") is False

    def test_binary_data_detected(self):
        data = bytes(range(256)) * 20
        assert looks_binary(data) is True

    def test_pdf_header_detected(self):
        assert looks_binary(b"%PDF-1.4\x00\x01\x02" + b"\x00" * 100) is True


class TestCleanMarkdown:
    def test_collapses_excessive_newlines(self):
        result = clean_markdown("a\n\n\n\nb")
        assert result == "a\n\nb"

    def test_strips_trailing_whitespace(self):
        result = clean_markdown("hello   \nworld  ")
        assert result == "hello\nworld"

    def test_normalizes_line_endings(self):
        result = clean_markdown("a\r\nb\rc")
        assert result == "a\nb\nc"


class TestFetchContent:
    """Tests for fetch_content (post-refactor)."""

    @pytest.mark.asyncio
    async def test_html_content_accepted(self):
        """text/html responses are accepted and returned."""
        # Mock httpx response with text/html
        pass  # Implementation after refactor

    @pytest.mark.asyncio
    async def test_plain_text_accepted(self):
        """text/plain responses are accepted and returned."""
        pass

    @pytest.mark.asyncio
    async def test_json_content_accepted(self):
        """application/json responses are accepted."""
        pass

    @pytest.mark.asyncio
    async def test_binary_content_rejected(self):
        """application/octet-stream is rejected with ValueError."""
        pass

    @pytest.mark.asyncio
    async def test_image_content_rejected(self):
        """image/png is rejected with ValueError."""
        pass

    @pytest.mark.asyncio
    async def test_binary_payload_rejected(self):
        """Even with text content-type, binary payload is rejected."""
        pass

    @pytest.mark.asyncio
    async def test_charset_in_content_type_handled(self):
        """Content-Type with charset parameter is parsed correctly."""
        pass


class TestContentToMarkdown:
    """Tests for content_to_markdown routing."""

    @pytest.mark.asyncio
    async def test_html_uses_markdownify(self):
        pass

    @pytest.mark.asyncio
    async def test_plain_text_returned_as_is(self):
        pass

    @pytest.mark.asyncio
    async def test_json_wrapped_in_code_fence(self):
        pass

    @pytest.mark.asyncio
    async def test_xml_wrapped_in_code_fence(self):
        pass

    @pytest.mark.asyncio
    async def test_csv_wrapped_in_code_fence(self):
        pass

    @pytest.mark.asyncio
    async def test_markdown_cleaned_and_returned(self):
        pass


class TestUrlToMarkdown:
    """Tests for url_to_markdown with error handling."""

    @pytest.mark.asyncio
    async def test_successful_fetch_returns_tuple(self):
        pass

    @pytest.mark.asyncio
    async def test_http_error_returns_exception(self):
        pass

    @pytest.mark.asyncio
    async def test_timeout_returns_exception(self):
        pass


class TestUrlsToMarkdown:
    """Tests for concurrent URL fetching."""

    @pytest.mark.asyncio
    async def test_mixed_success_and_failure(self):
        """Some URLs succeed, others fail; all are represented in output."""
        pass

    @pytest.mark.asyncio
    async def test_plain_text_url_included_in_output(self):
        """A text/plain URL produces content in the final markdown."""
        pass

    @pytest.mark.asyncio
    async def test_binary_url_produces_error_block(self):
        """A binary URL produces an error block, not a crash."""
        pass
```

### Step 5: Update existing test imports if `fetch_html` is renamed

No other files import `fetch_html` directly, so this is a clean rename.

---

## 4. Design Decisions

| Decision | Chosen Approach | Alternative | Rationale |
|----------|----------------|-------------|-----------|
| Content-type matching | Whitelist `text/*` + known safe types | Blacklist binary types | Whitelist is safer; unknown types are rejected by default |
| Plain text conversion | Return cleaned text directly | Wrap in code fence | Plain text is already readable; code fences add noise |
| JSON/XML conversion | Wrap in typed code fence | Parse and pretty-print | Code fence preserves original structure; parsing adds fragility |
| Function rename | `fetch_html` -> `fetch_content` | Keep name, change behavior | Name should reflect capability; avoids confusion |
| Return type change | Return `(text, content_type)` tuple | Add content_type to a dataclass | Tuple is minimal and sufficient; no new types needed |

---

## 5. Risk Assessment

### Pitfalls

1. **Servers returning wrong Content-Type.** Some servers report `text/html` for JSON APIs or vice versa. The current approach trusts the header, which is the pragmatic choice -- trying to detect content type from the body would be fragile.

2. **Very large plain text files.** No size limit exists currently. A `robots.txt` is small, but a server could return a 100MB log file as `text/plain`. Consider adding a max response size (already partially handled by httpx timeout, but not by byte count).

3. **Encoding issues with plain text.** The `charset_normalizer` library (`from_bytes`) handles this well for HTML and should work equally well for plain text.

### Edge Cases

- `text/plain; charset=utf-8` -- must strip params before matching
- Empty response body with `text/plain` -- should produce empty string, not crash
- `text/plain` with BOM (byte order mark) -- `charset_normalizer` handles this
- Responses with no `Content-Type` header at all -- currently treated as `unknown`; should probably be rejected (safe default)

### Testing Risks

- The `conftest.py` uses `respx.mock` as an autouse fixture which intercepts all httpx calls. Tests for `fetch_content` / `urls_to_markdown` must either work within `respx.mock` (by registering mock routes) or explicitly disable the autouse fixture. Using `respx` route registration is the recommended approach since it aligns with the existing test patterns.

---

## 6. Estimated Complexity

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Scope** | Small | ~50 lines changed in search.py, ~200 lines of new tests |
| **Risk Level** | Low | Change is additive (accepting more types), not removing existing behavior for HTML |
| **Confidence** | High | The bug is clearly isolated to one guard clause; the fix is straightforward |

### Priority Order

1. **P0:** Fix `fetch_html` content-type guard to accept `text/plain` (the bug itself)
2. **P0:** Add `content_to_markdown` routing so plain text skips markdownify
3. **P1:** Write unit tests for all helper functions (`strip_control_chars`, `looks_binary`, `clean_markdown`)
4. **P1:** Write unit tests for `fetch_content` with mocked httpx responses via `respx`
5. **P1:** Write unit tests for `content_to_markdown` routing
6. **P2:** Write integration-level tests for `urls_to_markdown` with mixed content types
7. **P2:** Consider adding `max_response_bytes` guard for safety

### Files Modified

| File | Change Type |
|------|-------------|
| `backend/src/tools/search.py` | Modified -- refactor fetch_html, add content_to_markdown, update url_to_markdown |
| `backend/tests/unit/tools/test_web_scrape.py` | New -- comprehensive test suite for scraping pipeline |
