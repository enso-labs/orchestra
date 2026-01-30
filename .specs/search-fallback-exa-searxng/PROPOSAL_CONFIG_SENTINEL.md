# CONFIG_SENTINEL Proposal: Exa Primary Search with SearXNG Fallback

## 1. Executive Summary

The system currently uses SearXNG as the primary search provider with Tavily as fallback, configured via environment variables in `backend/src/constants/__init__.py`. This proposal describes the configuration changes needed to make Exa the primary search provider and demote SearXNG to fallback, including new env vars, feature flags for provider priority, and deployment considerations to ensure zero-downtime migration.

## 2. Current Configuration Analysis

### 2.1 Environment Variables (from `backend/.example.env`)

```
SEARX_SEARCH_HOST_URL="http://localhost:8080"
TAVILY_API_KEY=
```

- `SEARX_SEARCH_HOST_URL` -- defaults to `http://localhost:8080` in constants (always truthy unless explicitly blank).
- `TAVILY_API_KEY` -- optional, no default.
- **No Exa configuration exists anywhere in the codebase.**

### 2.2 Constants Module (`backend/src/constants/__init__.py`)

The `UserTokenKey` enum defines the tool-related keys that can also be stored per-user:

```python
SEARX_SEARCH_HOST_URL = "SEARX_SEARCH_HOST_URL"
TAVILY_API_KEY = "TAVILY_API_KEY"
```

Module-level variables read from env:

```python
SEARX_SEARCH_HOST_URL = os.getenv(UserTokenKey.SEARX_SEARCH_HOST_URL.value, "http://localhost:8080")
TAVILY_API_KEY = os.getenv(UserTokenKey.TAVILY_API_KEY.value)
```

**Key observation:** `SEARX_SEARCH_HOST_URL` has a hardcoded default, meaning it is _always_ configured unless the operator explicitly sets it to an empty string. This makes SearXNG the implicit primary.

### 2.3 Search Tool (`backend/src/tools/search.py`)

The `web_search` function implements a two-phase fallback chain:

1. **Phase 1 (Primary):** SearXNG -- attempted if `SEARX_SEARCH_HOST_URL` is truthy.
2. **Phase 2 (Fallback):** Tavily -- attempted if Phase 1 fails/returns empty AND `TAVILY_API_KEY` is truthy.
3. **Phase 3:** Raises `ToolException` if no providers are configured, or returns `[]`.

The fallback logic is clean and extensible -- each provider returns `(results, error)` tuples.

### 2.4 Tool Registration (`backend/src/tools/__init__.py`)

`SEARCH_TOOLS` is imported from `search.py` and included in `default_tools()`. Search tools are always available. There is no per-provider tool -- a single `web_search` tool handles provider selection internally.

### 2.5 Agent Tool Binding (`backend/src/agents/__init__.py`)

Tools are resolved by name from `default_tools()` via `init_tools()`. The agent's `tools` array contains tool names (strings), matched against the tool library. The search provider is transparent to agents -- they only see `web_search`.

## 3. Proposed Configuration

### 3.1 New Environment Variables

Add to `backend/.example.env`:

```bash
#########################################################
## Tool (Secrets and Config used by Agent Tools)
#########################################################
SEARX_SEARCH_HOST_URL="http://localhost:8080"
SHELL_EXEC_SERVER_URL="http://localhost:3005/exec"
TAVILY_API_KEY=
EXA_API_KEY=

## Search Provider Priority (comma-separated, first = primary)
## Options: exa, searxng, tavily
## Default: exa,searxng,tavily
# SEARCH_PROVIDER_PRIORITY="exa,searxng,tavily"
```

### 3.2 Constants Changes (`backend/src/constants/__init__.py`)

Add to `UserTokenKey` enum:

```python
EXA_API_KEY = "EXA_API_KEY"
```

Add module-level variables:

```python
EXA_API_KEY = os.getenv(UserTokenKey.EXA_API_KEY.value)

# Search provider priority chain (comma-separated)
# Controls the order in which search providers are attempted.
# Default: "exa,searxng,tavily" (Exa primary, SearXNG first fallback, Tavily second)
SEARCH_PROVIDER_PRIORITY = os.getenv("SEARCH_PROVIDER_PRIORITY", "exa,searxng,tavily")
```

### 3.3 Search Tool Changes (`backend/src/tools/search.py`)

Replace the hardcoded Phase 1/Phase 2 logic with a priority-driven loop:

```python
# In web_search():
from src.constants import SEARX_SEARCH_HOST_URL, TAVILY_API_KEY, EXA_API_KEY, SEARCH_PROVIDER_PRIORITY

PROVIDER_REGISTRY = {
    "exa": lambda q, n, **kw: _search_with_exa(q, n, EXA_API_KEY),
    "searxng": lambda q, n, **kw: _search_with_searx(q, n, SEARX_SEARCH_HOST_URL, kw.get("engines", ["google"]), kw.get("categories", ["general"])),
    "tavily": lambda q, n, **kw: _search_with_tavily(q, n, TAVILY_API_KEY),
}

PROVIDER_AVAILABLE = {
    "exa": bool(EXA_API_KEY),
    "searxng": bool(SEARX_SEARCH_HOST_URL),
    "tavily": bool(TAVILY_API_KEY),
}

# Then iterate in priority order, skip unavailable, attempt each, fallback on failure/empty.
```

### 3.4 New Exa Provider Helper

Add `_search_with_exa` and `_normalize_exa_results` functions following the exact same `(results, error)` pattern as the existing Tavily and SearXNG helpers.

```python
def _normalize_exa_results(exa_response) -> list:
    """Convert Exa response to match SearXNG result format."""
    normalized = []
    for item in exa_response.results:
        normalized.append({
            "title": item.title or "",
            "link": item.url or "",
            "snippet": item.text or item.highlights[0] if item.highlights else "",
            "score": item.score if hasattr(item, "score") else 0.0,
            "source": "exa",
        })
    return normalized

async def _search_with_exa(query: str, num_results: int, api_key: str) -> tuple[list, Exception | None]:
    """Execute search using Exa API. Returns (results, error) tuple."""
    try:
        from exa_py import Exa
        exa = Exa(api_key=api_key)
        response = exa.search(query, num_results=num_results, type="neural")
        results = _normalize_exa_results(response)
        return results, None
    except Exception as e:
        return [], e
```

### 3.5 Feature Flag: `SEARCH_PROVIDER_PRIORITY`

This is a single string env var rather than multiple boolean flags. Benefits:

- **One variable controls everything** -- no combinatorial explosion of `SEARCH_USE_EXA=true`, `SEARCH_EXA_PRIMARY=true`, etc.
- **Operator sets priority explicitly** -- e.g., `"searxng,tavily"` to exclude Exa entirely, or `"exa"` for Exa-only.
- **Backward compatible** -- defaults to `"exa,searxng,tavily"` which satisfies the feature request. Operators who don't set it get the new behavior. Operators who want the old behavior set `"searxng,tavily"`.

### 3.6 SearXNG Default Change

**Critical:** The current default for `SEARX_SEARCH_HOST_URL` is `"http://localhost:8080"`, which means SearXNG is always "configured" even when no SearXNG instance exists. This should be changed:

```python
# Before:
SEARX_SEARCH_HOST_URL = os.getenv(UserTokenKey.SEARX_SEARCH_HOST_URL.value, "http://localhost:8080")

# After:
SEARX_SEARCH_HOST_URL = os.getenv(UserTokenKey.SEARX_SEARCH_HOST_URL.value)
```

Remove the default so that SearXNG is only attempted when explicitly configured. The Docker Compose setup should set this explicitly.

## 4. Deployment Considerations

### 4.1 New Dependency

Add `exa-py` to the project dependencies:

```
uv add exa-py
```

### 4.2 Docker Compose

No SearXNG container changes needed. Operators who run SearXNG already have `SEARX_SEARCH_HOST_URL` set explicitly.

### 4.3 Required Operator Actions

| Scenario | Action |
|---|---|
| **New deployment (Exa primary)** | Set `EXA_API_KEY=<key>`. Default priority handles the rest. |
| **Existing deployment (keep SearXNG primary)** | Set `SEARCH_PROVIDER_PRIORITY="searxng,tavily"` or `"searxng,exa,tavily"`. |
| **Exa-only (no SearXNG)** | Set `EXA_API_KEY=<key>`. Don't set `SEARX_SEARCH_HOST_URL`. |
| **Disable Exa after free tier exhausted** | Remove `EXA_API_KEY` or set `SEARCH_PROVIDER_PRIORITY="searxng,tavily"`. |

### 4.4 Exa Free Tier Exhaustion Detection

When Exa's free tier runs out, the API returns a 429 or 402 error. The `_search_with_exa` function catches this as an exception, and the fallback chain proceeds to SearXNG. **No special handling is needed** -- the existing `(results, error)` pattern handles this automatically.

However, for observability, the search function should log the specific error type:

```python
if exa_error:
    logger.warning(f"[Exa] Search failed (will fallback): {type(exa_error).__name__}: {exa_error}")
```

### 4.5 Per-User Token Override

The `UserTokenKey` enum already supports per-user API key storage. Adding `EXA_API_KEY` to the enum means individual users can provide their own Exa key, overriding the system default. The tool invocation path in `init_tools` and `ToolService` already respects per-user metadata.

## 5. Backward Compatibility

### 5.1 No Breaking Changes IF:

1. **`SEARX_SEARCH_HOST_URL` default is removed** (see 3.6). Existing deployments that run SearXNG via Docker Compose already set this explicitly in their `.env` file. The only risk is bare-metal dev setups that relied on the implicit `localhost:8080` default -- these should add `SEARX_SEARCH_HOST_URL=http://localhost:8080` to their env file.

2. **`SEARCH_PROVIDER_PRIORITY` defaults to `"exa,searxng,tavily"`**. If no `EXA_API_KEY` is set, Exa is skipped (not available), and the chain falls through to SearXNG then Tavily -- identical to current behavior.

### 5.2 Migration Checklist

- [ ] Existing `.env` files that rely on SearXNG: no change needed (it's explicitly set).
- [ ] Existing `.env` files that rely on Tavily: no change needed.
- [ ] Dev environments relying on `localhost:8080` default: add `SEARX_SEARCH_HOST_URL=http://localhost:8080` to env.
- [ ] `backend/.example.env` updated with new vars and comments.

## 6. Risk Assessment

### 6.1 Missing Configuration Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `EXA_API_KEY` not set | High (new var) | None -- Exa skipped, falls to SearXNG/Tavily | Documented in `.example.env`. Log info-level message at startup listing active providers. |
| `SEARX_SEARCH_HOST_URL` default removed, dev env breaks | Medium | Search fails in dev | Document in changelog. `.example.env` includes it. |
| Invalid `SEARCH_PROVIDER_PRIORITY` value | Low | Unknown provider name ignored | Validate at startup, log warning for unrecognized provider names. |
| All providers fail | Low | `web_search` returns `[]` | Existing behavior -- agent handles empty results gracefully. |

### 6.2 Misconfiguration Scenarios

| Scenario | Behavior |
|---|---|
| `SEARCH_PROVIDER_PRIORITY="exa"` but no `EXA_API_KEY` | No providers available. `ToolException` raised. |
| `SEARCH_PROVIDER_PRIORITY=""` (empty string) | No providers in chain. `ToolException` raised. |
| `SEARCH_PROVIDER_PRIORITY="foo,bar"` | Unrecognized names skipped. No providers available. `ToolException` raised. |
| Exa free tier exhausted mid-request | Exa returns error, fallback to SearXNG seamlessly. |
| SearXNG container down | SearXNG returns error, fallback to Tavily. |

### 6.3 Startup Validation Recommendation

Add a startup log that reports active search configuration:

```python
# In search.py or constants
providers = [p.strip() for p in SEARCH_PROVIDER_PRIORITY.split(",")]
active = [p for p in providers if PROVIDER_AVAILABLE.get(p)]
logger.info(f"[Search] Provider priority: {providers}")
logger.info(f"[Search] Active providers (credentials present): {active}")
if not active:
    logger.warning("[Search] No search providers are configured!")
```

## 7. Files to Modify

| File | Change |
|---|---|
| `backend/.example.env` | Add `EXA_API_KEY=` and `SEARCH_PROVIDER_PRIORITY` |
| `backend/src/constants/__init__.py` | Add `EXA_API_KEY` to `UserTokenKey` enum and module-level vars; add `SEARCH_PROVIDER_PRIORITY` |
| `backend/src/tools/search.py` | Add `_search_with_exa`, `_normalize_exa_results`; refactor `web_search` to use priority loop |
| `pyproject.toml` or equivalent | Add `exa-py` dependency |
