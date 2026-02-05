# Backend Integration Plan: `create_deep_agent()` Scaffold Update

**Issue**: #734 -- Update backend scaffolding to leverage new `deepagents` customization features
**Author**: Backend Integration Architect
**Date**: 2026-02-04

---

## 1. Conflict Resolution Plan

### 1A. Double Summarization -- CRITICAL

**The Problem**

Orchestra has **two** summarization paths that will both execute:

1. **Internal** (`deepagents`): `SummarizationMiddleware` is auto-applied inside `create_deep_agent()` at line 208 of `graph.py`. It uses model-profile-aware triggers (85% fraction / 170k tokens fallback), offloads evicted messages to backend as markdown, and produces a `HumanMessage` with `lc_source='summarization'`.

2. **Orchestra-custom** (`backend/src/utils/compacting.py`): `compaction_middleware` is a `@wrap_model_call` decorator that runs Orchestra's own `SummarizationMiddleware` class (completely different from the deepagents one). It uses `DEFAULT_COMPACTION_TOKEN_THRESHOLD` (170k) and `DEFAULT_COMPACTION_RECENT_MESSAGES` (6), generates an LLM summary, and replaces old messages with a `SystemMessage` prefixed `[CONVERSATION SUMMARY]`.

**Why it is dangerous**: The internal `SummarizationMiddleware` runs as part of the `deepagent_middleware` stack (position 5 of 7+), BEFORE Orchestra's custom middleware is appended (line 220-221: `deepagent_middleware.extend(middleware)`). If both fire:
- Internal summarization replaces old messages with a `HumanMessage` summary + backend offload.
- Orchestra's `compaction_middleware` then sees the reduced message list and may trigger again (or not, depending on token counts), but even if it does not re-trigger, its `estimate_tokens` heuristic (`len(content) // 4`) is different from the internal one (`count_tokens_approximately`), causing unpredictable behavior.

**Resolution: Remove Orchestra's custom compaction middleware**

Rationale:
- The internal `SummarizationMiddleware` is **strictly superior**: it uses model profiles for adaptive triggers, offloads to backend for full history retrieval, handles `RemoveMessage` properly, and truncates large tool call arguments.
- Orchestra's custom `SummarizationMiddleware` uses a simplistic `len(content) // 4` heuristic and lacks backend offloading.
- The comment at the top of `compacting.py` (lines 3-7) itself notes this was built because "deepagents==0.3.8 does NOT ship internal SummarizationMiddleware." That version is now outdated -- the internal middleware exists.

**Action Items**:
1. Remove `compaction_middleware` from `init_default_middleware()` in `backend/src/utils/middleware.py`.
2. Keep `compacting.py` file temporarily (mark as deprecated) for rollback safety, but it should not be imported.
3. Update `init_default_middleware()` to no longer import `compaction_middleware`.
4. The internal middleware's trigger/keep settings are computed in `create_deep_agent()` based on model profile -- these are good defaults. No custom override is needed initially.

### 1B. Memory Injection Duplication -- MODERATE

**The Problem**

Orchestra has two memory injection paths:

1. **Orchestra-custom** (`add_memories_to_system()` in `agents/__init__.py`): Called via `init_memories()`, fetches from `memory_service.search()` (LangGraph Store), formats as XML `<memory>` tags, appends to system prompt string, and also adds `MEMORY_TOOLS` to the tool list.

2. **Internal** (`MemoryMiddleware`): Loads AGENTS.md files from backend paths, injects into system prompt via `modify_request()`. Uses `<agent_memory>` XML tags with learning guidelines. Entirely different purpose -- project context vs. user memories.

**Key Insight**: These serve **different purposes** and are NOT actually duplicating:
- `add_memories_to_system()` loads **user memories** (todos, notes, reminders) from the LangGraph Store via `memory_service`.
- `MemoryMiddleware` loads **project context** (AGENTS.md files) from the backend filesystem.

**Resolution: Keep both, but migrate AGENTS.md loading to `memory` parameter**

1. **Keep** `add_memories_to_system()` and `MEMORY_TOOLS` -- these handle user memories (store-based), which `MemoryMiddleware` does not address.
2. **Add** the `memory` parameter to `init_graph()` to pass AGENTS.md paths to `create_deep_agent()`. This replaces any manual system-prompt injection of project context.
3. **Future consideration**: If Orchestra wants user memories to also flow through `MemoryMiddleware`, it would need a `StoreBackend`-based path, but this is out of scope for this issue.

### 1C. Middleware Ordering -- LOW

**Current order** in `init_graph()` line 88:
```python
middleware=init_default_middleware(backend=backend) + middleware
```

This means Orchestra's custom middleware is appended AFTER the internal stack in `create_deep_agent()` (line 220-221). The internal order is:
```
TodoListMiddleware -> [MemoryMiddleware] -> [SkillsMiddleware] -> FilesystemMiddleware -> SubAgentMiddleware -> SummarizationMiddleware -> AnthropicPromptCachingMiddleware -> PatchToolCallsMiddleware -> [Orchestra's middleware]
```

With `compaction_middleware` removed, the remaining Orchestra middleware (`add_ai_message_metadata`, `retry_model`, PII middlewares, `AutoEvictMiddleware`) are all fine running after the internal stack. No ordering conflicts exist.

---

## 2. Schema Changes

### 2A. `LLMRequest` (backend/src/schemas/entities/llm.py)

Add the following optional fields:

```python
class LLMRequest(BaseModel):
    # ... existing fields ...

    # New fields for deepagents integration
    skills: Optional[List[str]] = Field(
        default=None,
        description="List of skill source paths (e.g., ['/skills/user/', '/skills/project/']). "
                    "Paths are relative to the backend root.",
    )
    memory: Optional[List[str]] = Field(
        default=None,
        description="List of AGENTS.md file paths to load as agent memory "
                    "(e.g., ['/memory/AGENTS.md']). Loaded at agent startup into system prompt.",
    )
    agent_name: Optional[str] = Field(
        default=None,
        description="Name for the agent instance, used for identification in logs and subagent calls.",
    )
    response_format: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured output response format configuration.",
    )
    interrupt_on: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Mapping of tool names to interrupt configs for human-in-the-loop. "
                    "Example: {'edit_file': True, 'execute': {'message': 'Approve?'}}",
    )
```

### 2B. `Assistant` (backend/src/schemas/entities/llm.py)

Add the following optional fields:

```python
class Assistant(BaseModel):
    # ... existing fields ...

    # New fields for deepagents integration
    skills: Optional[List[str]] = Field(
        default=None,
        description="Skill source paths for this assistant.",
    )
    memory: Optional[List[str]] = Field(
        default=None,
        description="AGENTS.md paths for this assistant's project context.",
    )
    agent_name: Optional[str] = Field(
        default=None,
        description="Agent name for this assistant.",
    )
    response_format: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured output format for this assistant.",
    )
    interrupt_on: Optional[Dict[str, Any]] = Field(
        default=None,
        description="HITL interrupt configuration for this assistant.",
    )
```

Update `to_llm_request()` to propagate new fields:

```python
def to_llm_request(self, input, model=None, metadata=None) -> "LLMRequest":
    return LLMRequest(
        # ... existing fields ...
        skills=self.skills,
        memory=self.memory,
        agent_name=self.agent_name,
        response_format=self.response_format,
        interrupt_on=self.interrupt_on,
    )
```

### 2C. `Config` (backend/src/schemas/entities/llm.py)

No changes needed. The `Config` model already has `extra="allow"`.

---

## 3. File-by-File Changes

### 3.1 `backend/src/schemas/entities/llm.py`

**Changes**:
- Add `skills`, `memory`, `agent_name`, `response_format`, `interrupt_on` to `LLMRequest`.
- Add `skills`, `memory`, `agent_name`, `response_format`, `interrupt_on` to `Assistant`.
- Update `Assistant.to_llm_request()` to propagate new fields.

### 3.2 `backend/src/agents/__init__.py`

**Changes to `init_graph()`**:

Add new parameters:

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
    # NEW parameters
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    name: str | None = None,
    response_format: Any | None = None,
    interrupt_on: dict[str, Any] | None = None,
) -> CompiledStateGraph:
```

Pass new parameters to `create_deep_agent()`:

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
    # NEW parameters
    skills=skills,
    memory=memory,
    name=name,
    response_format=response_format,
    interrupt_on=interrupt_on,
)
```

**Changes to `construct_agent()`**:

Add new parameters and pass through to `Orchestra`:

```python
async def construct_agent(
    instructions: str,
    system_prompt: str,
    model: BaseChatModel,
    tools: list[BaseTool],
    subagents: list[SubAgent] = [],
    middleware: list[Callable] = [],
    backend: CompositeBackend = None,
    checkpointer: BaseCheckpointSaver = None,
    service_context: ServiceContext = None,
    api_key: str | None = None,
    # NEW parameters
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    agent_name: str | None = None,
    response_format: Any | None = None,
    interrupt_on: dict[str, Any] | None = None,
):
```

**Changes to `Orchestra.__init__()`**:

Add new parameters and pass through to `init_graph()`:

```python
class Orchestra:
    def __init__(
        self,
        tools: list[BaseTool],
        subagents: Optional[list[SubAgent]] = None,
        model: str = DEFAULT_CHAT_MODEL,
        system_prompt: str | None = None,
        context_schema: Type[Any] | None = None,
        checkpointer: BaseCheckpointSaver = None,
        store: BaseStore = None,
        middleware: list[Callable] = None,
        graph_id: Literal["react", "deepagent"] = "deepagent",
        backend: CompositeBackend = None,
        api_key: str | None = None,
        # NEW parameters
        skills: list[str] | None = None,
        memory: list[str] | None = None,
        name: str | None = None,
        response_format: Any | None = None,
        interrupt_on: dict[str, Any] | None = None,
    ):
```

**`add_memories_to_system()` / `init_memories()`**: Keep as-is (serves user memories from Store, not project context).

### 3.3 `backend/src/utils/middleware.py`

**Changes**:
- Remove `compaction_middleware` from `init_default_middleware()` return list.
- Remove the import: `from src.utils.compacting import compaction_middleware`.

Updated function:

```python
def init_default_middleware(
    backend: BackendProtocol | Callable[[ToolRuntime], BackendProtocol] = None,
) -> list[Callable]:
    return [
        # compaction_middleware REMOVED -- now handled by internal SummarizationMiddleware
        add_ai_message_metadata,
        retry_model,
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ]
```

### 3.4 `backend/src/utils/compacting.py`

**Changes**:
- Add deprecation notice at the top of the file.
- No functional changes -- file is kept for rollback but no longer imported.

```python
# DEPRECATED: This module is no longer used.
# The internal deepagents SummarizationMiddleware (auto-applied by create_deep_agent())
# replaces this custom implementation. Kept for rollback safety.
# See: https://github.com/ruska-ai/orchestra/issues/734
```

### 3.5 `backend/src/controllers/llm.py`

**Changes to `llm_invoke()`**:

Pass new fields from `params` through to `construct_agent()`:

```python
agent: Orchestra = await construct_agent(
    instructions=params.instructions,
    system_prompt=params.system_prompt,
    model=params.model,
    tools=params.tools,
    subagents=params.subagents,
    checkpointer=checkpointer,
    backend=backend,
    service_context=self.service_context,
    api_key=api_key,
    # NEW parameters
    skills=params.skills,
    memory=params.memory,
    agent_name=params.agent_name,
    response_format=params.response_format,
    interrupt_on=params.interrupt_on,
)
```

**Changes to `llm_stream()`**:

Pass new fields to `stream_generator()`:

```python
return stream_generator(
    input=assistant.input,
    model=assistant.model,
    system_prompt=assistant.system_prompt,
    tools=assistant.tools,
    subagents=assistant.subagents,
    config=self.service_context.config,
    service_context=self.service_context,
    instructions=assistant.instructions,
    api_key=api_key,
    # NEW parameters
    skills=assistant.skills,
    memory=assistant.memory,
    agent_name=assistant.agent_name,
    response_format=assistant.response_format,
    interrupt_on=assistant.interrupt_on,
)
```

### 3.6 `backend/src/utils/stream.py`

**Changes to `stream_generator()`**:

Add new parameters and pass through to `construct_agent()`:

```python
async def stream_generator(
    input: LLMInput,
    model: BaseChatModel,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: str = None,
    api_key: str | None = None,
    # NEW parameters
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    agent_name: str | None = None,
    response_format: Any | None = None,
    interrupt_on: dict[str, Any] | None = None,
):
```

Pass them through in the `construct_agent()` call:

```python
agent = await construct_agent(
    instructions=instructions,
    system_prompt=system_prompt,
    model=model,
    tools=tools,
    subagents=subagents,
    checkpointer=checkpointer,
    backend=backend,
    service_context=service_context,
    api_key=api_key,
    # NEW parameters
    skills=skills,
    memory=memory,
    agent_name=agent_name,
    response_format=response_format,
    interrupt_on=interrupt_on,
)
```

### 3.7 `backend/src/utils/format.py`

**No changes needed**. The `init_system_prompt()` function is unaffected.

### 3.8 `backend/src/services/llm.py`

**Changes to `assistant()` method**:

When constructing `LLMRequest` from an `Assistant` via `to_llm_request()`, the new fields are already propagated by the updated `to_llm_request()` method (see 3.1).

No changes needed in the service layer itself -- the schema propagation handles it.

### 3.9 `backend/src/constants/llm.py`

**Optional cleanup**: The `DEFAULT_COMPACTION_*` constants can remain for backward compatibility but are no longer actively used by the middleware stack. Add a comment noting deprecation:

```python
# DEPRECATED: These constants were used by Orchestra's custom compaction middleware
# which has been replaced by deepagents' internal SummarizationMiddleware.
DEFAULT_COMPACTION_TOKEN_THRESHOLD = _safe_int_env("COMPACTION_TOKEN_THRESHOLD", 170000)
DEFAULT_COMPACTION_RECENT_MESSAGES = _safe_int_env("COMPACTION_RECENT_MESSAGES", 6)
DEFAULT_COMPACTION_MODEL = DEFAULT_CHAT_MODEL_BASIC or DEFAULT_CHAT_MODEL
```

---

## 4. Integration Sequence

### Phase 1: Remove Compaction Conflict (Breaking change - must be atomic)

1. **Step 1.1**: Update `backend/src/utils/middleware.py` -- remove `compaction_middleware` from `init_default_middleware()` and its import.
2. **Step 1.2**: Add deprecation notice to `backend/src/utils/compacting.py`.
3. **Step 1.3**: Run existing tests (`make test`) to verify no breakage. Update `test_compacting.py` expectations if any tests verify middleware composition.

### Phase 2: Schema Extensions (Non-breaking -- all new fields are Optional with None defaults)

4. **Step 2.1**: Add new fields to `LLMRequest` in `backend/src/schemas/entities/llm.py`.
5. **Step 2.2**: Add new fields to `Assistant` in `backend/src/schemas/entities/llm.py`.
6. **Step 2.3**: Update `Assistant.to_llm_request()` to propagate new fields.

### Phase 3: Plumbing (Wire new parameters through the call chain)

7. **Step 3.1**: Update `init_graph()` signature and body in `backend/src/agents/__init__.py`.
8. **Step 3.2**: Update `Orchestra.__init__()` signature and body.
9. **Step 3.3**: Update `construct_agent()` signature and body.
10. **Step 3.4**: Update `LLMController.llm_invoke()` in `backend/src/controllers/llm.py`.
11. **Step 3.5**: Update `LLMController.llm_stream()` in `backend/src/controllers/llm.py`.
12. **Step 3.6**: Update `stream_generator()` in `backend/src/utils/stream.py`.

### Phase 4: Testing & Validation

13. **Step 4.1**: Write unit tests for new parameter propagation.
14. **Step 4.2**: Write integration test verifying the internal `SummarizationMiddleware` is the sole compaction mechanism.
15. **Step 4.3**: Manual validation with curl requests (see Testing Strategy below).

---

## 5. Testing Strategy

### 5.1 Unit Tests to Add/Update

**File: `backend/tests/unit/utils/test_compacting.py`**

- Keep existing tests but add a skip/deprecation marker:
  ```python
  @pytest.mark.skip(reason="Orchestra compaction replaced by internal SummarizationMiddleware (#734)")
  ```
- OR update tests to verify that `compaction_middleware` is NOT in the default middleware list.

**File: `backend/tests/unit/utils/test_middleware.py`** (new or existing)

```python
def test_init_default_middleware_excludes_compaction():
    """Verify custom compaction is not in default middleware stack."""
    from src.utils.middleware import init_default_middleware
    from src.utils.compacting import compaction_middleware
    middleware = init_default_middleware()
    assert compaction_middleware not in middleware

def test_init_default_middleware_includes_expected():
    """Verify expected middleware are present."""
    from src.utils.middleware import init_default_middleware
    middleware = init_default_middleware()
    # Should have: add_ai_message_metadata, retry_model, PII(credit_card), PII(api_key), AutoEvictMiddleware
    assert len(middleware) == 5
```

**File: `backend/tests/unit/schemas/test_llm_schemas.py`** (new or existing)

```python
def test_llm_request_new_fields_optional():
    """New fields default to None."""
    request = LLMRequest(
        input=LLMInput(messages=[{"role": "user", "content": "hello"}])
    )
    assert request.skills is None
    assert request.memory is None
    assert request.agent_name is None
    assert request.response_format is None
    assert request.interrupt_on is None

def test_llm_request_with_new_fields():
    """New fields are properly set."""
    request = LLMRequest(
        input=LLMInput(messages=[{"role": "user", "content": "hello"}]),
        skills=["/skills/user/"],
        memory=["/memory/AGENTS.md"],
        agent_name="test-agent",
        response_format={"type": "json"},
        interrupt_on={"edit_file": True},
    )
    assert request.skills == ["/skills/user/"]
    assert request.memory == ["/memory/AGENTS.md"]
    assert request.agent_name == "test-agent"

def test_assistant_to_llm_request_propagates_new_fields():
    """Assistant.to_llm_request() propagates new fields."""
    assistant = Assistant(
        name="Test",
        tools=["search"],
        skills=["/skills/user/"],
        memory=["/memory/AGENTS.md"],
        agent_name="test-agent",
    )
    request = assistant.to_llm_request(
        input=LLMInput(messages=[{"role": "user", "content": "hello"}])
    )
    assert request.skills == ["/skills/user/"]
    assert request.memory == ["/memory/AGENTS.md"]
    assert request.agent_name == "test-agent"
```

**File: `backend/tests/unit/agents/test_init_graph.py`** (new or existing)

```python
@pytest.mark.asyncio
@patch("src.agents.create_deep_agent")
async def test_init_graph_passes_new_params(mock_create):
    """Verify new parameters are forwarded to create_deep_agent."""
    mock_create.return_value = MagicMock()
    init_graph(
        skills=["/skills/user/"],
        memory=["/memory/AGENTS.md"],
        name="test-agent",
        interrupt_on={"edit_file": True},
    )
    call_kwargs = mock_create.call_args.kwargs
    assert call_kwargs["skills"] == ["/skills/user/"]
    assert call_kwargs["memory"] == ["/memory/AGENTS.md"]
    assert call_kwargs["name"] == "test-agent"
    assert call_kwargs["interrupt_on"] == {"edit_file": True}
```

### 5.2 Integration Tests

**File: `backend/tests/integration/test_deep_agent_scaffold.py`** (new)

```python
@pytest.mark.asyncio
async def test_construct_agent_with_skills():
    """End-to-end: construct agent with skills parameter."""
    # This verifies the full call chain works without errors

@pytest.mark.asyncio
async def test_construct_agent_no_double_summarization():
    """Verify only internal SummarizationMiddleware is active."""
    # Inspect the middleware list of the compiled graph
```

### 5.3 Manual Validation (curl examples)

```bash
# Test with new parameters (skills + memory)
curl -X POST http://localhost:8000/api/v0/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "input": {
      "messages": [{"role": "user", "content": "Hello"}]
    },
    "model": "openai:gpt-4.1-mini",
    "skills": ["/skills/user/"],
    "memory": ["/memory/AGENTS.md"],
    "agent_name": "test-agent"
  }'

# Test with interrupt_on (HITL)
curl -X POST http://localhost:8000/api/v0/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "input": {
      "messages": [{"role": "user", "content": "Edit the file /test.txt"}]
    },
    "interrupt_on": {"edit_file": true}
  }'

# Test backward compatibility (no new fields)
curl -X POST http://localhost:8000/api/v0/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "input": {
      "messages": [{"role": "user", "content": "Hello"}]
    }
  }'
```

---

## 6. Rollback Plan

### Level 1: Revert Compaction Change Only

If the internal `SummarizationMiddleware` causes issues:

1. Re-add `compaction_middleware` to `init_default_middleware()` in `middleware.py`.
2. Re-add the import line.
3. This is a one-line change per file (2 files total).

**Risk**: Double summarization returns, but the system works as it did before.

### Level 2: Revert All Schema Changes

If the new parameters cause serialization or API issues:

1. Remove new fields from `LLMRequest` and `Assistant`.
2. Remove new parameters from `init_graph()`, `construct_agent()`, `Orchestra.__init__()`, `stream_generator()`.
3. Remove new parameter passing from `LLMController`.

**Method**: `git revert` the commit(s) from Phase 2 and Phase 3.

### Level 3: Full Feature Flag Approach (Alternative)

Instead of hard-removing compaction, use a feature flag:

```python
# In middleware.py
import os
USE_INTERNAL_SUMMARIZATION = os.getenv("USE_INTERNAL_SUMMARIZATION", "true").lower() == "true"

def init_default_middleware(backend=None):
    middlewares = []
    if not USE_INTERNAL_SUMMARIZATION:
        middlewares.append(compaction_middleware)
    middlewares.extend([
        add_ai_message_metadata,
        retry_model,
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ])
    return middlewares
```

This allows toggling via environment variable without code changes.

**Recommendation**: Use Level 3 (feature flag) for the initial rollout, then remove the flag after validation in production.

---

## Appendix A: Parameter Flow Diagram

```
API Request (LLMRequest)
    |
    v
LLMController.llm_invoke() / llm_stream()
    |-- skills, memory, agent_name, response_format, interrupt_on
    |
    v
construct_agent()
    |-- skills, memory, agent_name, response_format, interrupt_on
    |
    v
Orchestra.__init__()
    |-- skills, memory, name, response_format, interrupt_on
    |
    v
init_graph()
    |-- skills, memory, name, response_format, interrupt_on
    |
    v
create_deep_agent()
    |-- skills -> SkillsMiddleware (if not None)
    |-- memory -> MemoryMiddleware (if not None)
    |-- name -> passed to create_agent()
    |-- response_format -> passed to create_agent()
    |-- interrupt_on -> HumanInTheLoopMiddleware (if not None)
```

## Appendix B: Internal Middleware Stack (After Changes)

```
create_deep_agent() internal stack:
  1. TodoListMiddleware
  2. MemoryMiddleware          (if memory != None)
  3. SkillsMiddleware          (if skills != None)
  4. FilesystemMiddleware
  5. SubAgentMiddleware
  6. SummarizationMiddleware   (auto-applied, model-profile-aware)
  7. AnthropicPromptCachingMiddleware
  8. PatchToolCallsMiddleware

Orchestra's appended middleware (via init_default_middleware()):
  9. add_ai_message_metadata
  10. retry_model
  11. PIIMiddleware (credit_card)
  12. PIIMiddleware (api_key)
  13. AutoEvictMiddleware

  14. HumanInTheLoopMiddleware  (if interrupt_on != None, added by create_deep_agent)
```

## Appendix C: Key Differences Between Summarization Implementations

| Feature | Internal (deepagents) | Orchestra Custom |
|---|---|---|
| Trigger mechanism | Model profile fraction (85%) or token count (170k) | Token estimate (`len/4` heuristic, 170k threshold) |
| Backend offloading | Yes, to `/conversation_history/{thread_id}.md` | No |
| Message removal | `RemoveMessage(id=REMOVE_ALL_MESSAGES)` | Replaces in state directly |
| Summary format | `HumanMessage` with `lc_source='summarization'` | `SystemMessage` with `[CONVERSATION SUMMARY]` prefix |
| Tool arg truncation | Yes, configurable | No |
| Async support | Full (`abefore_model`) | Via `@wrap_model_call` decorator |
| Error handling | Aborts if offload fails (preserves messages) | Logs warning, returns original messages |
| Chained summarization | Filters previous summary messages | No protection |

**Verdict**: Internal implementation is production-grade with backend persistence, proper message ID handling, and argument truncation. Orchestra's custom implementation was a reasonable stopgap but should be retired.
