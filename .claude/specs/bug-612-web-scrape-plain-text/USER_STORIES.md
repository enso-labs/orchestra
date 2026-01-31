# User Stories

## Issue #612: BUG: web_scrape cannot fetch plain/text pages

### Story 1: Fetch Plain Text URLs
**As a** user of the web scrape tool,
**I want** to scrape URLs that serve plain text content (e.g., `.txt` files, `text/plain` content-type),
**So that** I can retrieve and analyze text-based resources without errors.

**Acceptance Criteria:**
- [ ] Web scraper detects `text/plain` content-type responses
- [ ] Plain text content is returned directly without HTML parsing
- [ ] URLs ending in `.txt` are handled correctly
- [ ] Existing HTML scraping continues to work unchanged
- [ ] Typecheck passes

### Story 2: Graceful Content-Type Handling
**As a** developer integrating the web scrape tool,
**I want** the scraper to handle various content types gracefully (text/plain, text/markdown, text/csv, etc.),
**So that** non-HTML text responses don't cause failures or empty results.

**Acceptance Criteria:**
- [ ] Non-HTML text content types are detected and handled
- [ ] Response content is returned as-is for non-HTML types
- [ ] Error messages clearly indicate what happened if content cannot be processed
- [ ] Typecheck passes

## Notes
- The issue specifically mentions `https://ruska.ai/llm.txt` as a failing URL
- The scraper currently only processes HTML content, failing on plain text
- The fix should be in the web scraping backend service/tool
