# Plan: Provider-Side Prompt Cache for Token Cost Reduction

## Context

The user wants to reduce token costs by implementing provider-side prompt caching for Anthropic and OpenAI. After thorough investigation:

- **Anthropic prompt caching is already active** via `deepagents`' built-in `AnthropicPromptCachingMiddleware`
- **OpenAI prompt caching is automatic** (no API changes needed)
- **BUT** the current `init_system_prompt()` defeats caching by building a single string with dynamic metadata (UTC time) that changes every request, invalidating the entire system prompt cache
- **Orchestra is 12 versions behind** on `deepagents` (0.3.8 vs 0.4.11 used by LangChain's [openshell-deepagent](https://github.com/langchain-ai/openshell-deepagent) reference implementation)

## How Prompt Caching Works

### Anthropic
- Caches content up to `cache_control` breakpoints. Subsequent requests with matching prefixes pay 0.1x (90% savings)
- Cache writes cost 1.25x, cache reads **0.1x** of normal input price
- `AnthropicPromptCachingMiddleware` adds `cache_control` to model settings

### OpenAI
- Automatic prefix caching, cached tokens billed at **50%** of normal price
- No API changes needed - longer stable message prefixes = more savings

### Current Problem
`init_system_prompt()` in `format.py` returns a **single string** with dynamic metadata (UTC time, timezone) appended. Since the time changes every request, the **entire** system prompt cache is invalidated every time. The fix: use `SystemMessage` with content blocks — static prompt in cacheable blocks at the top, dynamic metadata in a separate uncached block at the bottom.

## Changes

### Step 1: Upgrade `deepagents` and dependencies
**File: `backend/pyproject.toml`**

```
"deepagents==0.3.8"  →  "deepagents>=0.4.11"
```

Verified upgrade path (via `uv pip install --dry-run`):
| Package | Current | Upgraded |
|---------|---------|----------|
| `deepagents` | 0.3.8 | 0.4.11 |
| `anthropic` | 0.75.0 | 0.86.0 |
| `langchain` | 1.2.7 | 1.2.12 |
| `langchain-anthropic` | 1.3.1 | 1.4.0 |
| `langchain-core` | 1.2.7 | 1.2.20 |
| `langgraph` | 1.0.7 | 1.1.3 |

After upgrade: run `uv sync` and `make test` to verify. Fix any import/API breakages.

### Step 2: Restructure `init_system_prompt()` for cache-optimal content blocks
**File: `backend/src/utils/format.py`**

Change `init_system_prompt()` to return a `SystemMessage` with content blocks instead of a plain string. Structure:

- **Block 1** (top, static, cached): Base system prompt text with `cache_control: {"type": "ephemeral"}`
- **Block 2** (static per assistant, cached): Instructions with `cache_control: {"type": "ephemeral"}` (if present)
- **Block 3** (bottom, dynamic, NOT cached): Metadata — `CURRENT_UTC`, `LOCAL_TIME`, `TIMEZONE`, `LANGUAGE`

This mirrors the openshell-deepagent pattern of clean prompt formatting, but uses `SystemMessage` content blocks for cache optimization. `create_deep_agent()` already supports `SystemMessage` input (deepagents/graph.py:228-234) and appends `BASE_AGENT_PROMPT` as an additional block.

Add import: `from langchain_core.messages import SystemMessage`

Return type changes from `-> str` to `-> str | SystemMessage`.

**File: `backend/src/agents/__init__.py`**

Update type annotations that flow through from `init_system_prompt()`:
- `init_graph()`: `system_prompt: str = None` → `system_prompt: str | SystemMessage | None = None`
- `Orchestra.__init__()`: `system_prompt: str | None = None` → `system_prompt: str | SystemMessage | None = None`
- Add `SystemMessage` import

`construct_agent()` signature stays `system_prompt: str` since it receives the raw string before `init_system_prompt()` converts it.

### Step 3: Add cache metrics logging middleware
**File: `backend/src/utils/middleware.py`**

Add a `@wrap_model_call` middleware that extracts cache usage from `AIMessage.usage_metadata` after each model call and logs structured metrics. Follows the exact pattern of `retry_model`.

Key fields to extract:
- `usage_metadata.input_token_details.cache_creation` (Anthropic: tokens written to cache)
- `usage_metadata.input_token_details.cache_read` (Anthropic: tokens read from cache)
- `usage_metadata.input_tokens`, `output_tokens`, `total_tokens`
- Computed `cache_hit_ratio = cache_read / input_tokens * 100`

Log format: structured key=value for log aggregation.

Add `cache_metrics_middleware` to `init_default_middleware()` at position 2 (after `add_ai_message_metadata`, before `retry_model`). Ensures it logs once per successful call, after retries complete.

### Step 4: Add configurable Anthropic cache TTL
**File: `backend/src/constants/llm.py`**

```python
ANTHROPIC_PROMPT_CACHE_TTL = os.getenv("ANTHROPIC_PROMPT_CACHE_TTL", "5m")
```
Valid values: `"5m"` (default) or `"1h"`.

**File: `backend/src/utils/middleware.py`**

In `init_default_middleware()`, conditionally append an `AnthropicPromptCachingMiddleware` with the configured TTL when env var is non-default. Orchestra's middleware is **inner** to deepagents' middleware, so our TTL overrides theirs.

### Step 5: Update `.example.env`
**File: `backend/.example.env`**

```
# Anthropic Prompt Cache TTL (valid: "5m" or "1h", default: "5m")
# ANTHROPIC_PROMPT_CACHE_TTL=5m
```

### Step 6: Update tests

**File: `backend/tests/unit/utils/test_cache_metrics.py`** (new)
- Test metrics logging when `usage_metadata` has cache data
- Test no-op when `usage_metadata` is `None`
- Test no-op when response has no `AIMessage`
- Test graceful handling of missing `input_token_details`
- Test correct cache hit ratio computation

**File: `backend/tests/unit/utils/test_middleware_integration.py`**
- Update stack length assertion from 6 to 7

**File: `backend/tests/unit/agents/test_prompt_caching.py`**
- Update existing tests for `SystemMessage` return type from `init_system_prompt()`
- Add test verifying static blocks have `cache_control` and dynamic metadata block does not
- Add test for TTL override middleware inclusion when env var is non-default

**File: `backend/tests/benchmarks/test_service_benchmarks.py`**
- Update `init_system_prompt` benchmark assertions to handle `SystemMessage` return type

## Files to Modify

| File | Change |
|------|--------|
| `backend/pyproject.toml` | Bump `deepagents==0.3.8` → `deepagents>=0.4.11` |
| `backend/src/utils/format.py` | Restructure `init_system_prompt()` → `SystemMessage` with content blocks |
| `backend/src/agents/__init__.py` | Update type annotations for `SystemMessage` flow |
| `backend/src/utils/middleware.py` | Add `cache_metrics_middleware`, TTL override in `init_default_middleware()` |
| `backend/src/constants/llm.py` | Add `ANTHROPIC_PROMPT_CACHE_TTL` constant |
| `backend/.example.env` | Add `ANTHROPIC_PROMPT_CACHE_TTL` documentation |
| `backend/tests/unit/utils/test_cache_metrics.py` | New test file for cache metrics middleware |
| `backend/tests/unit/utils/test_middleware_integration.py` | Update stack length 6 → 7 |
| `backend/tests/unit/agents/test_prompt_caching.py` | Update for SystemMessage, add TTL tests |
| `backend/tests/benchmarks/test_service_benchmarks.py` | Update benchmark assertions |

## Existing Code to Reuse

- `@wrap_model_call` from `langchain.agents.middleware` (pattern: `retry_model` in `middleware.py`)
- `AnthropicPromptCachingMiddleware` from `langchain_anthropic.middleware`
- `SystemMessage` from `langchain_core.messages` (already imported in `format.py`)
- `_safe_int_env` pattern in `constants/llm.py` for env var parsing
- `create_deep_agent()` SystemMessage handling (deepagents/graph.py:228-234)

## Verification

1. `uv sync` after pyproject.toml change
2. `make format` — code style compliance
3. `make test` — all tests pass including new and updated ones
4. Verify `init_system_prompt()` returns `SystemMessage` with correct block structure:
   - Static blocks have `cache_control: {"type": "ephemeral"}`
   - Dynamic metadata block has NO `cache_control`
5. Check structured logs when running with Anthropic model — should see `prompt_cache_metrics` with `cache_read_tokens > 0` on 2nd+ call in a conversation
6. Set `ANTHROPIC_PROMPT_CACHE_TTL=1h` and verify middleware stack includes the override
