# Proposal: Add Compacting Middleware to DeepAgents

**Agent**: AGENT_2 -- TOKEN_STRATEGIST
**Issue**: #555
**Date**: 2026-01-31

---

## 1. Executive Summary

This proposal defines the token counting strategy, summarization chain design, threshold configuration, and context window budget management needed to implement compacting middleware for DeepAgents. The middleware will automatically summarize older messages when conversation history approaches model context limits, preserving recent context and critical information while staying within safe token budgets.

The system already has `AutoEvictMiddleware` (evicts large tool results to filesystem) and `dynamic_model_selection` (routes by complexity). Compacting middleware complements these by addressing cumulative message growth across long conversations.

---

## 2. Architectural Analysis

### 2.1 Current Middleware Stack

The middleware pipeline in `backend/src/utils/middleware.py` is assembled by `init_default_middleware()` and passed to `create_deep_agent()` via the `Orchestra` class:

```
init_default_middleware() -> [
    add_ai_message_metadata,   # @after_model decorator
    retry_model,               # @wrap_model_call decorator
    *pii_middleware(),          # PIIMiddleware instances
    AutoEvictMiddleware,       # AgentMiddleware subclass
]
```

Custom middleware passed to `construct_agent()` is appended after defaults (line 88 of `__init__.py`):

```python
middleware=init_default_middleware(backend=backend) + middleware
```

### 2.2 Middleware Extension Points

The `deepagents` library exposes two middleware patterns:

| Pattern | Base | Hook | Use Case |
|---|---|---|---|
| Decorator-based | `@wrap_model_call` | Wraps the model call request/response | Pre/post processing of LLM invocation |
| Class-based | `AgentMiddleware` | `awrap_tool_call` | Intercepts tool call lifecycle |

For compacting, we need the **decorator-based** pattern (`@wrap_model_call`) since we must intercept and modify the message list **before** it reaches the model. The `ModelRequest` object exposes `request.state["messages"]` which is the full conversation history.

### 2.3 Existing Token-Adjacent Patterns

- `AutoEvictMiddleware`: Uses character-length heuristic (`len(content) > 4 * token_limit`) as a rough 4-chars-per-token approximation for tool results.
- `dynamic_model_selection`: Uses `message_count > 50` as a proxy for conversation length, not actual token counts.
- No tiktoken or model-specific token counting exists in the codebase today.

---

## 3. Implementation Strategy

### 3.1 Token Counting Approach

**Recommendation: Tiered counting strategy**

| Tier | Method | Speed | Accuracy | When to Use |
|---|---|---|---|---|
| Fast estimate | `len(text) / 4` | ~0ns | ~80% | Pre-check: skip counting if well under threshold |
| Accurate count | `tiktoken` for OpenAI; character heuristic for others | ~1ms per message | ~98% | When fast estimate is near threshold |

**Implementation details:**

```python
from typing import Protocol

class TokenCounter(Protocol):
    def count(self, text: str) -> int: ...
    def count_messages(self, messages: list[BaseMessage]) -> int: ...

class TiktokenCounter:
    """For OpenAI models. Uses cl100k_base or o200k_base encoding."""
    def __init__(self, model: str):
        import tiktoken
        self.encoding = tiktoken.encoding_for_model(model)

    def count(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def count_messages(self, messages: list[BaseMessage]) -> int:
        total = 0
        for msg in messages:
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            total += self.count(content) + 4  # message overhead
        return total

class ApproximateCounter:
    """Fallback for Anthropic, Google, xAI, Groq, Ollama, Bedrock."""
    def count(self, text: str) -> int:
        return len(text) // 4

    def count_messages(self, messages: list[BaseMessage]) -> int:
        return sum(self.count(
            msg.content if isinstance(msg.content, str) else str(msg.content)
        ) + 4 for msg in messages)
```

**Counter selection** is based on the model prefix string already used throughout the codebase (e.g., `"openai:gpt-5.2"`, `"anthropic:claude-sonnet-4-5"`):

```python
def get_counter(model: str) -> TokenCounter:
    if model.startswith("openai:"):
        return TiktokenCounter(model.split(":", 1)[1])
    return ApproximateCounter()
```

### 3.2 Context Window Budget Map

A static lookup maps model prefixes to their context window sizes. This is the source of truth for threshold calculation.

```python
MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    # OpenAI
    "openai:gpt-4.1-nano": 1_047_576,
    "openai:gpt-4.1-mini": 1_047_576,
    "openai:gpt-5-nano": 1_000_000,
    "openai:gpt-5-mini": 1_000_000,
    "openai:gpt-5": 1_000_000,
    "openai:gpt-5.1": 1_000_000,
    "openai:gpt-5.2": 1_000_000,
    "openai:o3": 200_000,
    "openai:o4-mini": 200_000,
    # Anthropic
    "anthropic:claude-3-7-sonnet-latest": 200_000,
    "anthropic:claude-sonnet-4": 200_000,
    "anthropic:claude-opus-4-1": 200_000,
    "anthropic:claude-haiku-4-5": 200_000,
    "anthropic:claude-sonnet-4-5": 200_000,
    # Google
    "google_genai:gemini-2.5-flash": 1_048_576,
    "google_genai:gemini-2.5-pro": 1_048_576,
    "google_genai:gemini-3-flash-preview": 1_048_576,
    # xAI
    "xai:grok-4": 131_072,
    "xai:grok-4-fast": 131_072,
    # Groq
    "groq:llama-3.3-70b-versatile": 128_000,
    # Bedrock (same underlying models)
    "bedrock_converse:us.anthropic.claude-sonnet-4-5": 200_000,
}
DEFAULT_CONTEXT_WINDOW = 128_000  # Conservative fallback
```

### 3.3 Threshold Configuration

Three thresholds govern compaction behavior:

| Threshold | Default | Purpose |
|---|---|---|
| `compact_trigger_ratio` | `0.85` | Trigger compaction when usage exceeds this fraction of context window |
| `compact_target_ratio` | `0.50` | After compaction, aim to reduce history to this fraction |
| `preserve_recent_messages` | `10` | Always keep the N most recent messages verbatim |

These translate to token counts at runtime:

```python
trigger_tokens = int(context_window * compact_trigger_ratio)   # e.g., 170,000 for 200k
target_tokens  = int(context_window * compact_target_ratio)    # e.g., 100,000 for 200k
```

The `170k` number referenced in the issue description aligns with `0.85 * 200,000 = 170,000` for Anthropic models.

### 3.4 Summarization Chain Design

**Model selection for summarization**: Use the cheapest available model to avoid compounding costs. The existing `DEFAULT_CHAT_MODEL_BASIC` (currently `google_genai:gemini-3-flash-preview` or `openai:gpt-5-nano`) is the right choice.

**What to summarize**: Messages older than `preserve_recent_messages`, excluding the system prompt. Tool call/result pairs are summarized together as a unit.

**What to preserve**:
1. System prompt (never compacted)
2. The N most recent messages (configurable)
3. Key facts extracted during summarization (structured output)

**Summarization prompt**:

```
You are a conversation compactor. Summarize the following conversation history
into a concise summary that preserves:
- Key decisions and conclusions reached
- Important facts, numbers, and names mentioned
- Current task context and progress
- Any pending questions or action items
- Tool results that produced important data

Be factual and concise. Do not add interpretation. Output a single summary paragraph.

CONVERSATION TO SUMMARIZE:
{messages_to_compact}
```

**Output format**: The summary replaces the compacted messages with a single `HumanMessage` or `SystemMessage` prefixed with `[CONVERSATION SUMMARY]` so the agent knows it is reading compressed history.

### 3.5 Compacting Middleware Implementation

```python
@wrap_model_call
async def compacting_middleware(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    messages = request.state["messages"]
    model_name = _resolve_model_name(request)
    counter = get_counter(model_name)
    context_window = MODEL_CONTEXT_WINDOWS.get(model_name, DEFAULT_CONTEXT_WINDOW)

    total_tokens = counter.count_messages(messages)
    trigger = int(context_window * config.compact_trigger_ratio)

    if total_tokens <= trigger:
        return await handler(request)

    # Partition: system | compactable | preserved
    system_msgs = [m for m in messages[:1] if m.type == "system"]
    remaining = messages[len(system_msgs):]
    preserved = remaining[-config.preserve_recent_messages:]
    compactable = remaining[:-config.preserve_recent_messages]

    if not compactable:
        return await handler(request)

    summary = await _summarize(compactable, model_name)
    summary_msg = SystemMessage(content=f"[CONVERSATION SUMMARY]\n{summary}")

    request.state["messages"] = system_msgs + [summary_msg] + preserved
    return await handler(request)
```

### 3.6 CompactingMiddleware Base Class

For extensibility, provide an abstract base:

```python
class CompactingMiddleware(AgentMiddleware, ABC):
    """Base class for context compaction strategies."""

    compact_trigger_ratio: float = 0.85
    compact_target_ratio: float = 0.50
    preserve_recent_messages: int = 10
    summarization_model: str | None = None  # None = use DEFAULT_CHAT_MODEL_BASIC

    @abstractmethod
    async def compact(
        self,
        messages: list[BaseMessage],
        token_budget: int,
        counter: TokenCounter,
    ) -> list[BaseMessage]:
        """Compact messages to fit within token_budget."""
        ...
```

This allows future strategies:
- `SummarizationCompactor` -- the default, summarizes old messages
- `SlidingWindowCompactor` -- simple truncation, keeps last N tokens
- `ImportanceRankingCompactor` -- scores messages by relevance, drops low-value ones

### 3.7 Integration Point

Add `SummarizationMiddleware` to `init_default_middleware()`:

```python
def init_default_middleware(backend=None) -> list[Callable]:
    return [
        add_ai_message_metadata,
        retry_model,
        compacting_middleware,          # <-- NEW: before PII and eviction
        *pii_middleware(),
        AutoEvictMiddleware(backend=backend),
    ]
```

Placing it **before** PII middleware ensures we compact the raw messages. Placing it **before** `AutoEvictMiddleware` ensures we count actual message tokens, not eviction placeholders.

---

## 4. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Token counting | Tiered (fast estimate + tiktoken) | Avoids unnecessary tiktoken overhead on every call while staying accurate near thresholds |
| Summarization model | `DEFAULT_CHAT_MODEL_BASIC` | Cheapest model, summarization is low-complexity; keeps cost proportional |
| Middleware pattern | `@wrap_model_call` decorator | Must intercept before model call; class-based `AgentMiddleware` only hooks tool calls |
| Summary placement | `SystemMessage` with `[CONVERSATION SUMMARY]` prefix | Distinguishable from user content; models handle system messages well |
| Threshold defaults | 85% trigger, 50% target, 10 preserved | 85% matches the ~170k threshold mentioned in the issue for 200k context models; 50% target gives headroom; 10 messages keeps immediate context |
| Context window map | Static dict with fallback | Simple, maintainable, no API calls needed; fallback to 128k is conservative |
| Compaction granularity | Summarize all compactable at once | Simpler than incremental; single LLM call; sufficient for MVP |

---

## 5. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Summarization loses critical context | High | Medium | Preserve recent messages; structured summarization prompt that extracts key facts; log compaction events for debugging |
| Token counting inaccuracy causes premature/late compaction | Medium | Low | Fast-estimate pre-check avoids false triggers; tiktoken for OpenAI is accurate; 85% threshold provides 15% buffer |
| Summarization call fails (rate limit, timeout) | Medium | Low | Fall back to simple truncation (drop oldest messages); wrap in try/except; retry_model middleware already handles retries |
| Cost of summarization calls | Low | Medium | Use cheapest model; only triggers when approaching limit; compaction reduces subsequent call costs |
| Recursive summarization (summary itself is huge) | Low | Low | Summary prompt requests concise output; enforce max summary tokens (2000); truncate if needed |
| `dynamic_model_selection` changes model after counting | Medium | Medium | Count tokens using the model that `dynamic_model_selection` would pick, or place compacting middleware after dynamic selection |

### Ordering concern with `dynamic_model_selection`

Currently `dynamic_model_selection` is not in `init_default_middleware()` -- it may be passed as custom middleware. If it runs after compacting middleware, the model (and therefore context window) could change. Recommendation: compacting middleware should use the model from `request.model` at invocation time, and if `dynamic_model_selection` changes it, the budget should still be safe because we use the most conservative window.

---

## 6. Estimated Complexity

| Component | Effort | Notes |
|---|---|---|
| `TokenCounter` protocol + implementations | Small (1-2 hours) | tiktoken for OpenAI, char-based for others |
| `MODEL_CONTEXT_WINDOWS` map | Small (1 hour) | Static data, derive from `ChatModels` enum |
| `CompactingMiddleware` base class | Small (1-2 hours) | Abstract class with shared config |
| `SummarizationMiddleware` (`compacting_middleware`) | Medium (3-4 hours) | Core logic: partition, summarize, reconstruct |
| Integration into `init_default_middleware` | Small (30 min) | Single line addition + ordering validation |
| Configuration schema (Pydantic) | Small (1 hour) | `CompactingConfig` model with defaults |
| Unit tests | Medium (3-4 hours) | Token counting, threshold logic, message partitioning, summary integration |
| Integration tests | Medium (2-3 hours) | End-to-end with mocked LLM |

**Total estimate**: 12-17 hours of implementation work.

### File locations for new code

| File | Content |
|---|---|
| `backend/src/utils/tokens.py` | `TokenCounter`, `TiktokenCounter`, `ApproximateCounter`, `get_counter()`, `MODEL_CONTEXT_WINDOWS` |
| `backend/src/utils/compacting.py` | `CompactingMiddleware` base class, `SummarizationMiddleware` implementation |
| `backend/src/utils/middleware.py` | Updated `init_default_middleware()` to include compacting |
| `backend/tests/unit/utils/test_tokens.py` | Token counter tests |
| `backend/tests/unit/utils/test_compacting.py` | Compacting middleware tests |

---

## 7. Future Extensions

- **Incremental summarization**: Instead of re-summarizing all compactable messages, maintain a rolling summary that gets updated with each compaction cycle.
- **Importance-based compaction**: Score messages by recency, tool result relevance, and user-flagged importance before deciding what to compact.
- **Per-user configuration**: Allow users to set their preferred compaction thresholds via the existing account settings infrastructure (see recent PR #710).
- **Metrics and observability**: Track compaction frequency, tokens saved, and summary quality scores to tune thresholds over time.
