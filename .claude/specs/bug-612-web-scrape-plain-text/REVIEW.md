# Council Review: Bug #612 - web_scrape Cannot Fetch plain/text Pages

## Proposal Comparison Matrix

| Aspect | SCRAPE_ENGINEER | API_GUARDIAN | TEST_SENTINEL | Council Verdict |
|--------|----------------|-------------|---------------|-----------------|
| Architecture | `FetchResult(content, is_html)` dataclass | `FetchResult(text, content_type)` dataclass with category mapping | `tuple[str, str]` return | **FetchResult dataclass with content_type category** (API_GUARDIAN approach) |
| Content-type matching | Prefix match `text/*` + tuple of prefixes | Explicit allowlist dict + `text/*` fallback | Set-based allowlist + `text/*` startswith | **Allowlist dict + `text/*` fallback** (API_GUARDIAN) |
| Plain text rendering | Fenced code block | Raw text (cleaned) | Raw text (cleaned) | **Raw text via `clean_markdown`** (majority) |
| JSON/XML rendering | Not detailed | Fenced code block with lang hint | Fenced code block with lang hint | **Fenced code block with lang hint** (consensus) |
| Test approach | 5 test cases listed | 8 test cases listed | 6 test classes, ~25 cases with skeleton | **Comprehensive test file** (TEST_SENTINEL structure) |
| Risk mitigation | Max content length truncation | Max content length truncation | Max response bytes guard | **Add truncation (P2, not blocking)** |

## Consensus Points

All three proposals agree on:

1. **Root cause**: Line 94 of `backend/src/tools/search.py` — the `fetch_html` content-type guard rejects all non-HTML types
2. **Fix location**: Single file change in `backend/src/tools/search.py`
3. **Approach**: Broaden content-type acceptance, branch conversion logic based on type
4. **No breaking changes**: `web_scrape` tool signature and return type unchanged
5. **No schema/route/DB changes**: Pure implementation fix
6. **Separate code path**: The `Loader` class `WebBaseLoader` is unaffected
7. **Scope**: Small, low risk, additive change
8. **Tests needed**: Zero existing test coverage for scraping pipeline; new test file required

## Divergence Analysis

### 1. Return type: dataclass vs. tuple
- SCRAPE_ENGINEER: `FetchResult(content: str, is_html: bool)` — simple but limited
- API_GUARDIAN: `FetchResult(text: str, content_type: str)` — category string enables richer routing
- TEST_SENTINEL: `tuple[str, str]` — minimal, no new types

**Council Decision**: Use `FetchResult` dataclass with `content_type` string category. More extensible than boolean, more readable than raw tuple. The category approach (API_GUARDIAN) is cleanest.

### 2. Plain text rendering: code block vs. raw
- SCRAPE_ENGINEER: Wrap in fenced code block for markdown consistency
- API_GUARDIAN & TEST_SENTINEL: Return cleaned text as-is

**Council Decision**: Return cleaned text as-is. Plain text (like `llm.txt`) is natural language meant to be read directly. Code blocks add noise for LLM consumption.

### 3. Content-type charset handling
- SCRAPE_ENGINEER: Substring match handles `text/plain; charset=utf-8` implicitly
- TEST_SENTINEL: Explicitly strips params with `ctype.split(";")[0].strip()`

**Council Decision**: Explicitly strip charset params (TEST_SENTINEL approach). More robust and intentional.

## Unified Implementation Plan

### Files to Modify

| File | Change |
|------|--------|
| `backend/src/tools/search.py` | Refactor `fetch_html` → `fetch_content`, add `FetchResult`, add `content_to_markdown`, update `url_to_markdown`, update `Accept` header, update error tip |
| `backend/tests/unit/tools/test_web_scrape.py` | New: comprehensive test suite |

### Implementation Sequence

1. Add `FetchResult` dataclass and `ALLOWED_TEXT_TYPES` dict
2. Refactor `fetch_html` to `fetch_content` with broadened content-type gate
3. Add `content_to_markdown` function with type-based routing
4. Update `url_to_markdown` to use new functions
5. Update `Accept` header to include `text/plain`
6. Update error tip message
7. Write unit tests
8. Run `make format` and `make test`

### Critical Path

- Step 1-4 are the core fix (unblocks the bug)
- Step 5-6 are improvements (better HTTP negotiation and error messaging)
- Step 7-8 are quality gates

### Non-negotiable Requirements

- HTML scraping path must remain unchanged
- `web_scrape` tool signature must not change
- `looks_binary` check must remain as safety net
- Content-type charset params must be stripped before matching
- Tests must cover: HTML accepted, plain text accepted, binary rejected, charset params handled

## Risk Consolidation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large text files overwhelming LLM context | Medium | P2: Add max content length truncation (~100KB) |
| Binary payload with text content-type | Low | Existing `looks_binary()` heuristic handles this |
| Breaking HTML scraping | High | HTML path is unchanged; only additive branches |
| `conftest.py` autouse `respx.mock` intercepting test HTTP | Medium | Register mock routes via `respx` in tests |
| Missing Content-Type header | Low | Reject as unknown (safe default) |

## Final Verdict

- **Recommendation**: GO
- **Confidence**: High
- **Rationale**: All three agents independently arrived at essentially the same fix. The bug is clearly isolated to one guard clause. The change is purely additive. No API contracts change. Risk is minimal.
