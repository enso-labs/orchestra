# CRAFTSMAN Proposal: Web Search Tavily Fallback

**GitHub Issue:** #634
**Feature:** IF default search does not return results, fall back to Tavily API to check
**Agent:** CRAFTSMAN - Clean Code and SOLID Principles Expert
**Date:** 2026-01-13

---

## 1. Executive Summary

The current `web_search` tool relies exclusively on SearXNG, which can return empty results or fail entirely, causing agent loops. This proposal introduces a graceful fallback to the Tavily Search API when the primary search yields no results, improving reliability without breaking existing functionality. The implementation follows the Strategy Pattern with clean separation of concerns, making the codebase more maintainable and extensible for future search provider additions.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**File:** `/backend/src/tools/search.py`

The current implementation has several architectural limitations:

```python
@tool
async def web_search(query: str, num_results: Optional[int] = 5) -> list:
    from src.constants import SEARX_SEARCH_HOST_URL

    if not SEARX_SEARCH_HOST_URL:
        raise ToolException("No SEARX_SEARCH_HOST_URL provided")

    searx = SearxSearchWrapper(searx_host=SEARX_SEARCH_HOST_URL)
    # ... single provider, no fallback
```

**Identified Issues:**

| Issue | Impact | SOLID Violation |
|-------|--------|-----------------|
| Single search provider dependency | Agent loops on empty results | Single Responsibility |
| No fallback mechanism | Poor resilience | Open/Closed Principle |
| Provider logic tightly coupled to tool | Hard to extend | Dependency Inversion |
| Hardcoded error handling | Inconsistent failure modes | Liskov Substitution |

### 2.2 Dependency Analysis

**Current Dependencies (pyproject.toml):**
```toml
"langchain-community>=0.4.1",  # Contains SearxSearchWrapper
```

**Required New Dependency:**
```toml
"langchain-tavily>=0.1.0",  # Official Tavily integration
```

**Environment Variables:**
- `SEARX_SEARCH_HOST_URL` - Already implemented in `src/constants/__init__.py`
- `TAVILY_API_KEY` - Already documented in README but NOT implemented in constants

### 2.3 Integration Points

| Component | File | Required Change |
|-----------|------|-----------------|
| Constants | `src/constants/__init__.py` | Add `TAVILY_API_KEY` constant |
| Search Tool | `src/tools/search.py` | Implement fallback logic |
| UserTokenKey Enum | `src/constants/__init__.py` | Add `TAVILY_API_KEY` enum value |
| Dependencies | `pyproject.toml` | Add `langchain-tavily` |

---

## 3. Implementation Strategy

### 3.1 Design Pattern Selection

**Chosen Pattern:** Strategy Pattern with Chain of Responsibility

This pattern allows:
- Independent search provider implementations
- Easy addition of future providers (e.g., Bing, Google Custom Search)
- Clear separation between search strategy and tool interface
- Runtime provider selection based on availability and results

### 3.2 Step-by-Step Implementation Plan

#### Step 1: Add Tavily Constant and Enum Value

**File:** `/backend/src/constants/__init__.py`

```python
# In UserTokenKey Enum, add:
class UserTokenKey(Enum):
    # ... existing keys ...
    TAVILY_API_KEY = "TAVILY_API_KEY"  # Add this

# Add constant:
TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)
```

#### Step 2: Add Dependency

**File:** `/backend/pyproject.toml`

```toml
dependencies = [
    # ... existing dependencies ...
    "langchain-tavily>=0.1.0",
]
```

#### Step 3: Implement Search Provider Protocol

**File:** `/backend/src/tools/search.py`

Create a clean abstraction layer:

```python
from typing import Protocol, runtime_checkable
from abc import abstractmethod

@runtime_checkable
class SearchProvider(Protocol):
    """Protocol defining the search provider interface."""

    @abstractmethod
    async def search(self, query: str, num_results: int) -> list[dict]:
        """Execute search and return results."""
        ...

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is configured and available."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        ...
```

#### Step 4: Implement SearXNG Provider

```python
class SearxSearchProvider:
    """SearXNG search provider implementation."""

    def __init__(self, host_url: str | None = None):
        from src.constants import SEARX_SEARCH_HOST_URL
        self._host_url = host_url or SEARX_SEARCH_HOST_URL

    @property
    def name(self) -> str:
        return "SearXNG"

    @property
    def is_available(self) -> bool:
        return bool(self._host_url)

    async def search(self, query: str, num_results: int) -> list[dict]:
        if not self.is_available:
            return []

        searx = SearxSearchWrapper(searx_host=self._host_url)
        return await searx.aresults(query=query, num_results=num_results)
```

#### Step 5: Implement Tavily Provider

```python
class TavilySearchProvider:
    """Tavily search provider implementation (fallback)."""

    def __init__(self, api_key: str | None = None):
        from src.constants import TAVILY_API_KEY
        self._api_key = api_key or TAVILY_API_KEY

    @property
    def name(self) -> str:
        return "Tavily"

    @property
    def is_available(self) -> bool:
        return bool(self._api_key)

    async def search(self, query: str, num_results: int) -> list[dict]:
        if not self.is_available:
            return []

        from langchain_tavily import TavilySearch

        tavily = TavilySearch(
            api_key=self._api_key,
            max_results=num_results,
            topic="general",
        )

        # TavilySearch.invoke returns dict with 'results' key
        response = await tavily.ainvoke({"query": query})

        # Normalize response to match SearXNG format for consistency
        return self._normalize_results(response)

    def _normalize_results(self, response: dict) -> list[dict]:
        """Convert Tavily response to SearXNG-compatible format."""
        results = response.get("results", [])
        return [
            {
                "title": r.get("title", ""),
                "link": r.get("url", ""),
                "snippet": r.get("content", ""),
                "source": "tavily",
            }
            for r in results
        ]
```

#### Step 6: Implement Fallback Chain

```python
class SearchProviderChain:
    """Chain of search providers with fallback support."""

    def __init__(self, providers: list[SearchProvider]):
        self._providers = [p for p in providers if p.is_available]

    @property
    def available_providers(self) -> list[str]:
        return [p.name for p in self._providers]

    async def search(self, query: str, num_results: int) -> tuple[list[dict], str]:
        """
        Execute search with fallback.
        Returns (results, provider_name) tuple.
        """
        for provider in self._providers:
            try:
                logger.info(f"Attempting search with {provider.name}")
                results = await provider.search(query, num_results)

                if results:
                    logger.info(f"{provider.name} returned {len(results)} results")
                    return results, provider.name

                logger.warning(f"{provider.name} returned no results, trying next provider")

            except Exception as e:
                logger.warning(f"{provider.name} failed: {e}, trying next provider")
                continue

        return [], "none"
```

#### Step 7: Update web_search Tool

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
        - Uses SearXNG as primary search engine with Tavily API as fallback.

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
    # Initialize provider chain with priority order
    chain = SearchProviderChain([
        SearxSearchProvider(),
        TavilySearchProvider(),
    ])

    if not chain.available_providers:
        raise ToolException(
            "No search providers available. Configure SEARX_SEARCH_HOST_URL or TAVILY_API_KEY."
        )

    logger.info(f"Searching for '{query}' with {num_results} results")
    logger.info(f"Available providers: {chain.available_providers}")

    try:
        results, provider_used = await chain.search(query, num_results)

        if not results:
            logger.warning(f"No results found for query: {query}")
            # Return empty list instead of raising - allows agent to handle gracefully
            return []

        logger.info(f"Found {len(results)} results via {provider_used}")
        return results

    except Exception as e:
        logger.error(f"All search providers failed for query '{query}': {e}")
        raise ToolException(f"Search failed: {e}")
```

### 3.3 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/pyproject.toml` | Modify | Add `langchain-tavily>=0.1.0` dependency |
| `backend/src/constants/__init__.py` | Modify | Add `TAVILY_API_KEY` constant and enum |
| `backend/src/tools/search.py` | Major Modify | Add provider classes and fallback chain |

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Strategy Pattern | Simple if/else | Extensibility for future providers |
| Inline provider classes | Separate files | Single-file cohesion, providers are small |
| Return empty list on no results | Raise exception | Allows agent to continue gracefully |
| Normalize Tavily response | Return raw | Consistent interface across providers |
| Async-first design | Sync with threading | Matches existing codebase pattern |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Simple if/else fallback**
```python
# Rejected: Violates Open/Closed Principle
if not results and TAVILY_API_KEY:
    results = tavily_search(...)
```
- Hard to extend for additional providers
- Duplicate error handling logic
- Poor testability

**Alternative 2: Configuration-driven provider selection**
```python
# Rejected: Over-engineering for current requirements
providers = config.get("search_providers", ["searx", "tavily"])
```
- Added complexity without immediate benefit
- Configuration file management overhead

**Chosen Approach Benefits:**
- Clean separation of concerns (each provider is independent)
- Easy unit testing (mock individual providers)
- Simple to add new providers (implement protocol, add to chain)
- Consistent logging and error handling

### 4.3 Alignment with Existing Codebase Patterns

| Pattern | Example in Codebase | Applied Here |
|---------|---------------------|--------------|
| Async tool functions | `web_search`, `web_scrape` | All methods are async |
| ToolException for errors | `shell.py`, `retrieval.py` | Used for provider failures |
| Logger usage | Throughout `tools/` | Consistent logging |
| Optional env vars | `OLLAMA_BASE_URL`, etc. | Tavily is optional |
| Constants import | `from src.constants import X` | Used for env vars |

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tavily API rate limits | Medium | Medium | Log warnings, graceful degradation |
| Response format differences | Low | High | Normalize all responses to common format |
| Network timeout on fallback | Low | Medium | Use provider-specific timeouts |
| langchain-tavily breaking changes | Low | Medium | Pin version, test on upgrade |
| Agent still loops on truly empty queries | Low | Low | Return empty list, let agent handle |

### 5.2 Edge Cases to Handle

1. **Both providers unavailable:**
   - Raise clear ToolException with configuration guidance

2. **SearXNG returns empty but Tavily is not configured:**
   - Return empty list, log warning about configuring Tavily

3. **Query-specific failures (e.g., blocked terms):**
   - Try next provider regardless of error type

4. **Tavily returns results in different format:**
   - Normalize all responses through `_normalize_results()`

5. **Partial results from primary provider:**
   - Still try fallback if primary returns < num_results/2 (optional enhancement)

### 5.3 Testing Considerations

**Unit Tests Needed:**

```python
# tests/unit/tools/test_search.py

class TestSearxSearchProvider:
    async def test_search_success(self):
        ...

    async def test_search_empty_results(self):
        ...

    async def test_unavailable_when_no_url(self):
        ...

class TestTavilySearchProvider:
    async def test_search_success(self):
        ...

    async def test_response_normalization(self):
        ...

    async def test_unavailable_when_no_api_key(self):
        ...

class TestSearchProviderChain:
    async def test_fallback_on_empty_results(self):
        ...

    async def test_fallback_on_exception(self):
        ...

    async def test_no_providers_available(self):
        ...

class TestWebSearchTool:
    async def test_integration_with_chain(self):
        ...
```

**Integration Tests:**
- Test with real SearXNG instance (if available in CI)
- Test with Tavily API key in CI secrets

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Metric | Value | Justification |
|--------|-------|---------------|
| **Scope** | **Medium** | New classes, but contained in single file |
| **Risk Level** | **Low** | Optional fallback, existing functionality preserved |
| **LOC Added** | ~150 | Provider classes + chain + updated tool |
| **LOC Modified** | ~20 | Constants file additions |
| **Files Changed** | 3 | pyproject.toml, constants/__init__.py, search.py |
| **New Dependencies** | 1 | langchain-tavily |

### 6.2 Implementation Priority Order

1. **Phase 1 (Required):**
   - Add `TAVILY_API_KEY` to constants
   - Add `langchain-tavily` dependency
   - Implement basic fallback in `web_search`

2. **Phase 2 (Recommended):**
   - Extract provider classes for clean architecture
   - Add comprehensive unit tests
   - Add logging for observability

3. **Phase 3 (Optional):**
   - Add metrics/telemetry for provider usage
   - Configuration for provider priority
   - Admin UI for search provider status

### 6.3 Effort Estimate

| Task | Effort |
|------|--------|
| Constants update | 15 min |
| Dependency addition | 5 min |
| Provider implementations | 1 hour |
| Tool update | 30 min |
| Unit tests | 1.5 hours |
| Integration testing | 30 min |
| Documentation update | 15 min |
| **Total** | **~4 hours** |

---

## 7. Appendix

### 7.1 Complete Proposed Implementation

See Step 3-7 in Section 3.2 for the full code implementation.

### 7.2 Response Format Normalization

**SearXNG Response Format:**
```python
{
    "title": "Page Title",
    "link": "https://example.com",
    "snippet": "Page description...",
    # Additional fields vary
}
```

**Tavily Response Format:**
```python
{
    "results": [
        {
            "title": "Page Title",
            "url": "https://example.com",
            "content": "Page description...",
            "score": 0.95,
            "raw_content": "..."
        }
    ],
    "query": "original query",
    "response_time": 1.23
}
```

**Normalized Format (output):**
```python
{
    "title": "Page Title",
    "link": "https://example.com",  # Standardized key
    "snippet": "Page description...",  # Standardized key
    "source": "searx" | "tavily",  # Provider attribution
}
```

### 7.3 Environment Configuration Example

```bash
# .env
# Primary search (existing)
SEARX_SEARCH_HOST_URL="http://localhost:8080"

# Fallback search (new)
TAVILY_API_KEY="tvly-xxxxxxxxxxxxx"
```

### 7.4 References

- [LangChain Tavily Documentation](https://docs.langchain.com/oss/python/integrations/tools/tavily_search)
- [langchain-tavily PyPI](https://pypi.org/project/langchain-tavily/)
- [Tavily API Documentation](https://www.tavily.com/)
- [GitHub Issue #634](https://github.com/ruska-ai/orchestra/issues/634)

---

## 8. Conclusion

This proposal provides a robust, maintainable solution to the empty search results problem. By implementing the Strategy Pattern with a provider chain, we:

1. **Solve the immediate problem:** Agents no longer get stuck in loops when SearXNG returns empty results
2. **Maintain backward compatibility:** Existing users without Tavily keys see no change
3. **Enable future extensibility:** Adding new providers requires only implementing the protocol
4. **Follow SOLID principles:** Each component has a single responsibility, the system is open for extension but closed for modification

The estimated 4-hour implementation time provides high value for relatively low effort, making this a recommended priority for improved agent reliability.
