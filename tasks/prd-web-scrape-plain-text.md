# PRD: Fix web_scrape to Handle plain/text Pages (Issue #612)

## Introduction

The `web_scrape` tool in Orchestra's backend fails when fetching URLs that serve `text/plain` content (e.g., `.txt` files like `https://ruska.ai/llm.txt`). The `fetch_html` function in `backend/src/tools/search.py` explicitly rejects any response whose `Content-Type` is not `text/html` or `application/xhtml+xml`, causing a `ValueError` for all plain text URLs. This bug prevents agents from reading text-based resources that are not HTML.

The fix broadens the content-type gate to accept text-based MIME types and routes non-HTML content through an appropriate conversion path instead of forcing everything through the HTML-to-markdown pipeline.

## Goals

- Fix the `web_scrape` tool to successfully fetch and return `text/plain` content
- Support additional text-based content types (`application/json`, `text/xml`, `text/csv`, `text/markdown`)
- Preserve existing HTML scraping behavior unchanged
- Add unit test coverage for the scraping pipeline (currently at zero)
- Keep the `web_scrape` tool API contract unchanged (returns `str` markdown)

## User Stories

### US-001: Refactor fetch_html to Support Text Content Types
**Description:** As a developer, I need to refactor the `fetch_html` function to accept text-based content types so that plain text URLs no longer fail with a ValueError.

**Acceptance Criteria:**
- [ ] Add `FetchResult` dataclass with `text: str` and `content_type: str` fields to `backend/src/tools/search.py`
- [ ] Add `ALLOWED_TEXT_TYPES` dict mapping MIME types to category strings (`html`, `plain`, `json`, `xml`, `csv`, `markdown`)
- [ ] Rename `fetch_html` to `fetch_content` that returns `FetchResult`
- [ ] Content-type gate accepts all `text/*` types plus allowlisted `application/*` types (`application/json`, `application/xml`, `application/xhtml+xml`, `application/rss+xml`, `application/atom+xml`)
- [ ] Charset parameters are stripped from Content-Type before matching (e.g., `text/plain; charset=utf-8` → `text/plain`)
- [ ] Binary content still rejected via existing `looks_binary()` check
- [ ] Missing Content-Type header still rejected as unknown
- [ ] Existing HTML scraping path unchanged
- [ ] Typecheck passes
- [ ] `make format` passes

### US-002: Add Content-Type-Aware Markdown Conversion
**Description:** As a developer, I need a routing function that converts fetched content to markdown based on its content type, so that plain text is not forced through the HTML-to-markdown pipeline.

**Acceptance Criteria:**
- [ ] Add `content_to_markdown` function to `backend/src/tools/search.py`
- [ ] HTML (`text/html`, `application/xhtml+xml`) routes through existing `html_to_markdown`
- [ ] Plain text (`text/plain`) routes through `clean_markdown` (returned as-is, cleaned)
- [ ] Markdown (`text/markdown`) routes through `clean_markdown`
- [ ] JSON (`application/json`) wrapped in ` ```json ` fenced code block
- [ ] XML (`text/xml`, `application/xml`, `application/rss+xml`, `application/atom+xml`) wrapped in ` ```xml ` fenced code block
- [ ] CSV (`text/csv`) wrapped in ` ```csv ` fenced code block
- [ ] Unknown text types fall back to `clean_markdown`
- [ ] Update `url_to_markdown` to call `fetch_content` then `content_to_markdown`
- [ ] Update `Accept` header in `urls_to_markdown` to include `text/plain`
- [ ] Update error tip message to no longer mention plain text as a failure cause
- [ ] Typecheck passes
- [ ] `make format` passes

### US-003: Add Unit Tests for Web Scrape Pipeline
**Description:** As a developer, I need unit tests covering the web scraping pipeline so that the fix is verified and regressions are prevented.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/tools/test_web_scrape.py`
- [ ] Test `fetch_content` with `text/html` response → accepted, returns `FetchResult` with `content_type="html"`
- [ ] Test `fetch_content` with `text/plain` response → accepted, returns `FetchResult` with `content_type="plain"`
- [ ] Test `fetch_content` with `application/json` response → accepted
- [ ] Test `fetch_content` with `text/plain; charset=utf-8` → charset stripped, accepted as `plain`
- [ ] Test `fetch_content` with `image/png` response → raises `ValueError`
- [ ] Test `fetch_content` with binary payload but `text/html` header → raises `ValueError` (binary detection)
- [ ] Test `fetch_content` with missing Content-Type → raises `ValueError`
- [ ] Test `content_to_markdown` routes HTML through `html_to_markdown`
- [ ] Test `content_to_markdown` returns cleaned plain text for `text/plain`
- [ ] Test `content_to_markdown` wraps JSON in fenced code block
- [ ] Test `content_to_markdown` wraps XML in fenced code block
- [ ] Test `content_to_markdown` wraps CSV in fenced code block
- [ ] Test helper functions: `strip_control_chars`, `looks_binary`, `clean_markdown`
- [ ] All tests pass with `make test`
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The `fetch_content` function must accept any `text/*` MIME type and allowlisted `application/*` types
- FR-2: The `fetch_content` function must strip charset parameters from Content-Type before matching
- FR-3: The `fetch_content` function must reject non-text content types with a `ValueError`
- FR-4: The `fetch_content` function must reject binary payloads via `looks_binary()` regardless of Content-Type header
- FR-5: The `content_to_markdown` function must route HTML through `html_to_markdown`
- FR-6: The `content_to_markdown` function must return plain text through `clean_markdown` without HTML parsing
- FR-7: The `content_to_markdown` function must wrap JSON, XML, and CSV in language-hinted fenced code blocks
- FR-8: The `web_scrape` tool must continue to return `str` (markdown) — no API contract change
- FR-9: The `Accept` header must include `text/plain` to signal willingness to receive plain text
- FR-10: Error tip messages must accurately describe failure causes (binary content, server blocks)

## Non-Goals

- No max content length truncation (deferred to P2)
- No pretty-printing of JSON content (return as-is in code block)
- No changes to the `Loader` class or `WebBaseLoader` (separate code path)
- No changes to API routes, schemas, or database
- No frontend changes
- No changes to `web_search` function (only `web_scrape` affected)

## Technical Considerations

- **Single file change**: All scraping logic lives in `backend/src/tools/search.py` (lines 24-179)
- **Separate code path**: The `Loader` class in `backend/src/loaders/__init__.py` uses `WebBaseLoader` for document ingestion — this is NOT affected by this bug
- **Existing safety**: `looks_binary()` heuristic and `charset_normalizer` (`from_bytes`) are already used for HTML and work for plain text
- **httpx handles**: Content-Encoding decompression (gzip), redirect following (`follow_redirects=True`)
- **Test infrastructure**: `conftest.py` uses `respx.mock` as autouse fixture — tests must register mock routes via `respx`
- **Dependencies**: No new dependencies needed; `httpx`, `charset_normalizer`, `markdownify` already installed

## Success Metrics

- `web_scrape` successfully fetches and returns content from `text/plain` URLs (e.g., `https://ruska.ai/llm.txt`)
- All existing HTML scraping continues to work (no regressions)
- Unit test coverage added for the scraping pipeline
- All tests pass (`make test`)
- Typecheck passes

## Open Questions

- Should a max content length (e.g., 100KB) be added to prevent very large text files from overwhelming LLM context? (Deferred to P2)
- Should responses with no Content-Type header attempt text detection instead of rejecting? (Current decision: reject as safe default)
