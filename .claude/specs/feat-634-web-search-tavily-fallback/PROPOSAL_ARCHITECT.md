# Architectural Proposal: Web Search Tavily Fallback

**Issue:** GitHub Issue #634
**Title:** FEAT: IF default search does not return results, fall back to Tavily API
**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-13

---

## 1. Executive Summary

This proposal recommends implementing a **Chain of Responsibility** pattern for the `web_search` tool that attempts SearXNG as the primary search provider and automatically falls back to Tavily Search API when no results are returned or when SearXNG is unavailable. The implementation leverages the official `langchain-tavily` package (v0.2.16+), adds the `TAVILY_API_KEY` constant to the environment configuration, and maintains backward compatibility with existing deployments that may not have Tavily configured.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Existing Implementation (`backend/src/tools/search.py`):**
- The `web_search` tool is a LangChain `@tool` decorated async function
- Uses `SearxSearchWrapper` from `langchain_community.utilities`
- Requires `SEARX_SEARCH_HOST_URL` environment variable
- Returns a list of search results
- Raises `ToolException` on errors or missing configuration
- **Problem:** When SearXNG returns empty results, the agent may enter retry loops

**Environment Configuration (`backend/src/constants/__init__.py`):**
- `SEARX_SEARCH_HOST_URL` is defined and exposed via `UserTokenKey` enum
- `TAVILY_API_KEY` is documented in README but NOT yet implemented in constants

**Dependencies (`backend/pyproject.toml`):**
- `langchain-community>=0.4.1` is present (contains deprecated Tavily wrapper)
- `langchain-tavily` is NOT installed (needs to be added)

### 2.2 Proposed Changes

#### A. Add `langchain-tavily` Dependency
```toml
# pyproject.toml
dependencies = [
    ...
    "langchain-tavily>=0.2.16",
    ...
]
```

#### B. Add `TAVILY_API_KEY` to Constants
```python
# backend/src/constants/__init__.py

class UserTokenKey(Enum):
    ...
    TAVILY_API_KEY = "TAVILY_API_KEY"  # Add to enum
    ...

# Add constant export
TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)
```

#### C. Implement Fallback Logic in `web_search`

The recommended architecture uses a **two-tier search strategy**:

```
                    +-------------------+
                    |    web_search()   |
                    +-------------------+
                            |
                            v
                    +-------------------+
                    |  SearXNG Search   |
                    |   (Primary)       |
                    +-------------------+
                            |
              results > 0?  |
                   +--------+--------+
                   |                 |
                  YES               NO
                   |                 |
                   v                 v
              +--------+     +-------------------+
              | Return |     | Tavily Fallback   |
              | Results|     | (if configured)   |
              +--------+     +-------------------+
                                    |
                                    v
                            +-------------------+
                            |  Return Results   |
                            |  or Empty List    |
                            +-------------------+
```

### 2.3 Integration Points and Dependencies

| Component | Integration Type | Notes |
|-----------|-----------------|-------|
| `backend/src/tools/search.py` | **Primary** | Main modification target |
| `backend/src/constants/__init__.py` | **Secondary** | Add TAVILY_API_KEY constant |
| `backend/pyproject.toml` | **Secondary** | Add langchain-tavily dependency |
| `backend/.example.env` | **Documentation** | Already has TAVILY_API_KEY placeholder |
| `backend/README.md` | **Documentation** | Already documents TAVILY_API_KEY |
| `SEARCH_TOOLS` list | **Unchanged** | No changes needed; same tool exposed |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Dependency and Configuration (Low Risk)

**Step 1.1:** Add `langchain-tavily` to `pyproject.toml`
```toml
# backend/pyproject.toml - line ~27
"langchain-tavily>=0.2.16",
```

**Step 1.2:** Add `TAVILY_API_KEY` to constants
```python
# backend/src/constants/__init__.py

class UserTokenKey(Enum):
    # ... existing entries ...
    TAVILY_API_KEY = "TAVILY_API_KEY"  # Add this line

# After line 83
TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)
```

#### Phase 2: Search Provider Abstraction (Medium Complexity)

**Step 2.1:** Create a helper function for Tavily search

```python
# backend/src/tools/search.py - Add after imports

async def _tavily_search(query: str, num_results: int = 5) -> list:
    """
    Perform a Tavily search as a fallback provider.

    Args:
        query: Search query string
        num_results: Maximum results to return

    Returns:
        List of search results in standardized format
    """
    from src.constants import TAVILY_API_KEY

    if not TAVILY_API_KEY:
        logger.debug("TAVILY_API_KEY not configured, skipping fallback")
        return []

    try:
        from langchain_tavily import TavilySearch

        tavily = TavilySearch(
            max_results=num_results,
            topic="general",
            include_answer=False,
            include_raw_content=False,
        )

        # TavilySearch returns structured dict; extract results
        response = tavily.invoke({"query": query})

        # Normalize response to match SearXNG format
        results = []
        if isinstance(response, dict) and "results" in response:
            for item in response["results"]:
                results.append({
                    "url": item.get("url", ""),
                    "title": item.get("title", ""),
                    "snippet": item.get("content", ""),
                    "score": item.get("score", 0),
                    "source": "tavily",
                })
        elif isinstance(response, list):
            # Handle case where response is already a list
            for item in response:
                if isinstance(item, dict):
                    results.append({
                        "url": item.get("url", ""),
                        "title": item.get("title", ""),
                        "snippet": item.get("content", ""),
                        "source": "tavily",
                    })

        logger.info(f"Tavily fallback returned {len(results)} results")
        return results

    except Exception as e:
        logger.warning(f"Tavily fallback failed: {e}")
        return []
```

**Step 2.2:** Modify `web_search` to implement fallback

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
        - Uses SearXNG as primary provider with Tavily as fallback.

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
    from src.constants import SEARX_SEARCH_HOST_URL

    results = []

    # Primary: Try SearXNG first
    if SEARX_SEARCH_HOST_URL:
        try:
            searx = SearxSearchWrapper(searx_host=SEARX_SEARCH_HOST_URL)
            logger.info(f"[SearXNG] Searching for '{query}' with {num_results} results")

            results = await searx.aresults(
                query=query,
                num_results=num_results,
            )

            if results:
                logger.info(f"[SearXNG] Found {len(results)} results")
                return results
            else:
                logger.info("[SearXNG] No results returned, attempting fallback")

        except Exception as e:
            logger.warning(f"[SearXNG] Search failed: {e}, attempting fallback")
    else:
        logger.debug("SEARX_SEARCH_HOST_URL not configured")

    # Fallback: Try Tavily if primary failed or returned no results
    results = await _tavily_search(query, num_results)

    if results:
        return results

    # Both providers failed or returned no results
    if not SEARX_SEARCH_HOST_URL:
        raise ToolException(
            "No search provider configured. Set SEARX_SEARCH_HOST_URL or TAVILY_API_KEY."
        )

    # Return empty list if no results from any provider
    logger.warning(f"No results found for query: {query}")
    return []
```

#### Phase 3: Testing (Required)

**Step 3.1:** Add unit tests for fallback behavior

```python
# backend/tests/unit/tools/test_search.py (new file)

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.tools.search import web_search, _tavily_search


class TestWebSearchFallback:
    """Tests for web_search fallback behavior."""

    @pytest.mark.asyncio
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searxng_success_no_fallback(self, mock_searx_class):
        """When SearXNG returns results, Tavily should not be called."""
        mock_searx = AsyncMock()
        mock_searx.aresults.return_value = [{"url": "http://example.com", "title": "Test"}]
        mock_searx_class.return_value = mock_searx

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            result = await web_search.invoke({"query": "test query"})

        assert len(result) == 1
        assert result[0]["url"] == "http://example.com"

    @pytest.mark.asyncio
    @patch("src.tools.search._tavily_search")
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searxng_empty_triggers_fallback(self, mock_searx_class, mock_tavily):
        """When SearXNG returns empty, Tavily fallback should be triggered."""
        mock_searx = AsyncMock()
        mock_searx.aresults.return_value = []
        mock_searx_class.return_value = mock_searx

        mock_tavily.return_value = [{"url": "http://tavily.com", "source": "tavily"}]

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            result = await web_search.invoke({"query": "test query"})

        mock_tavily.assert_called_once()
        assert len(result) == 1
        assert result[0]["source"] == "tavily"

    @pytest.mark.asyncio
    @patch("src.tools.search._tavily_search")
    @patch("src.tools.search.SearxSearchWrapper")
    async def test_searxng_error_triggers_fallback(self, mock_searx_class, mock_tavily):
        """When SearXNG throws exception, Tavily fallback should be triggered."""
        mock_searx = AsyncMock()
        mock_searx.aresults.side_effect = Exception("SearXNG unavailable")
        mock_searx_class.return_value = mock_searx

        mock_tavily.return_value = [{"url": "http://tavily.com", "source": "tavily"}]

        with patch("src.constants.SEARX_SEARCH_HOST_URL", "http://searx:8080"):
            result = await web_search.invoke({"query": "test query"})

        mock_tavily.assert_called_once()
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_no_providers_raises_exception(self):
        """When no providers configured, should raise ToolException."""
        with patch("src.constants.SEARX_SEARCH_HOST_URL", None):
            with patch("src.constants.TAVILY_API_KEY", None):
                with pytest.raises(Exception) as exc_info:
                    await web_search.invoke({"query": "test query"})
                assert "No search provider configured" in str(exc_info.value)


class TestTavilySearch:
    """Tests for _tavily_search helper function."""

    @pytest.mark.asyncio
    async def test_tavily_no_api_key_returns_empty(self):
        """When TAVILY_API_KEY not set, should return empty list."""
        with patch("src.constants.TAVILY_API_KEY", None):
            result = await _tavily_search("test query")
        assert result == []

    @pytest.mark.asyncio
    @patch("langchain_tavily.TavilySearch")
    async def test_tavily_normalizes_response(self, mock_tavily_class):
        """Tavily response should be normalized to standard format."""
        mock_tavily = MagicMock()
        mock_tavily.invoke.return_value = {
            "results": [
                {"url": "http://test.com", "title": "Test", "content": "Test content", "score": 0.9}
            ]
        }
        mock_tavily_class.return_value = mock_tavily

        with patch("src.constants.TAVILY_API_KEY", "test-api-key"):
            result = await _tavily_search("test query")

        assert len(result) == 1
        assert result[0]["url"] == "http://test.com"
        assert result[0]["source"] == "tavily"
        assert "snippet" in result[0]
```

### 3.2 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/pyproject.toml` | **Modify** | Add `langchain-tavily>=0.2.16` dependency |
| `backend/src/constants/__init__.py` | **Modify** | Add `TAVILY_API_KEY` to UserTokenKey enum and export constant |
| `backend/src/tools/search.py` | **Modify** | Add `_tavily_search` helper and update `web_search` with fallback logic |
| `backend/tests/unit/tools/test_search.py` | **Create** | New unit tests for fallback behavior |

### 3.3 Key Code Patterns to Follow

1. **Async/Await Pattern:** Maintain async function signatures as per existing tools
2. **Logging Convention:** Use `logger.info()` for success, `logger.warning()` for recoverable failures, `logger.error()` for critical failures
3. **ToolException:** Raise `ToolException` for user-facing errors (from `langchain_core.tools`)
4. **Lazy Imports:** Import LangChain components inside functions to avoid circular imports and allow graceful degradation
5. **Environment Variables:** Access via `src.constants` module for consistency
6. **Result Normalization:** Ensure Tavily results match SearXNG format for transparent fallback

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| **Single `web_search` tool with fallback** | Separate `tavily_search` tool | Keeps tool interface simple; agents don't need to know about providers |
| **Fallback on empty results** | Fallback only on exceptions | Addresses the specific issue of "stuck in loops" from no results |
| **Use `langchain-tavily` package** | Use `langchain_community.tools.tavily_search` | New package is actively maintained; old one is deprecated |
| **Silent fallback (logging only)** | Raise exception on primary failure | Better UX; users get results without knowing provider changed |
| **Optional Tavily (graceful degradation)** | Required Tavily | Maintains backward compatibility for existing deployments |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Create a separate `tavily_search` tool**
- **Rejected because:** Would require agents to be aware of multiple search tools and implement their own fallback logic, increasing complexity and cognitive load for prompt engineering.

**Alternative 2: Strategy Pattern with pluggable providers**
- **Rejected because:** Over-engineering for current requirements (only 2 providers). The Chain of Responsibility pattern is simpler and sufficient. Can be refactored later if more providers are needed.

**Alternative 3: Parallel queries to both providers**
- **Rejected because:** Wasteful of API quota and increases latency. Sequential fallback only queries Tavily when needed.

### 4.3 Alignment with Existing Codebase Patterns

- **Tool Registration:** Uses same `@tool` decorator pattern as all other tools
- **SEARCH_TOOLS Export:** No changes needed to tool registration; same `web_search` exported
- **Constants Pattern:** Follows existing `UserTokenKey` enum and `os.getenv()` pattern
- **Error Handling:** Uses `ToolException` consistently with `retrieval.py` pattern
- **Logging:** Uses `logger` from `src.utils.logger` as per codebase convention
- **Async Pattern:** Maintains async/await as per existing `web_search` implementation

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Tavily API rate limits** | Medium | Medium | Add rate limiting or retry logic in future iteration |
| **Response format mismatch** | Low | Medium | Normalize all responses to standard format |
| **API key exposure in logs** | Low | High | Never log API keys; lazy import pattern prevents accidental exposure |
| **Increased latency on fallback** | Medium | Low | Acceptable trade-off; better than no results |
| **Dependency conflicts with langchain-tavily** | Low | Medium | Pin version; test with `uv sync` |

### 5.2 Edge Cases to Handle

1. **Both providers unavailable:** Return empty list with warning log (not exception) to prevent agent loops
2. **Tavily returns different result structure:** Normalize to match SearXNG format
3. **Partial results from SearXNG:** Consider empty if fewer than expected results? (Recommend: still return partial)
4. **SEARX_SEARCH_HOST_URL set but service down:** Fall back to Tavily
5. **Query contains special characters:** Both providers should handle; no special encoding needed
6. **Very long queries:** Tavily has query length limits (~400 chars); truncate with warning if exceeded

### 5.3 Testing Considerations

**Unit Tests (Required):**
- Test SearXNG success path (no fallback triggered)
- Test SearXNG empty results triggers Tavily
- Test SearXNG exception triggers Tavily
- Test Tavily success when primary fails
- Test both providers failing returns empty (not exception)
- Test no providers configured raises ToolException
- Test response normalization

**Integration Tests (Recommended):**
- Mock external APIs with `respx` (already in dev dependencies)
- Test full tool invocation flow

**Manual Testing:**
- Verify with real Tavily API key
- Test with SearXNG Docker container down
- Observe agent behavior with fallback

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Metric | Value | Justification |
|--------|-------|---------------|
| **Scope** | **Small** | 4 files modified, ~100 lines of new code |
| **Risk Level** | **Low** | Additive change, backward compatible, well-tested LangChain integration |
| **Effort** | 2-4 hours | Implementation + unit tests |

### 6.2 Suggested Priority Order

1. **Add dependency to `pyproject.toml`** (5 min)
2. **Add constant to `constants/__init__.py`** (5 min)
3. **Implement `_tavily_search` helper** (30 min)
4. **Modify `web_search` with fallback logic** (30 min)
5. **Write unit tests** (1 hour)
6. **Manual testing with both providers** (30 min)
7. **Code review and merge** (30 min)

### 6.3 Dependencies for Implementation

- `langchain-tavily>=0.2.16` (PyPI package)
- `TAVILY_API_KEY` environment variable (obtain from https://app.tavily.com)
- Existing `langchain_community` utilities (already installed)

---

## 7. Appendix

### 7.1 Environment Variable Documentation

The `TAVILY_API_KEY` is already documented in:
- `backend/README.md` (Tool Config section)
- `backend/.example.env` (placeholder exists)
- `docker/README.md` (Docker deployment docs)

No additional documentation changes required.

### 7.2 References

- [LangChain Tavily Integration](https://docs.tavily.com/documentation/integrations/langchain)
- [langchain-tavily PyPI](https://pypi.org/project/langchain-tavily/)
- [TavilySearch API Reference](https://python.langchain.com/api_reference/community/tools/langchain_community.tools.tavily_search.tool.TavilySearchResults.html)
- [GitHub Issue #634](https://github.com/ruska-ai/orchestra/issues/634)

### 7.3 Code Diff Preview

```diff
# backend/pyproject.toml
 dependencies = [
     ...
     "langchain-groq>=1.1.1",
+    "langchain-tavily>=0.2.16",
     "langchain-mcp-adapters>=0.2.1",
     ...
 ]

# backend/src/constants/__init__.py
 class UserTokenKey(Enum):
     ...
     LANGCONNECT_SERVER_URL = "LANGCONNECT_SERVER_URL"
+    TAVILY_API_KEY = "TAVILY_API_KEY"
     ...

+TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)

# backend/src/tools/search.py
+async def _tavily_search(query: str, num_results: int = 5) -> list:
+    """Tavily search fallback implementation..."""
+    ...

 @tool
 async def web_search(query: str, num_results: Optional[int] = 5) -> list:
-    """..."""
+    """...with fallback to Tavily..."""
+    # Primary: SearXNG
+    # Fallback: Tavily
     ...
```

---

**Proposal Status:** Ready for Review
**Recommended Reviewer:** Backend Lead / Tech Lead
**Implementation Ready:** Yes (all dependencies identified and documented)
