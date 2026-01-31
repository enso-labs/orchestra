# Proposal: Add Compacting Middleware to DeepAgents

**Author:** AGENT_1 (MIDDLEWARE_ARCHITECT)
**Issue:** #555
**Date:** 2026-01-31

---

## 1. Executive Summary

The `deepagents` package (v0.3.8) already auto-applies `SummarizationMiddleware` inside `create_deep_agent()` with sensible defaults (85% context fraction or 170k tokens). Orchestra's `init_default_middleware()` in `backend/src/utils/middleware.py` adds its own middleware layer (PII, retry, auto-evict, metadata) that is concatenated with the deepagents-internal stack. This proposal defines how to expose compacting configuration to Orchestra users, introduce a `CompactingMiddleware` base class for extensibility, and make token thresholds configurable through the assistant settings API.

---

## 2. Architectural Analysis

### 2.1 Current State

**Middleware Pipeline (two layers):**

1. **Orchestra layer** (`src/utils/middleware.py` -> `init_default_middleware()`):
   - `add_ai_message_metadata` (after_model hook)
   - `retry_model` (wrap_model_call, 3 retries)
   - `PIIMiddleware` (credit card masking, API key blocking)
   - `AutoEvictMiddleware` (evicts large tool results to filesystem)

2. **DeepAgents layer** (inside `create_deep_agent()` in the installed `deepagents==0.3.8`):
   - `TodoListMiddleware`
   - `MemoryMiddleware` (optional)
   - `SkillsMiddleware` (optional)
   - `FilesystemMiddleware`
   - `SubAgentMiddleware`
   - `SummarizationMiddleware` (hardcoded trigger/keep values)
   - `AnthropicPromptCachingMiddleware`
   - `PatchToolCallsMiddleware`

**Agent construction flow:**
```
stream_generator() -> construct_agent() -> Orchestra.__init__() -> init_graph() -> create_deep_agent()
```

In `init_graph()` (line 88 of `backend/src/agents/__init__.py`):
```python
middleware=init_default_middleware(backend=backend) + middleware,
```
Orchestra's middleware list is passed as the `middleware` parameter to `create_deep_agent()`, which appends it **after** the internal deepagent middleware stack (line 220-221 of `deepagents/graph.py`):
```python
if middleware:
    deepagent_middleware.extend(middleware)
```

**Key finding:** `SummarizationMiddleware` is already auto-applied inside `create_deep_agent()`. The trigger defaults are:
- If model has `profile.max_input_tokens`: `("fraction", 0.85)` trigger, `("fraction", 0.10)` keep
- Fallback: `("tokens", 170000)` trigger, `("messages", 6)` keep

**These values are hardcoded in `deepagents/graph.py`** and not currently configurable from Orchestra.

### 2.2 Proposed Changes

Three changes are needed:

1. **Pass-through configuration** -- Allow Orchestra to override the `SummarizationMiddleware` trigger/keep values that `create_deep_agent()` uses internally.
2. **CompactingMiddleware base class** -- An abstract base in Orchestra for building custom compaction strategies beyond summarization.
3. **User-configurable thresholds** -- Expose token threshold settings through the assistant configuration.

### 2.3 Integration Points

| File | Role | Change Type |
|------|------|-------------|
| `backend/src/utils/middleware.py` | Middleware factory | Add `CompactingMiddleware` base class, add `SummarizationMiddleware` wrapper |
| `backend/src/agents/__init__.py` | Agent construction | Pass summarization config to `create_deep_agent()`, accept threshold params |
| `backend/src/schemas/entities/llm.py` | Schema definitions | Add compacting config fields to assistant schema |
| `backend/src/utils/stream.py` | Stream generator | Pass config from assistant settings through to agent construction |
| `backend/src/services/abort.py` | (inspect only) | Verify middleware does not conflict with abort logic |

---

## 3. Implementation Strategy

### Step 1: Define CompactingMiddleware Base Class

**File:** `backend/src/utils/middleware.py`

Add an abstract base class that any compaction strategy can extend. This follows the same pattern as `AgentMiddleware` from `langchain.agents.middleware.types`.

```python
from abc import ABC, abstractmethod
from typing import Any
from langchain.agents.middleware.types import AgentMiddleware

class CompactingMiddleware(AgentMiddleware, ABC):
    """Base class for message compaction middleware.

    Subclasses implement a strategy for reducing context window usage
    when message history grows beyond a threshold.
    """

    def __init__(
        self,
        *,
        trigger: tuple[str, int | float] | None = None,
        keep: tuple[str, int | float] = ("messages", 6),
    ) -> None:
        self.trigger = trigger
        self.keep = keep

    @abstractmethod
    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:
        """Compact messages before model invocation."""
        ...

    @abstractmethod
    async def abefore_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:
        """Async version of before_model."""
        ...
```

### Step 2: Create Configurable Summarization Wrapper

**File:** `backend/src/utils/middleware.py`

Since `create_deep_agent()` hardcodes `SummarizationMiddleware` internally, Orchestra has two options:

**Option A (Recommended):** Pass summarization config parameters through to `create_deep_agent()` if the deepagents API supports it. Currently it does NOT -- the trigger/keep values are computed internally. This requires a change to the `deepagents` package to accept optional `summarization_trigger` and `summarization_keep` parameters.

**Option B (Immediate, no upstream change):** Add a *second* `SummarizationMiddleware` instance in Orchestra's middleware list with the user's custom thresholds. The deepagents internal one would still fire at 85%/170k, but Orchestra's would fire at the user's lower threshold first. Since `SummarizationMiddleware.before_model()` is a no-op when thresholds are not met, only the first triggered middleware would actually summarize.

**Option C (Fork the call):** Instead of using `create_deep_agent()`, call `create_agent()` directly from Orchestra, assembling the full middleware stack manually. This gives full control but increases maintenance burden.

**Recommendation:** Option A with a fallback to Option B.

For Option A, add to `create_deep_agent()` signature:
```python
def create_deep_agent(
    ...,
    summarization_trigger: tuple[str, int | float] | None = None,
    summarization_keep: tuple[str, int | float] | None = None,
    truncate_args_settings: dict | None = None,
)
```

For Option B (immediate implementation without upstream change):
```python
def init_summarization_middleware(
    model: str,
    backend: BackendProtocol,
    trigger: tuple[str, int | float] = ("tokens", 170000),
    keep: tuple[str, int | float] = ("messages", 6),
) -> SummarizationMiddleware:
    """Create a SummarizationMiddleware with custom thresholds."""
    from deepagents.middleware.summarization import SummarizationMiddleware
    return SummarizationMiddleware(
        model=model,
        backend=backend,
        trigger=trigger,
        keep=keep,
        trim_tokens_to_summarize=None,
    )
```

### Step 3: Add Configuration Schema

**File:** `backend/src/schemas/entities/llm.py` (or a new schema file)

```python
from pydantic import BaseModel, Field
from typing import Literal

class CompactingConfig(BaseModel):
    """Configuration for context compaction middleware."""
    enabled: bool = True
    trigger_type: Literal["tokens", "messages", "fraction"] = "tokens"
    trigger_value: int | float = 170000
    keep_type: Literal["tokens", "messages", "fraction"] = "messages"
    keep_value: int | float = 6
    truncate_args: bool = True
    truncate_args_max_length: int = 2000
```

This schema should be embedded in the `Assistant` model so users can configure it per-assistant.

### Step 4: Wire Configuration Through Agent Construction

**File:** `backend/src/agents/__init__.py`

Modify `init_graph()` and `construct_agent()` to accept and pass through compacting configuration:

```python
def init_graph(
    ...,
    compacting_config: CompactingConfig | None = None,
) -> CompiledStateGraph:
    # If using Option B, add custom SummarizationMiddleware to middleware list
    extra_middleware = []
    if compacting_config and compacting_config.enabled:
        extra_middleware.append(
            init_summarization_middleware(
                model=model,
                backend=backend,
                trigger=(compacting_config.trigger_type, compacting_config.trigger_value),
                keep=(compacting_config.keep_type, compacting_config.keep_value),
            )
        )

    deep_agent = create_deep_agent(
        ...,
        middleware=init_default_middleware(backend=backend) + extra_middleware + middleware,
    )
```

### Step 5: Pass Config from Stream Generator

**File:** `backend/src/utils/stream.py`

Extract compacting config from the assistant settings and pass through `construct_agent()`:

```python
agent = await construct_agent(
    ...,
    compacting_config=assistant.compacting_config,  # from assistant settings
)
```

---

## 4. Design Decisions

### Decision 1: Where to apply SummarizationMiddleware

| Approach | Pros | Cons |
|----------|------|------|
| **A: Upstream param** | Clean, single middleware instance | Requires deepagents release |
| **B: Double middleware** | No upstream change needed | Two summarization middlewares in stack; first-to-trigger wins, slight overhead |
| **C: Fork create_agent** | Full control | High maintenance, diverges from upstream |

**Choice:** Start with Option B for immediate value; pursue Option A in deepagents v0.4.x.

### Decision 2: Configuration granularity

Per-assistant configuration is preferred over global settings because different assistants may have different context window requirements (e.g., a coding assistant with large file contexts vs. a chat assistant with short messages).

### Decision 3: CompactingMiddleware as ABC

Making it an abstract base class rather than a protocol allows:
- Shared helper methods (token counting, message partitioning)
- Default `trigger`/`keep` fields
- Future subclasses like `TruncationMiddleware` (drop old messages without summarization) or `SelectiveCompactingMiddleware` (compact only tool results)

### Decision 4: Interaction with AutoEvictMiddleware

`AutoEvictMiddleware` handles large **individual** tool results (>10k tokens per result). `SummarizationMiddleware` handles **cumulative** context growth. They are complementary and operate at different granularities. No conflict.

---

## 5. Risk Assessment

### Pitfall 1: Double Summarization
With Option B, both the internal deepagents `SummarizationMiddleware` and Orchestra's custom instance will be in the pipeline. If both trigger simultaneously, messages could be summarized twice in one model call.

**Mitigation:** Set Orchestra's custom trigger to a *lower* threshold than the deepagents default (e.g., 60% vs 85%). The custom middleware fires first (it appears earlier in the stack via the `middleware` param which is appended after the internal stack -- actually, it is appended AFTER, so it fires later).

**Correction:** Since Orchestra's middleware is appended via `deepagent_middleware.extend(middleware)` (line 221 of deepagents/graph.py), Orchestra's middleware runs AFTER the internal stack. This means the internal `SummarizationMiddleware` at 85% fires FIRST. Orchestra's would then see already-summarized messages and not re-trigger (since context is now small).

**Revised mitigation:** For Option B to work with *lower* thresholds, Orchestra would need its middleware to run BEFORE the internal one. This is not possible with the current `create_deep_agent()` API. This reinforces the need for **Option A** (upstream parameter).

**Interim approach:** For v1, only expose the ability to *disable* summarization or accept the default. For custom thresholds, require Option A (upstream change to deepagents).

### Pitfall 2: Token Counting Cost
`count_tokens_approximately` is cheap (character-based heuristic). No concern here.

### Pitfall 3: Summary Quality Degradation
Summarization uses the same model as the agent. For long conversations, the summary itself may be lossy. The backend offload mitigates this by preserving full history.

### Edge Cases
- **Empty message history:** `before_model` returns `None`, no-op. Safe.
- **Only system messages:** Summarization partitioning preserves system messages. Safe.
- **Concurrent streams:** Each stream has its own agent instance. No shared state risk.
- **Checkpoint recovery:** Summarized messages are checkpointed. Resuming from a checkpoint sees the post-summarization state, which is correct.

---

## 6. Estimated Complexity

### Scope

| Component | Effort | Files Changed |
|-----------|--------|---------------|
| `CompactingMiddleware` base class | Small (1-2 hours) | `backend/src/utils/middleware.py` |
| `CompactingConfig` schema | Small (30 min) | `backend/src/schemas/entities/llm.py` |
| Wire config through agent construction | Medium (2-3 hours) | `agents/__init__.py`, `utils/stream.py` |
| Option A: upstream deepagents change | Medium (2-3 hours) | External: `deepagents/graph.py` |
| Unit tests | Medium (2-3 hours) | `backend/tests/unit/utils/test_middleware.py` |
| Integration tests | Medium (2-3 hours) | `backend/tests/integration/` |

**Total estimated effort:** 10-14 hours

### Risk Level: Low-Medium

- Low risk for the base class and schema additions (additive, no breaking changes)
- Medium risk for the middleware ordering concern (Option B double-summarization)
- Low risk if Option A is implemented upstream first

### Priority Order

1. **P0:** Add `CompactingMiddleware` base class and `CompactingConfig` schema (foundation)
2. **P0:** Upstream change to `deepagents` to accept configurable trigger/keep in `create_deep_agent()`
3. **P1:** Wire configuration through `construct_agent()` and `stream_generator()`
4. **P1:** Unit tests for `CompactingMiddleware` and configuration propagation
5. **P2:** Integration tests with actual token-heavy conversations
6. **P2:** Frontend UI for configuring compacting settings per assistant

---

## Appendix: Key File References

| File | Purpose |
|------|---------|
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/agents/__init__.py` | Agent construction (`init_graph`, `construct_agent`, `Orchestra` class) |
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/middleware.py` | Orchestra middleware (`init_default_middleware`, `AutoEvictMiddleware`, PII, retry) |
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/stream.py` | Stream generator (wires agent construction with SSE streaming) |
| `/home/ryaneggz/ruska-ai/orchestra/backend/.venv/lib/python3.12/site-packages/deepagents/graph.py` | `create_deep_agent()` -- builds internal middleware stack including `SummarizationMiddleware` |
| `/home/ryaneggz/ruska-ai/orchestra/backend/.venv/lib/python3.12/site-packages/deepagents/middleware/summarization.py` | `SummarizationMiddleware` with backend offloading, truncation, and summary generation |
