# Proposal: Add Compacting Middleware (Issue #555)

**Agent**: AGENT_3 -- Integration Engineer
**Date**: 2026-01-31
**Status**: Draft

---

## 1. Executive Summary

This proposal covers the integration strategy for adding SummarizationMiddleware (compacting middleware) to the Orchestra backend. The feature enables automatic context compaction when message history exceeds configurable token thresholds, preventing context window overflow during long-horizon DeepAgent tasks. The implementation requires changes in three layers: the `deepagents` library (middleware classes), the Orchestra middleware utilities, and configuration/settings infrastructure. No API contract changes are required for the default behavior; the feature is transparent to callers.

---

## 2. Architectural Analysis

### 2.1 Current Agent Creation Flow

Agent creation follows two paths, both converging at `construct_agent()` in `backend/src/agents/__init__.py`:

1. **Invoke path**: `LLMController.llm_invoke()` -> `construct_agent()` -> `Orchestra.__init__()` -> `init_graph()` -> `create_deep_agent()`
2. **Stream path**: `LLMController.llm_stream()` -> `stream_generator()` -> `construct_agent()` -> same chain

The middleware stack is assembled in `init_graph()` (line 88):
```python
middleware=init_default_middleware(backend=backend) + middleware,
```

Where `init_default_middleware()` returns:
- `add_ai_message_metadata` (after-model hook)
- `retry_model` (wrap-model-call retry logic)
- `PIIMiddleware` instances (credit card masking, API key blocking)
- `AutoEvictMiddleware` (evicts large tool results to filesystem)

Custom middleware from `construct_agent(middleware=[...])` is appended after defaults.

### 2.2 Middleware Pattern

Orchestra uses two middleware interfaces:
- **Functional middleware**: Decorated functions (`@after_model`, `@wrap_model_call`) that hook into model call lifecycle
- **Class-based middleware**: Subclasses of `AgentMiddleware` (from `deepagents.graph`) with methods like `awrap_tool_call()`

The new `CompactingMiddleware` / `SummarizationMiddleware` needs to intercept the message list *before* model invocation to check token count and optionally summarize older messages. This aligns with a `@wrap_model_call` or a new `before_model` / `on_messages_end` hook pattern.

### 2.3 Configuration Management

Current configuration surfaces:
- **Environment variables**: Used for `STREAM_TIMEOUT_MS`, `APP_ENV`, model constants
- **Constants module**: `backend/src/constants/llm.py` defines `DEFAULT_CHAT_MODEL`, etc.
- **User settings**: `UserSettingsRepo` stores per-user defaults (model, API keys) in the LangGraph store
- **Per-request**: `LLMRequest` carries model, tools, metadata per invocation

Token thresholds for compacting middleware should follow the same layered approach: sensible defaults in constants, overridable via environment variables, and optionally per-assistant configuration.

### 2.4 Dependency: `deepagents` Package

The installed `deepagents==0.3.8` currently has no `SummarizationMiddleware` or `CompactingMiddleware`. The `AgentMiddleware` base class is imported from `deepagents.graph` (referenced in `backend/src/utils/middleware.py` line 6). This means either:
- (a) The `deepagents` package needs to be upgraded to a version that ships these classes, or
- (b) The compacting middleware classes are implemented directly in Orchestra's codebase

**Recommendation**: Implement the base `CompactingMiddleware` class and `SummarizationMiddleware` in `deepagents` upstream (preferred for reusability), then bump the dependency. If upstream changes are blocked, implement in Orchestra at `backend/src/utils/middleware.py` as an interim solution.

---

## 3. Implementation Strategy

### 3.1 Integration Points

#### 3.1.1 New Files

| File | Purpose |
|------|---------|
| `backend/src/utils/compacting.py` | `CompactingMiddleware` base class and `SummarizationMiddleware` implementation (if not in `deepagents`) |
| `backend/tests/unit/utils/test_compacting.py` | Unit tests for compacting middleware |
| `backend/tests/unit/utils/test_middleware_integration.py` | Integration tests for middleware stack composition |

#### 3.1.2 Modified Files

| File | Change |
|------|--------|
| `backend/src/utils/middleware.py` | Add `SummarizationMiddleware` to `init_default_middleware()` return list |
| `backend/src/constants/llm.py` | Add `DEFAULT_COMPACTION_TOKEN_THRESHOLD`, `DEFAULT_COMPACTION_MESSAGE_COUNT` constants |
| `backend/src/agents/__init__.py` | No changes needed -- middleware injection already handled via `init_default_middleware()` |

#### 3.1.3 Middleware Stack Ordering

The compacting middleware must execute **before** the model call to trim context. Recommended position in `init_default_middleware()`:

```python
def init_default_middleware(
    backend=None,
    compaction_threshold: int = DEFAULT_COMPACTION_TOKEN_THRESHOLD,
) -> list[Callable]:
    return [
        SummarizationMiddleware(token_threshold=compaction_threshold),  # NEW: compact before model call
        add_ai_message_metadata,
        retry_model,
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ]
```

Position rationale: Compaction should happen first so subsequent middleware operates on the trimmed message list, reducing token counting overhead in PII scanning and retry logic.

### 3.2 API Contract Changes

**None required for default behavior.** The middleware is auto-applied transparently. However, two optional enhancements are recommended for future iterations:

1. **Assistant-level configuration**: Add optional `compaction_config` field to the `Assistant` schema so users can tune thresholds per assistant. This is a non-breaking additive change.
2. **Disable compaction**: Allow `compaction_enabled: false` in assistant config for agents where full context is critical.

These are **not** required for the initial implementation. The default auto-apply behavior satisfies all three user stories without API changes.

### 3.3 Configuration Strategy

```python
# backend/src/constants/llm.py (additions)
import os

DEFAULT_COMPACTION_TOKEN_THRESHOLD: int = int(
    os.getenv("COMPACTION_TOKEN_THRESHOLD", "170000")
)
DEFAULT_COMPACTION_RECENT_MESSAGES: int = int(
    os.getenv("COMPACTION_RECENT_MESSAGES", "10")
)
DEFAULT_COMPACTION_MODEL: str = os.getenv(
    "COMPACTION_MODEL", DEFAULT_CHAT_MODEL_BASIC
)
```

Layered resolution order:
1. Environment variable (deployment-level override)
2. Constant default (code-level sensible default)
3. Future: per-assistant config (user-level override)

### 3.4 SummarizationMiddleware Design

```python
class CompactingMiddleware:
    """Base class for context compaction middleware."""

    def __init__(self, token_threshold: int = 170_000):
        self.token_threshold = token_threshold

    def estimate_tokens(self, messages: list) -> int:
        """Estimate token count from messages. Override for custom estimation."""
        return sum(len(str(m.content)) // 4 for m in messages)

    def should_compact(self, messages: list) -> bool:
        return self.estimate_tokens(messages) > self.token_threshold

    async def compact(self, messages: list) -> list:
        """Override this method to implement custom compaction logic."""
        raise NotImplementedError


class SummarizationMiddleware(CompactingMiddleware):
    """Summarizes older messages when context exceeds token threshold."""

    def __init__(
        self,
        token_threshold: int = 170_000,
        recent_messages_to_keep: int = 10,
        summarization_model: str | None = None,
    ):
        super().__init__(token_threshold=token_threshold)
        self.recent_messages_to_keep = recent_messages_to_keep
        self.summarization_model = summarization_model

    async def compact(self, messages: list) -> list:
        if not self.should_compact(messages):
            return messages

        # Split: older messages to summarize, recent to keep
        cutoff = max(1, len(messages) - self.recent_messages_to_keep)
        to_summarize = messages[:cutoff]
        to_keep = messages[cutoff:]

        summary = await self._summarize(to_summarize)
        return [summary] + to_keep

    async def _summarize(self, messages: list):
        """Call LLM to produce a summary of the message history."""
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import AIMessage, HumanMessage

        model = init_chat_model(
            self.summarization_model or DEFAULT_COMPACTION_MODEL
        )
        content = "\n".join(str(m.content) for m in messages)
        prompt = HumanMessage(
            content=f"Summarize the following conversation concisely, "
            f"preserving key facts, decisions, and context:\n\n{content}"
        )
        response = await model.ainvoke([prompt])
        return AIMessage(
            content=f"[Context Summary]\n{response.content}",
            metadata={"compacted": True, "original_count": len(messages)},
        )
```

The middleware hooks into the model call lifecycle via `@wrap_model_call`:

```python
@wrap_model_call
async def compaction_middleware(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    middleware = SummarizationMiddleware(
        token_threshold=DEFAULT_COMPACTION_TOKEN_THRESHOLD,
        recent_messages_to_keep=DEFAULT_COMPACTION_RECENT_MESSAGES,
    )
    if middleware.should_compact(request.state["messages"]):
        request.state["messages"] = await middleware.compact(
            request.state["messages"]
        )
    return await handler(request)
```

Alternatively, if the `deepagents` framework supports class-based middleware with an `on_messages_end` or `before_model` hook, the class can implement that interface directly (similar to `AutoEvictMiddleware.awrap_tool_call()`).

### 3.5 Testing Strategy

#### Unit Tests (`backend/tests/unit/utils/test_compacting.py`)

| Test | Description |
|------|-------------|
| `test_estimate_tokens_empty` | Token estimation returns 0 for empty list |
| `test_estimate_tokens_accuracy` | Estimation is within reasonable bounds |
| `test_should_compact_below_threshold` | Returns False when under threshold |
| `test_should_compact_above_threshold` | Returns True when over threshold |
| `test_compact_preserves_recent_messages` | Recent N messages kept intact |
| `test_compact_produces_summary_message` | Output starts with summary AIMessage |
| `test_compact_summary_has_metadata` | Summary message has `compacted: True` metadata |
| `test_custom_middleware_extension` | Subclassing CompactingMiddleware works |
| `test_default_threshold_from_env` | Env var override works |
| `test_no_op_when_below_threshold` | Messages unchanged when under threshold |

#### LLM Mock Strategy

All tests that invoke `_summarize()` must mock the LLM call:

```python
@pytest.fixture
def mock_summarization_model(monkeypatch):
    async def fake_ainvoke(messages):
        return AIMessage(content="Summary of conversation.")

    mock_model = MagicMock()
    mock_model.ainvoke = fake_ainvoke
    monkeypatch.setattr(
        "langchain.chat_models.init_chat_model",
        lambda *a, **kw: mock_model,
    )
    return mock_model
```

#### Integration Tests (`backend/tests/unit/utils/test_middleware_integration.py`)

| Test | Description |
|------|-------------|
| `test_init_default_middleware_includes_compaction` | `init_default_middleware()` returns compaction middleware in stack |
| `test_middleware_ordering` | Compaction middleware comes before retry and PII |
| `test_full_stack_passthrough_short_context` | Short message list passes through unmodified |
| `test_full_stack_compaction_long_context` | Long message list triggers compaction |

#### Backward Compatibility Tests

| Test | Description |
|------|-------------|
| `test_construct_agent_no_extra_middleware` | `construct_agent(middleware=[])` still works |
| `test_construct_agent_custom_middleware` | Custom middleware appended after defaults including compaction |
| `test_existing_pii_middleware_still_works` | PII detection unaffected by compaction |

### 3.6 Backward Compatibility

The implementation is fully backward-compatible:

1. **Default auto-apply**: `init_default_middleware()` already called by `init_graph()` -- adding compaction to the returned list requires no caller changes.
2. **No schema changes**: No database migration needed. No Pydantic model changes.
3. **No API changes**: REST endpoints unchanged. Request/response schemas unchanged.
4. **Transparent operation**: Below-threshold conversations are unaffected (no-op path).
5. **Override mechanism**: Users can disable by passing custom `middleware` list to `construct_agent()` that excludes compaction.

---

## 4. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Middleware placement | First in stack | Reduces context for all downstream middleware |
| Token estimation | Character-based (chars/4) | Fast, no tokenizer dependency; accurate enough for threshold check |
| Summary model | Configurable, defaults to basic model | Cheaper model sufficient for summarization; avoids expensive reasoning models |
| Base class pattern | `CompactingMiddleware` ABC | Enables custom compaction strategies (truncation, sliding window, etc.) |
| Configuration layer | Env vars + constants | Matches existing patterns (`STREAM_TIMEOUT_MS`, model constants) |
| Implementation location | `backend/src/utils/compacting.py` | Separates concerns from existing middleware.py; co-located with middleware utilities |

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Summarization LLM call adds latency | High | Medium | Only triggers above threshold; use fast/cheap model; log timing |
| Summary loses critical context | Medium | High | Keep recent N messages intact; include metadata markers; allow threshold tuning |
| Token estimation inaccuracy | Medium | Low | Character-based is conservative (overestimates); can upgrade to tiktoken later |
| `deepagents` version incompatibility | Medium | Medium | Implement in Orchestra first; upstream to `deepagents` when stable |
| Middleware ordering conflicts | Low | Medium | Test ordering explicitly; document expected stack order |
| Breaking existing tests | Low | Low | Compaction is no-op for short contexts; existing tests use short message lists |

---

## 6. Estimated Complexity

| Component | Effort | Notes |
|-----------|--------|-------|
| `CompactingMiddleware` base class | Small (1-2 hours) | Simple ABC with token estimation |
| `SummarizationMiddleware` implementation | Medium (2-4 hours) | LLM call, message splitting, summary construction |
| Integration into `init_default_middleware()` | Small (30 min) | Add to list, wire constants |
| Constants and env var config | Small (30 min) | Three new constants |
| Unit tests | Medium (2-3 hours) | ~10 test cases with LLM mocking |
| Integration tests | Small (1-2 hours) | ~4 test cases for stack composition |
| Documentation | Small (1 hour) | Inline docstrings, constants documentation |
| **Total** | **~8-12 hours** | One developer, single sprint |

---

## Appendix A: File Reference

- `backend/src/agents/__init__.py` -- Agent construction and `init_graph()` (middleware injection point)
- `backend/src/utils/middleware.py` -- Current middleware stack (`init_default_middleware()`)
- `backend/src/controllers/llm.py` -- LLM controller (invoke/stream entry points)
- `backend/src/utils/stream.py` -- Stream path agent construction
- `backend/src/constants/llm.py` -- LLM-related constants
- `backend/tests/unit/utils/` -- Existing unit test location for utils
- `backend/tests/conftest.py` -- Test fixtures and DB setup

## Appendix B: Sequence Diagram

```
User Request
    |
    v
LLMController.llm_invoke()
    |
    v
construct_agent() -> Orchestra.__init__() -> init_graph()
    |
    v
init_default_middleware(backend=backend)
    |  returns: [SummarizationMiddleware, add_ai_message_metadata, retry_model, *pii, AutoEvict]
    v
create_deep_agent(middleware=[...defaults, ...custom])
    |
    v
Agent invocation with middleware pipeline:
    1. SummarizationMiddleware.compact() -- trim if > 170k tokens
    2. add_ai_message_metadata -- tag AI responses
    3. retry_model -- retry on failure
    4. PIIMiddleware -- mask/block sensitive data
    5. AutoEvictMiddleware -- evict large tool results
```
