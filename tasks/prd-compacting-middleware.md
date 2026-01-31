# PRD: Add Compacting Middleware (#555)

## Introduction

Add context compaction middleware for DeepAgents that automatically summarizes older messages when conversation history exceeds ~170k tokens. This prevents agents from hitting context window limits during long-horizon tasks. The middleware provides a `CompactingMiddleware` abstract base class for extensibility and a default `SummarizationMiddleware` implementation that uses a cheap LLM to produce conversation summaries, preserving system prompts and recent messages verbatim.

## Goals

- Automatically compact message history when context exceeds ~170k tokens (85% of 200k window)
- Preserve system prompts and recent N messages (configurable, default 6) verbatim
- Provide an extensible `CompactingMiddleware` ABC for custom compaction strategies
- Use a cheap/fast model (`DEFAULT_CHAT_MODEL_BASIC`) for summarization to minimize cost
- Configure thresholds via environment variables (`COMPACTION_TOKEN_THRESHOLD`, `COMPACTION_RECENT_MESSAGES`)
- Maintain full backward compatibility with existing agent construction

## User Stories

### US-001: Verify Deepagents Internals
**Description:** As a developer, I need to determine whether `deepagents==0.3.8` already ships internal `SummarizationMiddleware` so that we avoid double-summarization.

**Acceptance Criteria:**
- [ ] Inspect `deepagents` source for internal `SummarizationMiddleware` in `create_deep_agent()`
- [ ] Document finding (YES/NO) as a code comment in the implementation
- [ ] If YES: proceed with Phase 2A (lighter implementation, wire thresholds to deepagents)
- [ ] If NO: proceed with Phase 2B (full Orchestra implementation)
- [ ] Typecheck passes

### US-002: Add Compaction Constants
**Description:** As a developer, I need compaction threshold constants defined so that the middleware and tests can reference them.

**Acceptance Criteria:**
- [ ] Add `DEFAULT_COMPACTION_TOKEN_THRESHOLD = int(os.getenv("COMPACTION_TOKEN_THRESHOLD", "170000"))` to `backend/src/constants/llm.py`
- [ ] Add `DEFAULT_COMPACTION_RECENT_MESSAGES = int(os.getenv("COMPACTION_RECENT_MESSAGES", "6"))` to `backend/src/constants/llm.py`
- [ ] Add `DEFAULT_COMPACTION_MODEL` constant pointing to `DEFAULT_CHAT_MODEL_BASIC`
- [ ] Constants are importable from `backend.src.constants.llm`
- [ ] Typecheck passes

### US-003: Create CompactingMiddleware ABC
**Description:** As a developer building custom agents, I want an abstract base class for compaction middleware so that I can implement custom compaction strategies.

**Acceptance Criteria:**
- [ ] Create new file `backend/src/utils/compacting.py`
- [ ] `CompactingMiddleware` ABC with abstract method `compact(messages: list) -> list`
- [ ] Constructor accepts `token_threshold: int` and `recent_messages: int` with defaults from constants
- [ ] Helper method `estimate_tokens(messages)` using `len(content) // 4`
- [ ] Helper method `should_compact(messages)` returns bool based on threshold
- [ ] System prompt messages are identified and excluded from compaction candidates
- [ ] Typecheck passes

### US-004: Implement SummarizationMiddleware
**Description:** As a developer using DeepAgents for long-horizon tasks, I want automatic context compaction when message history exceeds token limits so that my agent continues operating without hitting context window limits.

**Acceptance Criteria:**
- [ ] `SummarizationMiddleware` extends `CompactingMiddleware` in `backend/src/utils/compacting.py`
- [ ] Estimates tokens via `len(content) // 4` (consistent with `AutoEvictMiddleware`)
- [ ] Triggers only when total tokens exceed `DEFAULT_COMPACTION_TOKEN_THRESHOLD`
- [ ] Preserves system prompt messages (never summarized)
- [ ] Preserves the N most recent messages (`DEFAULT_COMPACTION_RECENT_MESSAGES`)
- [ ] Summarizes older messages using `DEFAULT_CHAT_MODEL_BASIC` via `init_chat_model()`
- [ ] Summary is a `SystemMessage` with `[CONVERSATION SUMMARY]` prefix
- [ ] Summary message has `metadata={"compacted": True, "original_count": N}`
- [ ] Is a complete no-op when total tokens are under threshold
- [ ] Typecheck passes

### US-005: Create Compaction Middleware Decorator
**Description:** As a developer, I need a `@wrap_model_call` decorator that applies the `SummarizationMiddleware` before model invocation so it integrates with the existing middleware pipeline.

**Acceptance Criteria:**
- [ ] `compaction_middleware` function created in `backend/src/utils/compacting.py`
- [ ] Uses `@wrap_model_call` decorator pattern (consistent with existing middleware)
- [ ] Invokes `SummarizationMiddleware` on the message list before passing to the model handler
- [ ] Handles async invocation correctly
- [ ] Typecheck passes

### US-006: Register Compaction in Middleware Stack
**Description:** As a developer, I need the compaction middleware wired into the default middleware stack so it applies automatically to all agent invocations.

**Acceptance Criteria:**
- [ ] If Phase 2B: Add `compaction_middleware` as the FIRST item in `init_default_middleware()` in `backend/src/utils/middleware.py`
- [ ] If Phase 2A: Wire `DEFAULT_COMPACTION_TOKEN_THRESHOLD` and `DEFAULT_COMPACTION_RECENT_MESSAGES` through `init_graph()` in `backend/src/agents/__init__.py` to `create_deep_agent()`
- [ ] No breaking changes to existing callers of `construct_agent()`
- [ ] Import added to `backend/src/utils/middleware.py` or `backend/src/agents/__init__.py` as appropriate
- [ ] Typecheck passes

### US-007: Unit Tests for Compaction Classes
**Description:** As a developer, I need comprehensive unit tests for the compaction middleware to ensure correctness and prevent regressions.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/utils/test_compacting.py`
- [ ] Test: No-op when under token threshold
- [ ] Test: Triggers compaction when over threshold
- [ ] Test: System prompt is never summarized
- [ ] Test: Recent N messages are preserved verbatim
- [ ] Test: Summary message has `[CONVERSATION SUMMARY]` prefix
- [ ] Test: Summary message has `compacted: True` metadata
- [ ] Test: Summary message has correct `original_count` metadata
- [ ] Test: Uses `DEFAULT_CHAT_MODEL_BASIC` for summarization (mock LLM call)
- [ ] Test: Custom threshold overrides default
- [ ] Test: Custom recent_messages count overrides default
- [ ] All tests pass
- [ ] Typecheck passes

### US-008: Integration Tests for Middleware Stack
**Description:** As a developer, I need integration tests confirming the compaction middleware coexists correctly with the existing middleware stack.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/utils/test_middleware_integration.py`
- [ ] Test: Compaction middleware is present (and first) in default middleware list (Phase 2B) OR not present if Phase 2A
- [ ] Test: Compaction middleware coexists with `AutoEvictMiddleware` without conflict
- [ ] Test: Existing agent construction is backward-compatible (no regressions)
- [ ] Test: Middleware is a no-op for short message contexts
- [ ] All tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The system must estimate token count using `len(content) // 4` for each message
- FR-2: When total estimated tokens exceed `DEFAULT_COMPACTION_TOKEN_THRESHOLD` (170k default), the system must trigger compaction
- FR-3: The system must never compact or summarize system prompt messages
- FR-4: The system must preserve the N most recent messages (`DEFAULT_COMPACTION_RECENT_MESSAGES`, default 6) verbatim
- FR-5: The system must summarize older (non-system, non-recent) messages into a single `SystemMessage` with `[CONVERSATION SUMMARY]` prefix
- FR-6: Summary messages must include `metadata={"compacted": True, "original_count": N}` for observability
- FR-7: Summarization must use `DEFAULT_CHAT_MODEL_BASIC` (cheap/fast model)
- FR-8: The `CompactingMiddleware` ABC must allow subclassing for custom compaction strategies
- FR-9: Thresholds must be configurable via `COMPACTION_TOKEN_THRESHOLD` and `COMPACTION_RECENT_MESSAGES` environment variables
- FR-10: The middleware must be a complete no-op (pass-through) when token count is below threshold

## Non-Goals

- No per-assistant compaction configuration via database/Pydantic schema (follow-up PR)
- No tiktoken-based token counting (follow-up PR -- chars/4 is sufficient for MVP)
- No `MODEL_CONTEXT_WINDOWS` static map (follow-up PR)
- No frontend UI for compaction settings
- No metrics/observability dashboard for compaction events
- No automatic priority-based message preservation (beyond system prompt + recency)

## Technical Considerations

- **Deepagents internal check (CRITICAL):** `deepagents==0.3.8` may already auto-apply `SummarizationMiddleware` internally. Must verify before coding to avoid double-summarization. This gates Phase 2A vs 2B.
- **Token estimation:** `len(content) // 4` is conservative (overestimates) and consistent with existing `AutoEvictMiddleware` approach.
- **Middleware ordering:** Compaction should be FIRST in the middleware stack (Phase 2B) to reduce context for all downstream middleware.
- **AutoEvictMiddleware compatibility:** AutoEvict handles individual large tool results; compaction handles cumulative context growth. No conflict.
- **Summarization model:** Must use a cheap/fast model to avoid cost blowup -- summarization adds an LLM call only when triggered above threshold.
- **Async support:** The `compact()` method must be async since it calls an LLM for summarization.

## Success Metrics

- Agents can sustain conversations beyond 170k tokens without context window errors
- Compaction is transparent -- no degradation in agent response quality for short conversations
- Existing tests pass with zero regressions
- Type checker passes on all modified files

## Open Questions

- Does `deepagents==0.3.8` internally apply `SummarizationMiddleware`? (Must resolve in US-001 before implementation)
- Should compaction events be logged/observed for debugging? (Deferred to follow-up)
- Should per-assistant threshold configuration be supported via database? (Deferred to follow-up)
