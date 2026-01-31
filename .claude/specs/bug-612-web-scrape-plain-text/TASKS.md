# Implementation Tasks: Bug #612 - web_scrape Cannot Fetch plain/text Pages

## Pre-Implementation

- [ ] Review REVIEW.md council decisions
- [ ] Read `backend/src/tools/search.py` fully to understand current implementation

## Core Implementation

- [ ] Task 1: Add `FetchResult` dataclass and `ALLOWED_TEXT_TYPES` constant
    - Files: `backend/src/tools/search.py`
    - Acceptance: `FetchResult` has `text: str` and `content_type: str` fields; `ALLOWED_TEXT_TYPES` maps MIME types to category strings (html, plain, json, xml, csv, markdown)

- [ ] Task 2: Refactor `fetch_html` to `fetch_content`
    - Files: `backend/src/tools/search.py`
    - Acceptance: Function accepts `text/*` types + allowlisted application types; strips charset params from Content-Type; returns `FetchResult`; rejects binary/unknown types with `ValueError`; `looks_binary` check preserved

- [ ] Task 3: Add `content_to_markdown` routing function
    - Files: `backend/src/tools/search.py`
    - Acceptance: HTML → `html_to_markdown`; plain/markdown → `clean_markdown`; json/xml/csv → fenced code block with lang hint; unknown text → `clean_markdown`

- [ ] Task 4: Update `url_to_markdown` to use new functions
    - Files: `backend/src/tools/search.py`
    - Acceptance: Calls `fetch_content` then `content_to_markdown`; error handling preserved

## Integration

- [ ] Task 5: Update `Accept` header in `urls_to_markdown`
    - Files: `backend/src/tools/search.py`
    - Acceptance: Header includes `text/plain` in addition to existing types

- [ ] Task 6: Update error tip message
    - Files: `backend/src/tools/search.py`
    - Acceptance: Error tip no longer mentions "plain text" as a failure cause; refers to binary content and server blocks

## Testing

- [ ] Task 7: Create `backend/tests/unit/tools/test_web_scrape.py`
    - Files: `backend/tests/unit/tools/test_web_scrape.py`
    - Acceptance: Tests cover:
      - `fetch_content` with text/html → accepted
      - `fetch_content` with text/plain → accepted
      - `fetch_content` with application/json → accepted
      - `fetch_content` with image/png → rejected
      - `fetch_content` with binary payload → rejected
      - `fetch_content` with charset in content-type → handled
      - `content_to_markdown` routing for each type
      - Helper functions: `strip_control_chars`, `looks_binary`, `clean_markdown`

## Verification

- [ ] Run `make format` — no errors
- [ ] Run `make test` — all tests passing
- [ ] Typecheck passes
- [ ] Self-review against REVIEW.md decisions

## Completion Signature

- Total Tasks: 11
- Dependencies: None (sequential implementation in search.py)
- Scope: Small
- Risk: Low
