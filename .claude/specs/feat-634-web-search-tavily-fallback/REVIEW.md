# Council Review: Web Search Tavily Fallback

**GitHub Issue:** #634
**Feature:** IF default search does not return results, fall back to Tavily API
**Review Date:** 2026-01-13
**Proposals Reviewed:** ARCHITECT, CRAFTSMAN, GUARDIAN

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Architecture** | Chain of Responsibility with helper function | Strategy Pattern with Protocol/Classes | Helper functions with tuple returns | **Helper functions** (simpler, matches codebase) |
| **Maintainability** | Good - single helper function | Excellent - extensible abstraction | Good - clean separation | **Helper functions** (sufficient for 2 providers) |
| **Risk Level** | Low | Low | Low-Medium | **Low** (all agree) |
| **Completeness** | Full implementation + tests | Full implementation + tests | Full implementation + tests | **All complete** |
| **Complexity** | ~100 LOC | ~150 LOC | ~100-150 LOC | **~100 LOC target** |
| **Error Handling** | Silent fallback, return empty | Silent fallback, return empty | Tuple returns, return empty | **Return empty on failure** |
| **Test Coverage** | Unit tests provided | Unit tests outlined | Unit tests outlined | **Unit tests required** |

---

## 2. Consensus Points

All three proposals agree on the following critical aspects:

### 2.1 Dependency
```toml
"langchain-tavily>=0.2.16"  # Official LangChain integration
```

### 2.2 Constants Addition
```python
# UserTokenKey enum
TAVILY_API_KEY = "TAVILY_API_KEY"

# Module-level constant
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
```

### 2.3 Fallback Strategy
- **Primary:** SearXNG (existing behavior)
- **Fallback:** Tavily API (only when primary fails/empty)
- **Sequential, not parallel** - saves API quota

### 2.4 Result Normalization
Convert Tavily response format to match SearXNG:
```python
{
    "title": item.get("title", ""),
    "link": item.get("url", ""),      # url -> link
    "snippet": item.get("content", ""), # content -> snippet
    "source": "tavily",               # provider attribution
}
```

### 2.5 Error Handling Philosophy
- Return empty list on all-provider failure (not exception)
- This prevents agent loops (the core issue in #634)
- Only raise `ToolException` when no providers configured

### 2.6 Lazy Imports
Import Tavily inside function to:
- Avoid circular imports
- Only load when needed
- Allow graceful degradation

---

## 3. Divergence Analysis

### 3.1 Architecture Pattern

| Approach | Proposal | Trade-off |
|----------|----------|-----------|
| **Helper Function** | ARCHITECT | Simple, matches codebase, less extensible |
| **Protocol/Classes** | CRAFTSMAN | More extensible, more code, over-engineering for 2 providers |
| **Tuple Returns** | GUARDIAN | Clean error handling, slightly unusual pattern |

**Council Decision:** Use **helper function approach** (ARCHITECT style) with **tuple returns** (GUARDIAN style) for clean error handling. This balances simplicity with maintainability.

### 3.2 Logging Detail

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN |
|--------|-----------|-----------|----------|
| Provider tags | `[SearXNG]`, `[Tavily]` | Provider name in log | Generic messages |
| API key logging | Never log keys | Never log keys | Explicit warning about key exposure |

**Council Decision:** Use bracketed provider tags `[SearXNG]`, `[Tavily]` for clear observability. **Never log API keys.**

### 3.3 Test File Location

| Proposal | Location |
|----------|----------|
| ARCHITECT | `backend/tests/unit/tools/test_search.py` |
| CRAFTSMAN | `backend/tests/unit/tools/test_search.py` |
| GUARDIAN | `backend/tests/unit/tools/test_search.py` |

**Council Decision:** All agree - `backend/tests/unit/tools/test_search.py`

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
web_search(query, num_results)
    |
    v
[SEARX_SEARCH_HOST_URL configured?]
    |
    +-- Yes --> _search_with_searx(query, num_results)
    |               |
    |               +-- (results, None) --> Return results
    |               |
    |               +-- ([], error) or ([], None) --> Continue to fallback
    |
    +-- No --> Continue to fallback
    |
    v
[TAVILY_API_KEY configured?]
    |
    +-- Yes --> _search_with_tavily(query, num_results)
    |               |
    |               +-- (results, None) --> Return results
    |               |
    |               +-- ([], error) --> Log warning, continue
    |
    +-- No --> Continue
    |
    v
[Neither configured?] --> Raise ToolException
    |
    v
Return []  # Both failed/empty, prevent agent loops
```

### 4.2 Implementation Sequence

1. **Add dependency** (`pyproject.toml`)
2. **Add constants** (`constants/__init__.py`)
3. **Implement helper functions** (`search.py`)
4. **Update web_search tool** (`search.py`)
5. **Add unit tests** (`tests/unit/tools/test_search.py`)
6. **Run format and tests** (`make format && make test`)

### 4.3 Critical Path Items

1. **Must normalize Tavily results** - ensures downstream compatibility
2. **Must return empty list** on all-provider failure - prevents agent loops
3. **Must use lazy imports** - Tavily only loaded when needed
4. **Must never log API keys** - security requirement

### 4.4 Non-negotiable Requirements

- [ ] `langchain-tavily>=0.2.16` dependency
- [ ] `TAVILY_API_KEY` in `UserTokenKey` enum and as constant
- [ ] Fallback only triggers on empty/error (not preemptively)
- [ ] Normalized result format with `source` field
- [ ] Return `[]` instead of exception when all providers fail
- [ ] Unit tests for all fallback paths

---

## 5. Risk Consolidation

### 5.1 Combined Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Source |
|------|------------|--------|------------|--------|
| Tavily API rate limits | Medium | Medium | Only use as fallback | All |
| Response format mismatch | Low | Medium | Normalization layer | ARCHITECT, GUARDIAN |
| API key in logs | Low | High | Never log keys | GUARDIAN |
| Dependency conflicts | Low | Medium | Pin version `>=0.2.16` | CRAFTSMAN |
| Network timeouts | Low | Low | Default httpx timeout | GUARDIAN |
| Agent loops persist | Very Low | High | Return empty list | All |

### 5.2 Mitigation Strategies

1. **Rate Limits:** Only invoke Tavily when SearXNG fails/empty
2. **Format Mismatch:** `_normalize_tavily_results()` function isolates changes
3. **API Key Security:** Log messages use generic references, never values
4. **Dependencies:** Test with `uv sync` before merge
5. **Timeouts:** Accept default timeouts; fallback handles failures gracefully

---

## 6. Final Verdict

### 6.1 Recommendation: **GO**

All three proposals recommend implementation with consistent approaches. The feature:
- Directly addresses GitHub Issue #634 (agent loops on empty results)
- Is backward compatible (existing users unaffected)
- Requires minimal code changes (~100 LOC)
- Has clear testing strategy
- Follows existing codebase patterns

### 6.2 Confidence Level: **High**

- Unanimous agreement on core approach
- Well-understood LangChain patterns
- Official Tavily integration package
- Isolated changes with no breaking impacts

### 6.3 Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `backend/pyproject.toml` | Add dependency | P0 |
| `backend/src/constants/__init__.py` | Add constant | P0 |
| `backend/src/tools/search.py` | Add fallback logic | P0 |
| `backend/tests/unit/tools/test_search.py` | Create tests | P1 |

### 6.4 Acceptance Criteria

- [ ] SearXNG success returns results (no fallback)
- [ ] SearXNG empty triggers Tavily fallback
- [ ] SearXNG exception triggers Tavily fallback
- [ ] Tavily results normalized to match SearXNG format
- [ ] Both providers fail returns empty list (not exception)
- [ ] No providers configured raises clear ToolException
- [ ] All unit tests pass
- [ ] `make format` and `make test` succeed

---

## 7. Implementation Notes

### 7.1 Recommended Code Structure

```python
# backend/src/tools/search.py

async def _search_with_searx(query: str, num_results: int, searx_url: str) -> tuple[list, Exception | None]:
    """SearXNG search with error handling."""
    ...

async def _search_with_tavily(query: str, num_results: int, api_key: str) -> tuple[list, Exception | None]:
    """Tavily search with result normalization."""
    ...

def _normalize_tavily_results(response: dict) -> list:
    """Convert Tavily response to SearXNG format."""
    ...

@tool
async def web_search(query: str, num_results: Optional[int] = 5) -> list:
    """Web search with automatic Tavily fallback."""
    ...
```

### 7.2 Logging Format

```python
logger.info(f"[SearXNG] Searching for '{query}' with {num_results} results")
logger.info(f"[SearXNG] Found {len(results)} results")
logger.warning(f"[SearXNG] Search failed: {error}")
logger.info("[Tavily] Attempting fallback search")
logger.info(f"[Tavily] Fallback returned {len(results)} results")
logger.warning(f"All search providers returned no results for: {query}")
```

---

**Council Review Status:** Complete
**Recommendation:** Proceed to TASKS.md generation
**Next Phase:** Task Contract Generation (Phase 3)
