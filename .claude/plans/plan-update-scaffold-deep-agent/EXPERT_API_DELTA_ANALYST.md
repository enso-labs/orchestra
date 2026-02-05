# API Delta Analysis: `create_deep_agent()` — Orchestra vs Latest deepagents

**Analyst**: API Delta Analyst
**Date**: 2026-02-04
**Scope**: Compare Orchestra's current `create_deep_agent()` usage against the latest installed API signature, identify all gaps, conflicts, and migration paths.

---

## 1. Parameter Gap Analysis

### 1.1 Parameter Comparison Table

| Parameter | Latest API Type | Orchestra Uses? | Current Value | Recommendation |
|---|---|---|---|---|
| `model` | `str \| BaseChatModel \| None` | YES | `llm` (BaseChatModel) | No change needed |
| `tools` | `Sequence[BaseTool \| Callable \| dict]` | YES | `tools` (list[BaseTool]) | No change needed |
| `system_prompt` | `str \| SystemMessage \| None` | YES | `system_prompt` (str) | Consider `SystemMessage` for cache control headers |
| `middleware` | `Sequence[AgentMiddleware]` | YES | Custom stack via `init_default_middleware()` | **CRITICAL: Review for conflicts with internal stack** |
| `subagents` | `list[SubAgent \| CompiledSubAgent] \| None` | YES | `subagents` (list[dict]) | Check `CompiledSubAgent` support |
| `skills` | `list[str] \| None` | **NO** | N/A | **NEW** - enables `SkillsMiddleware` internally |
| `memory` | `list[str] \| None` | **NO** | N/A | **NEW** - enables `MemoryMiddleware` internally; replaces Orchestra's manual memory injection |
| `response_format` | `ResponseFormat \| None` | **NO** | N/A | **NEW** - structured output format |
| `context_schema` | `type[Any] \| None` | YES | `ContextSchema` | No change needed |
| `checkpointer` | `Checkpointer \| None` | YES | `checkpointer` | No change needed |
| `store` | `BaseStore \| None` | YES | `store` | No change needed |
| `backend` | `BackendProtocol \| BackendFactory \| None` | YES | `backend` (CompositeBackend) | **NEW**: Now also accepts `BackendFactory` (callable) |
| `interrupt_on` | `dict[str, bool \| InterruptOnConfig] \| None` | **NO** | N/A | **NEW** - enables `HumanInTheLoopMiddleware` |
| `debug` | `bool` | YES | `APP_ENV == "development" or APP_ENV == "test"` | No change needed |
| `name` | `str \| None` | **NO** | N/A | **NEW** - agent naming for tracing/logging |
| `cache` | `BaseCache \| None` | YES | `CACHE_LLM` (InMemoryCache) | No change needed |

### 1.2 New Parameters Not Used by Orchestra

#### `skills: list[str] | None`
- **Purpose**: Activates `SkillsMiddleware(backend, sources)` internally when provided. Skills are loaded from the backend by name.
- **Orchestra equivalent**: No direct equivalent exists. Orchestra has no skill concept today.
- **Priority**: LOW - Can be adopted incrementally if/when Orchestra adds a skills system.

#### `memory: list[str] | None`
- **Purpose**: Activates `MemoryMiddleware(backend, sources)` internally when provided. The middleware automatically injects memory context from the backend store into system prompts.
- **Orchestra equivalent**: Orchestra has a **manual memory injection** system:
  - `add_memories_to_system()` in `backend/src/agents/__init__.py` (lines 36-56) fetches memories and appends XML-formatted context to the system prompt.
  - `init_memories()` (lines 153-156) adds memory tools and prompt.
  - `MEMORY_TOOLS` in `backend/src/tools/memory.py` provides `upsert_memory`, `delete_memory`, `search_memory`, `update_memory`.
- **Priority**: MEDIUM - Adopting this could replace Orchestra's manual memory injection with a declarative approach. However, the memory tools (`MEMORY_TOOLS`) are separate and would remain.
- **Risk**: The internal `MemoryMiddleware` reads from the backend store, which uses `StoreBackend` routes like `/users/{user_id}/memories/`. Orchestra already sets up these routes in `LLMController.init_backend()`. This is a **positive alignment** -- the data layer is already compatible.

#### `response_format: ResponseFormat | None`
- **Purpose**: Enforces a structured output format (e.g., JSON schema) on the LLM response.
- **Orchestra equivalent**: None. Orchestra currently has `generate_files` and `target_file` in `LLMRequest` for file generation, but no general structured output.
- **Priority**: LOW - Useful for specific API endpoints but not required for the chat interface.

#### `interrupt_on: dict[str, bool | InterruptOnConfig] | None`
- **Purpose**: Activates `HumanInTheLoopMiddleware` internally. Allows the agent to pause and request human confirmation before executing certain tool calls.
- **Orchestra equivalent**: None. There is no human-in-the-loop pattern today.
- **Priority**: MEDIUM - Important for safety-critical tool calls (e.g., file deletion, code execution). Would need frontend support for the interrupt/resume flow.

#### `name: str | None`
- **Purpose**: Names the agent for tracing, logging, and LangSmith observability. Appears in LangGraph traces.
- **Orchestra equivalent**: Orchestra passes `graph_id="deepagent"` to the `Orchestra` class but this is not forwarded to `create_deep_agent()`.
- **Priority**: LOW - Simple one-line change. Pass `name="deepagent"` or a dynamic name based on the assistant slug.
- **Recommendation**: Pass `name=subagent.slug` or a descriptive identifier for better debugging.

---

## 2. Middleware Conflict Analysis

### 2.1 Internal vs External Middleware Stack

The latest `create_deep_agent()` auto-applies the following internal middleware stack:

| Position | Internal Middleware | Auto-applied? | Orchestra Equivalent | Conflict? |
|---|---|---|---|---|
| 1 | `TodoListMiddleware()` | Always | None | No conflict |
| 2 | `MemoryMiddleware(backend, sources)` | If `memory` provided | Manual injection in `add_memories_to_system()` | No conflict today (memory param not used) |
| 3 | `SkillsMiddleware(backend, sources)` | If `skills` provided | None | No conflict |
| 4 | `FilesystemMiddleware(backend)` | Always | None | No conflict |
| 5 | `SubAgentMiddleware(...)` | Always (with subagents) | None | No conflict |
| 6 | **`SummarizationMiddleware(model, backend, ...)`** | **Always** | **`compaction_middleware`** (Orchestra custom) | **CRITICAL CONFLICT** |
| 7 | `AnthropicPromptCachingMiddleware(...)` | Always | None | No conflict |
| 8 | `PatchToolCallsMiddleware()` | Always | None | No conflict |
| 9 | User-provided `middleware` (appended) | From Orchestra | Orchestra's full stack | **SEE BELOW** |
| 10 | `HumanInTheLoopMiddleware(interrupt_on)` | If `interrupt_on` provided | None | No conflict |

### 2.2 CRITICAL: Duplicate SummarizationMiddleware

**Finding**: The internal `create_deep_agent()` now **always auto-applies `SummarizationMiddleware`** (position 6). Orchestra also provides its own `compaction_middleware` (a `@wrap_model_call` decorator wrapping `SummarizationMiddleware`) via `init_default_middleware()` (position 1 in Orchestra's custom stack).

**Result**: **Two summarization/compaction passes will run on every model call**:
1. Internal `SummarizationMiddleware` runs at position 6 (before user middleware).
2. Orchestra's `compaction_middleware` runs as part of user middleware (position 9).

**Impact**:
- Double summarization wastes tokens and LLM calls.
- The two implementations may use different models, thresholds, and strategies, leading to inconsistent behavior.
- Orchestra's implementation (in `backend/src/utils/compacting.py`) uses `DEFAULT_COMPACTION_MODEL` (a low-cost model), `DEFAULT_COMPACTION_TOKEN_THRESHOLD` (170k tokens), and `DEFAULT_COMPACTION_RECENT_MESSAGES` (6 messages).
- The internal `SummarizationMiddleware` likely has its own defaults for model, trigger threshold, and keep count.

**Historical context**: The comment at the top of `backend/src/utils/compacting.py` (lines 3-7) states:
```
# US-001 Finding: deepagents==0.3.8 does NOT ship internal SummarizationMiddleware.
# Decision: Proceed with Phase 2B (full Orchestra implementation).
```
This was true for v0.3.8 but is **no longer true** for the current version.

**Recommendation**: **Remove `compaction_middleware` from `init_default_middleware()`** and rely on the internal `SummarizationMiddleware`. If Orchestra needs to customize the summarization behavior (different model, threshold, etc.), pass those as configuration to `create_deep_agent()` if the API supports it, or accept the internal defaults.

### 2.3 Orchestra User Middleware Stack (Position 9)

Orchestra's `init_default_middleware()` returns:
```python
[
    compaction_middleware,           # (1) CONFLICTS with internal SummarizationMiddleware
    add_ai_message_metadata,        # (2) @after_model - attaches model name to AI messages
    retry_model,                    # (3) @wrap_model_call - retries failed model calls 3x
    PIIMiddleware("credit_card"),   # (4) Masks credit card numbers
    PIIMiddleware("api_key"),       # (5) Blocks API keys matching sk-*
    AutoEvictMiddleware(backend),   # (6) Evicts large tool results to filesystem
]
```

Additional middleware is appended by `construct_agent()` callers (the `middleware` parameter in `init_graph()`):
```python
middleware=init_default_middleware(backend=backend) + middleware
```

**Potential Issues**:
- `add_ai_message_metadata`: Runs after the internal stack. Should be fine; no ordering dependency with internal middleware.
- `retry_model`: Wraps model calls with retry logic. Runs after internal `PatchToolCallsMiddleware`. Should be fine.
- `PIIMiddleware` instances: Run after the internal `AnthropicPromptCachingMiddleware`. No conflict.
- `AutoEvictMiddleware(backend)`: **Potential overlap with `FilesystemMiddleware(backend)`**. The internal `FilesystemMiddleware` handles file I/O for the agent's virtual filesystem. `AutoEvictMiddleware` specifically handles evicting large tool results to the filesystem. These serve different purposes, but both interact with the backend's `write()` method. **LOW RISK** -- they operate on different triggers (file operations vs. large tool output).

### 2.4 Middleware Ordering Summary

After `create_deep_agent()` builds the full stack, the effective order is:

```
1.  TodoListMiddleware               (internal)
2.  FilesystemMiddleware             (internal)
3.  SubAgentMiddleware               (internal)
4.  SummarizationMiddleware          (internal)  <-- AUTO-APPLIED
5.  AnthropicPromptCachingMiddleware (internal)
6.  PatchToolCallsMiddleware         (internal)
7.  compaction_middleware            (Orchestra)  <-- DUPLICATE SUMMARIZATION
8.  add_ai_message_metadata          (Orchestra)
9.  retry_model                      (Orchestra)
10. PIIMiddleware("credit_card")     (Orchestra)
11. PIIMiddleware("api_key")         (Orchestra)
12. AutoEvictMiddleware              (Orchestra)
```

---

## 3. Breaking Changes

### 3.1 No Breaking Changes in Existing Parameters

The latest API signature is **backward-compatible** with Orchestra's current usage:
- All currently-used parameters (`model`, `tools`, `subagents`, `system_prompt`, `checkpointer`, `context_schema`, `middleware`, `store`, `cache`, `backend`, `debug`) retain their existing types and positions.
- The `backend` parameter now **also** accepts `BackendFactory` (a callable), which is additive, not breaking.
- The `system_prompt` parameter now **also** accepts `SystemMessage`, which is additive.

### 3.2 Behavioral Change: Auto-applied SummarizationMiddleware

While not a "breaking" API change, the **automatic application of `SummarizationMiddleware`** is a **behavioral change** that will affect Orchestra:
- Messages may be summarized twice per model call.
- The internal middleware runs **before** Orchestra's user middleware, so it will summarize messages before Orchestra's `compaction_middleware` sees them. This means Orchestra's compaction may never trigger (the internal one reduces token count below threshold) or may trigger on already-summarized content.

### 3.3 Behavioral Change: Auto-applied AnthropicPromptCachingMiddleware

The internal stack includes `AnthropicPromptCachingMiddleware(unsupported_model_behavior="ignore")`. This middleware modifies system messages to include Anthropic-specific cache control headers. For non-Anthropic models, it silently ignores the unsupported behavior. **LOW RISK** -- the `unsupported_model_behavior="ignore"` flag ensures no breakage for OpenAI/Google/etc. models.

### 3.4 Behavioral Change: Auto-applied PatchToolCallsMiddleware

The internal `PatchToolCallsMiddleware` automatically patches tool call formatting. If Orchestra relies on specific tool call formatting, this could affect behavior. **LOW RISK** -- this is generally a correctness improvement.

---

## 4. Migration Recommendations

### Priority 1 (CRITICAL) -- Remove Duplicate Summarization

**File**: `backend/src/utils/middleware.py`
**Change**: Remove `compaction_middleware` from `init_default_middleware()`.

```python
# BEFORE
def init_default_middleware(backend=None):
    return [
        compaction_middleware,           # REMOVE THIS
        add_ai_message_metadata,
        retry_model,
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ]

# AFTER
def init_default_middleware(backend=None):
    return [
        add_ai_message_metadata,
        retry_model,
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ]
```

**Impact**: Fixes double-summarization. The internal `SummarizationMiddleware` will handle compaction.
**Test updates needed**: `test_middleware_integration.py` assertions about stack length (6 -> 5) and first-in-stack position.

### Priority 2 (HIGH) -- Pass `name` Parameter

**File**: `backend/src/agents/__init__.py`
**Change**: Add `name` parameter to `create_deep_agent()` call in `init_graph()`.

```python
deep_agent = create_deep_agent(
    model=llm,
    tools=tools,
    subagents=subagents,
    system_prompt=system_prompt,
    checkpointer=checkpointer,
    context_schema=context_schema,
    middleware=init_default_middleware(backend=backend) + middleware,
    store=store,
    cache=CACHE_LLM,
    backend=backend,
    debug=APP_ENV == "development" or APP_ENV == "test",
    name="orchestra",  # NEW
)
```

**Impact**: Improves tracing and debugging in LangSmith.

### Priority 3 (MEDIUM) -- Evaluate `memory` Parameter Adoption

**File**: `backend/src/agents/__init__.py`
**Change**: Instead of manually injecting memory context via `add_memories_to_system()`, pass memory source identifiers to the `memory` parameter.

**Current flow**:
1. `init_memories()` calls `add_memories_to_system()` to fetch memories and append XML context to system prompt.
2. Memory tools (`MEMORY_TOOLS`) are added to the tool list.

**Proposed flow**:
1. Pass `memory=["memories"]` (or appropriate source names) to `create_deep_agent()`.
2. The internal `MemoryMiddleware` handles context injection automatically.
3. Memory tools (`MEMORY_TOOLS`) continue to be passed as tools.

**Risk**: Requires understanding what memory source identifiers the internal `MemoryMiddleware` expects and whether the backend store routes (`/users/{user_id}/memories/`) are compatible.

**Recommendation**: Investigate the `MemoryMiddleware` source to understand the expected source format before migrating. This can be done as a follow-up task.

### Priority 4 (MEDIUM) -- Evaluate `interrupt_on` for Safety-Critical Tools

**File**: `backend/src/agents/__init__.py`
**Change**: Add `interrupt_on` configuration for tools that should require human confirmation.

**Example**:
```python
interrupt_on={
    "delete_file": True,
    "execute_code": {"require_confirmation": True},
}
```

**Impact**: Adds a safety layer for destructive operations. Requires frontend changes to handle the interrupt/resume flow.

### Priority 5 (LOW) -- Evaluate `response_format` for Structured Outputs

**File**: Various controllers
**Change**: Pass `response_format` when structured output is needed.

**Use cases**: File generation (`generate_files=True`), API-facing structured responses.

### Priority 6 (LOW) -- Update `compacting.py` Header Comment

**File**: `backend/src/utils/compacting.py`
**Change**: Update the outdated comment block:

```python
# BEFORE (lines 3-7):
# US-001 Finding: deepagents==0.3.8 does NOT ship internal SummarizationMiddleware.
# ...
# Decision: Proceed with Phase 2B (full Orchestra implementation).

# AFTER:
# NOTE: As of deepagents >= X.Y.Z, create_deep_agent() auto-applies an internal
# SummarizationMiddleware. This custom implementation is retained only as a reference
# or fallback. The compaction_middleware is no longer included in init_default_middleware().
```

### Priority 7 (LOW) -- Consider `BackendFactory` Pattern

**File**: `backend/src/agents/__init__.py`
**Change**: The `backend` parameter now accepts `BackendFactory` (a callable `(ToolRuntime) -> BackendProtocol`). Orchestra's `init_backend()` function in `backend/src/agents/__init__.py` is already a factory pattern but is called eagerly. Consider passing it as a lazy factory.

**Current**:
```python
backend = self.init_backend(params)  # Eagerly creates backend
agent = await construct_agent(..., backend=backend)
```

**Proposed**:
```python
def backend_factory(runtime: ToolRuntime) -> CompositeBackend:
    return self.init_backend_from_runtime(runtime)
agent = await construct_agent(..., backend=backend_factory)
```

**Impact**: Deferred initialization, potentially cleaner runtime management.
**Risk**: LOW -- Current eager approach works fine.

---

## 5. Risk Assessment

### 5.1 High Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double summarization degrades quality | **HIGH** (happens now) | **MEDIUM** - Wasted tokens, potential context loss | Remove `compaction_middleware` from default stack (Priority 1) |
| Internal SummarizationMiddleware defaults differ from Orchestra's | **HIGH** | **MEDIUM** - Different threshold/model may change when compaction triggers | Test with production-like conversation lengths; tune internal defaults if configurable |

### 5.2 Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Removing compaction_middleware breaks tests | **HIGH** | **LOW** - Only `test_middleware_integration.py` needs updating | Update test assertions for stack length and ordering |
| `AnthropicPromptCachingMiddleware` adds unexpected headers | **LOW** | **LOW** - `unsupported_model_behavior="ignore"` prevents errors | Monitor non-Anthropic model behavior after migration |
| Memory middleware adoption changes memory injection behavior | **MEDIUM** | **MEDIUM** - Different formatting, timing of memory context | Phase memory adoption separately; keep manual injection as fallback initially |

### 5.3 Low Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `PatchToolCallsMiddleware` changes tool call format | **LOW** | **LOW** - Generally a correctness improvement | Monitor tool call success rates |
| `TodoListMiddleware` conflicts with Orchestra todo tracking | **LOW** | **LOW** - Orchestra tracks todos in `stream.py` state | Verify todo state is compatible |
| `FilesystemMiddleware` overlaps with `AutoEvictMiddleware` | **LOW** | **LOW** - Different triggers and purposes | No action needed; monitor |

### 5.4 Migration Safety Checklist

- [ ] Remove `compaction_middleware` from `init_default_middleware()`.
- [ ] Update `test_middleware_integration.py` to reflect new stack length (5 items).
- [ ] Update header comment in `compacting.py`.
- [ ] Add `name="orchestra"` to `create_deep_agent()` call.
- [ ] Run full test suite: `make test`.
- [ ] Test with a long conversation (>170k estimated tokens) to verify internal summarization triggers correctly.
- [ ] Test with Anthropic and non-Anthropic models to verify `AnthropicPromptCachingMiddleware` behavior.
- [ ] Evaluate `memory` parameter adoption as a separate follow-up task.

---

## 6. Summary of Key Files

| File | Role | Changes Needed? |
|---|---|---|
| `backend/src/agents/__init__.py` | Main agent construction; calls `create_deep_agent()` | YES - Add `name` param; eventually `memory`, `interrupt_on` |
| `backend/src/utils/middleware.py` | Custom middleware stack definition | YES - Remove `compaction_middleware` |
| `backend/src/utils/compacting.py` | Custom `SummarizationMiddleware` implementation | YES - Update comment; mark as retained-reference |
| `backend/src/controllers/llm.py` | LLM controller; constructs backend and agents | NO immediate changes |
| `backend/src/utils/stream.py` | Streaming implementation | NO immediate changes |
| `backend/src/tools/memory.py` | Memory tools (CRUD) | NO immediate changes (tools remain regardless of memory param) |
| `backend/src/schemas/entities/llm.py` | Request/response schemas | NO immediate changes |
| `backend/src/constants/llm.py` | LLM constants, compaction defaults | NO immediate changes |
| `backend/tests/unit/utils/test_middleware_integration.py` | Middleware stack tests | YES - Update assertions |

---

## 7. Orchestra `init_graph()` Proposed Signature Change

The `init_graph()` function signature should be updated to accept the new parameters:

```python
def init_graph(
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    system_prompt: str = None,
    model: str = DEFAULT_CHAT_MODEL,
    context_schema: Type[ContextSchema] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    middleware: list[Callable] = None,
    backend: CompositeBackend = None,
    api_key: str | None = None,
    # NEW PARAMETERS:
    name: str | None = None,
    memory: list[str] | None = None,
    response_format: Any | None = None,
    interrupt_on: dict | None = None,
    skills: list[str] | None = None,
) -> CompiledStateGraph:
```

And the `Orchestra` class and `construct_agent()` would need to propagate these new parameters through. This ensures the full API surface is available to Orchestra consumers.
