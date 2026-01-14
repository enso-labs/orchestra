# PROPOSAL: Tavily API Fallback for Web Search

**Agent:** GUARDIAN - Security, Error Handling, Edge Cases, Testing
**Issue:** GitHub Issue #634 - FEAT: IF default search does not return results, fall back to Tavily API
**Date:** 2026-01-13

---

## 1. Executive Summary

Implement a graceful degradation pattern for the `web_search` tool that falls back to the Tavily API when SearXNG returns zero results or encounters errors. This approach prevents agent loops caused by repeated failed searches while maintaining security best practices for API key handling. The implementation requires adding the `langchain-tavily` package dependency, extending the constants module with a `TAVILY_API_KEY` configuration, and refactoring the search tool to support a multi-provider strategy with proper error boundaries.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Current `web_search` Implementation (`backend/src/tools/search.py:204-258`):**
```python
@tool
async def web_search(
    query: str,
    num_results: Optional[int] = 5,
) -> list:
    from src.constants import SEARX_SEARCH_HOST_URL

    if not SEARX_SEARCH_HOST_URL:
        raise ToolException("No SEARX_SEARCH_HOST_URL provided")

    searx = SearxSearchWrapper(searx_host=SEARX_SEARCH_HOST_URL)
    logger.info(f"Searching for {query} with {num_results} results")

    try:
        results = await searx.aresults(
            query=query,
            num_results=num_results,
        )
        logger.info(f"Found {len(results)} results")
        return results
    except Exception as e:
        logger.error(f"Error searching for {query}: {e}")
        raise ToolException(f"Error searching for {query}: {e}")
```

**Key Problems Identified:**
1. **No empty result handling** - When SearXNG returns empty results, the tool returns an empty list without attempting alternatives
2. **Exception propagation** - All errors bubble up as `ToolException`, causing agent loops
3. **Single point of failure** - Entire search capability depends on SearXNG availability
4. **Missing fallback infrastructure** - No mechanism for provider chaining

**Current Environment Variable Pattern (`backend/src/constants/__init__.py`):**
- `TAVILY_API_KEY` is already documented in README as a tool config variable
- Listed in `.example.env` but NOT implemented in constants module
- Follows existing pattern: `SEARX_SEARCH_HOST_URL`, `SHELL_EXEC_SERVER_URL`

### 2.2 Proposed Changes

**High-Level Architecture:**
```
web_search(query, num_results)
    |
    v
[Primary: SearXNG]
    |
    +-- Results? --> Return results
    |
    +-- Empty/Error?
            |
            v
        [TAVILY_API_KEY exists?]
            |
            +-- Yes --> [Fallback: Tavily API]
            |               |
            |               +-- Results? --> Return results
            |               |
            |               +-- Error? --> Raise ToolException
            |
            +-- No --> Return empty list / Raise ToolException
```

### 2.3 Integration Points and Dependencies

**New Dependency Required:**
```toml
# backend/pyproject.toml
"langchain-tavily>=0.2.16",
```

**Constants Module Extension:**
```python
# backend/src/constants/__init__.py
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
```

**UserTokenKey Enum Update (for user-level API key storage):**
```python
class UserTokenKey(Enum):
    # ... existing keys
    TAVILY_API_KEY = "TAVILY_API_KEY"  # Add to enum
```

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Infrastructure Setup

**Step 1.1: Add langchain-tavily dependency**
- File: `backend/pyproject.toml`
- Action: Add `"langchain-tavily>=0.2.16"` to dependencies array
- Rationale: Official LangChain integration with MIT license, supports Python 3.12

**Step 1.2: Extend constants module**
- File: `backend/src/constants/__init__.py`
- Actions:
  1. Add `TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")` after line 83
  2. Add `TAVILY_API_KEY = "TAVILY_API_KEY"` to `UserTokenKey` enum

#### Phase 2: Search Tool Refactoring

**Step 2.1: Create internal helper functions**
- File: `backend/src/tools/search.py`
- Add helper functions for provider abstraction:

```python
async def _search_with_searx(
    query: str,
    num_results: int,
    searx_url: str
) -> tuple[list, Optional[Exception]]:
    """
    Execute search using SearXNG.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        searx = SearxSearchWrapper(searx_host=searx_url)
        results = await searx.aresults(query=query, num_results=num_results)
        return results, None
    except Exception as e:
        return [], e


async def _search_with_tavily(
    query: str,
    num_results: int,
    api_key: str
) -> tuple[list, Optional[Exception]]:
    """
    Execute search using Tavily API.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        from langchain_tavily import TavilySearch

        tavily = TavilySearch(
            max_results=num_results,
            tavily_api_key=api_key,
        )
        # TavilySearch returns dict with 'results' key
        response = await tavily.ainvoke({"query": query})

        # Normalize response format to match SearXNG output
        results = _normalize_tavily_results(response)
        return results, None
    except Exception as e:
        return [], e


def _normalize_tavily_results(tavily_response: dict) -> list:
    """
    Convert Tavily response format to match SearXNG result format.
    Ensures consistent return structure for downstream consumers.
    """
    normalized = []
    raw_results = tavily_response.get("results", [])

    for item in raw_results:
        normalized.append({
            "title": item.get("title", ""),
            "link": item.get("url", ""),
            "snippet": item.get("content", ""),
            "score": item.get("score", 0.0),
            # Preserve additional metadata
            "source": "tavily",
        })

    return normalized
```

**Step 2.2: Refactor main web_search tool**
- File: `backend/src/tools/search.py`
- Replace current implementation with fallback logic:

```python
@tool
async def web_search(
    query: str,
    num_results: Optional[int] = 5,
) -> list:
    """
    Title: Web Search
    Toolkit: Search
    Description: Perform a targeted web search for the provided query.
        - Always refine the query with the most relevant keywords.
        - Be specific with dates (e.g., "September 7, 2025" instead of "recent" or "today").
        - Use exact timeframes when searching for current or time-sensitive events.
        - Think critically before searching to ensure accuracy and relevance.
        - Automatically falls back to Tavily API if primary search yields no results.

    Example Queries:
        - site:<domain> latest news about <topic> September 7, 2025
        - <company> earnings report Q2 2025
        - election results Nevada November 2024

    Args:
        query (str): The search query string.
        num_results (int, optional): Number of results to return. Default is 5.

    Returns:
        list: A list of search results.
    """
    from src.constants import SEARX_SEARCH_HOST_URL, TAVILY_API_KEY

    logger.info(f"Searching for '{query}' with max {num_results} results")

    # Phase 1: Try primary search provider (SearXNG)
    if SEARX_SEARCH_HOST_URL:
        results, searx_error = await _search_with_searx(
            query=query,
            num_results=num_results,
            searx_url=SEARX_SEARCH_HOST_URL,
        )

        if results:
            logger.info(f"SearXNG returned {len(results)} results")
            return results

        if searx_error:
            logger.warning(f"SearXNG search failed: {searx_error}")
        else:
            logger.warning(f"SearXNG returned no results for: {query}")

    # Phase 2: Fallback to Tavily if available
    if TAVILY_API_KEY:
        logger.info("Attempting Tavily fallback search")
        results, tavily_error = await _search_with_tavily(
            query=query,
            num_results=num_results,
            api_key=TAVILY_API_KEY,
        )

        if results:
            logger.info(f"Tavily fallback returned {len(results)} results")
            return results

        if tavily_error:
            logger.error(f"Tavily fallback also failed: {tavily_error}")

    # Phase 3: All providers exhausted
    if not SEARX_SEARCH_HOST_URL and not TAVILY_API_KEY:
        raise ToolException(
            "No search providers configured. "
            "Set SEARX_SEARCH_HOST_URL or TAVILY_API_KEY."
        )

    # Return empty rather than throwing to prevent agent loops
    logger.warning(f"All search providers returned no results for: {query}")
    return []
```

#### Phase 3: Testing

**Step 3.1: Create unit tests for search helpers**
- File: `backend/tests/unit/tools/test_search.py` (new file)

```python
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

# Test cases to implement:
# 1. test_search_with_searx_success
# 2. test_search_with_searx_empty_results
# 3. test_search_with_searx_exception
# 4. test_search_with_tavily_success
# 5. test_search_with_tavily_api_error
# 6. test_normalize_tavily_results
# 7. test_web_search_searx_primary_success
# 8. test_web_search_fallback_to_tavily
# 9. test_web_search_no_providers_configured
# 10. test_web_search_all_providers_fail
```

**Step 3.2: Update conftest.py with Tavily mocks**
- File: `backend/tests/conftest.py`
- Add mock for Tavily API endpoints in `mock_external_services` fixture

### 3.2 File Changes Required

| File | Action | Description |
|------|--------|-------------|
| `backend/pyproject.toml` | Modify | Add `langchain-tavily>=0.2.16` dependency |
| `backend/src/constants/__init__.py` | Modify | Add `TAVILY_API_KEY` constant and enum value |
| `backend/src/tools/search.py` | Modify | Refactor with fallback logic and helpers |
| `backend/tests/unit/tools/test_search.py` | Create | New test file for search tool |
| `backend/tests/conftest.py` | Modify | Add Tavily API mock |
| `backend/.example.env` | Verify | `TAVILY_API_KEY=` already present (no change needed) |

### 3.3 Key Code Patterns to Follow

**Error Handling Pattern (from existing codebase):**
```python
# Pattern from backend/src/tools/shell.py
try:
    # ... operation
except ToolException as e:
    logger.error(f"Error message: {context}")
    # Re-raise or handle gracefully
```

**Environment Variable Pattern (from constants/__init__.py):**
```python
# Pattern: os.getenv with optional default
VARIABLE_NAME = os.getenv("VARIABLE_NAME")  # No default = None if not set
VARIABLE_WITH_DEFAULT = os.getenv("VARIABLE_NAME", "default_value")
```

**Tool Definition Pattern (from existing tools):**
```python
@tool
async def tool_name(required_arg: str, optional_arg: Optional[int] = default) -> ReturnType:
    """
    Title: Human-readable title
    Toolkit: Category
    Description: What it does
    Args:
        arg_name (type): Description
    Returns:
        ReturnType: Description
    """
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Why Chosen |
|----------|-------------|------------|
| Return empty list on all failures | Raise ToolException | Prevents agent loops; agents can handle empty gracefully |
| Helper functions over class | SearchProvider class hierarchy | Simpler; matches existing tool patterns |
| Result normalization | Return raw Tavily format | Ensures consistent downstream processing |
| Sequential fallback | Parallel providers | Saves API costs; primary should succeed most times |
| Import inside function | Top-level import | Lazy loading; Tavily only loaded when needed |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Separate Tavily tool**
- Rejected: Would require agents to know about multiple search tools
- Our approach: Single unified interface with internal fallback

**Alternative 2: Retry decorator pattern**
- Rejected: Retrying same failing provider won't help
- Our approach: Provider diversity solves availability issues

**Alternative 3: Configuration-based provider selection**
- Rejected: Adds complexity for users
- Our approach: Automatic fallback requires no user configuration

### 4.3 Alignment with Existing Codebase Patterns

1. **Constants pattern**: Follows `SEARX_SEARCH_HOST_URL` pattern exactly
2. **Error handling**: Uses existing `logger.error()` and `ToolException` patterns
3. **Async pattern**: Maintains async tool signature
4. **Type hints**: Full type annotations as required by code style
5. **Logging**: Consistent with `src/utils/logger.logger` usage

---

## 5. Risk Assessment

### 5.1 Security Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| API key exposure in logs | High | Never log API keys; use redacted references |
| API key in error messages | High | Generic error messages, no key values |
| Unauthorized API usage | Medium | Key only used when explicitly configured |
| Rate limiting on Tavily | Low | Only used as fallback; limited exposure |

**API Key Handling Best Practices:**
```python
# Good: Never log the key
logger.info("Attempting Tavily fallback search")

# Bad: Would expose key
logger.info(f"Using Tavily with key: {TAVILY_API_KEY}")  # NEVER DO THIS
```

### 5.2 Potential Pitfalls

1. **Tavily API rate limits**: Tavily has usage limits; frequent fallbacks could exhaust quota
   - Mitigation: Only fallback on empty/error, not preemptively

2. **Network timeouts**: Tavily API calls could hang
   - Mitigation: Implement timeout handling (default httpx timeout is reasonable)

3. **Result format drift**: Tavily API response format could change
   - Mitigation: Normalization layer isolates changes to one function

4. **Dependency conflicts**: langchain-tavily could conflict with existing langchain versions
   - Mitigation: Version constraint `>=0.2.16` allows flexibility

### 5.3 Edge Cases to Handle

| Edge Case | Handling Strategy |
|-----------|-------------------|
| Empty query string | Validate input; return empty or raise early |
| Very large num_results | Cap at reasonable max (e.g., 20) |
| Special characters in query | Let providers handle URL encoding |
| Neither provider configured | Raise clear ToolException |
| Both providers return empty | Return empty list (not an error) |
| Tavily returns unexpected format | Defensive parsing with `.get()` defaults |
| Network timeout mid-request | Exception caught in helper; triggers fallback |

### 5.4 Testing Considerations

**Unit Test Coverage Required:**
- [ ] SearXNG success path
- [ ] SearXNG empty results triggers fallback
- [ ] SearXNG exception triggers fallback
- [ ] Tavily success path (as fallback)
- [ ] Tavily failure handling
- [ ] No providers configured
- [ ] Result normalization accuracy
- [ ] API key absence handling

**Mocking Strategy:**
```python
# Mock SearXNG
@patch("src.tools.search.SearxSearchWrapper")
async def test_searx_fallback(mock_searx):
    mock_searx.return_value.aresults = AsyncMock(return_value=[])
    # ...

# Mock Tavily
@patch("langchain_tavily.TavilySearch")
async def test_tavily_fallback(mock_tavily):
    mock_tavily.return_value.ainvoke = AsyncMock(return_value={"results": [...]})
    # ...
```

**Integration Test Considerations:**
- Real Tavily API tests require valid API key (skip in CI without key)
- Use `@pytest.mark.skipif` for conditional execution

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Scope** | **Medium** | Single tool modification with new dependency |
| Code Changes | Medium | ~100-150 lines new/modified code |
| Testing Effort | Medium | 8-10 new test cases |
| Documentation | Low | Minimal; already documented in README |

### 6.2 Risk Level

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Risk** | **Low-Medium** | Well-understood pattern; isolated changes |
| Breaking Changes | Low | Additive functionality only |
| Dependency Risk | Low | Mature package; official LangChain integration |
| Security Risk | Low | Standard API key pattern already used |

### 6.3 Suggested Priority Order

1. **Phase 1: Infrastructure** (Est. 30 min)
   - Add dependency to pyproject.toml
   - Add constant to constants module
   - Run `uv sync` to verify dependency resolution

2. **Phase 2: Core Implementation** (Est. 1-2 hours)
   - Implement helper functions
   - Refactor web_search tool
   - Manual testing with real API keys

3. **Phase 3: Testing** (Est. 1-2 hours)
   - Create unit test file
   - Implement test cases
   - Update conftest.py mocks
   - Run full test suite

4. **Phase 4: Validation** (Est. 30 min)
   - Code formatting (`make format`)
   - Full test run (`make test`)
   - Manual API validation with curl

---

## 7. Appendix

### 7.1 Tavily API Response Format Reference

```json
{
  "query": "search query",
  "follow_up_questions": ["question1", "question2"],
  "answer": "summary answer",
  "images": [],
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com",
      "content": "Snippet text...",
      "score": 0.95,
      "raw_content": "Full page content (if requested)"
    }
  ],
  "response_time": 0.5
}
```

### 7.2 SearXNG Result Format Reference

```python
[
    {
        "title": "Page Title",
        "link": "https://example.com",
        "snippet": "Snippet text...",
        "engines": ["google", "bing"],
        "score": 1.0
    }
]
```

### 7.3 Normalized Result Format (Output)

```python
[
    {
        "title": "Page Title",
        "link": "https://example.com",  # Unified key name
        "snippet": "Snippet text...",   # Unified key name
        "score": 0.95,
        "source": "searx" | "tavily"    # Identifies provider
    }
]
```

### 7.4 References

- [LangChain-Tavily Integration Docs](https://docs.tavily.com/documentation/integrations/langchain)
- [langchain-tavily PyPI Package](https://pypi.org/project/langchain-tavily/)
- [GitHub: tavily-ai/langchain-tavily](https://github.com/tavily-ai/langchain-tavily)
- [TavilySearch LangChain API Reference](https://python.langchain.com/api_reference/community/tools/langchain_community.tools.tavily_search.tool.TavilySearchResults.html)

---

**Prepared by:** GUARDIAN Agent
**Review Status:** Ready for team review
