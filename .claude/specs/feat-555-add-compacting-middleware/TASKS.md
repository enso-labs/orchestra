# Implementation Tasks: Add Compacting Middleware (#555)

## Pre-Implementation

- [ ] Task: Verify whether `deepagents==0.3.8` internally applies `SummarizationMiddleware` in `create_deep_agent()`
  - Files: `deepagents/graph.py` (installed package, lines 200-230); check via `python -c "import inspect; from deepagents.graph import create_deep_agent; print(inspect.getsource(create_deep_agent))"`
  - Acceptance: Written determination (YES or NO) of whether deepagents ships internal summarization middleware. This determines Phase 2A vs 2B. Document finding as a comment in the PR.

## Core Implementation

- [ ] Task: Add compaction constants to `backend/src/constants/llm.py`
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/constants/llm.py`
  - Acceptance: `DEFAULT_COMPACTION_TOKEN_THRESHOLD = int(os.getenv("COMPACTION_TOKEN_THRESHOLD", "170000"))` and `DEFAULT_COMPACTION_RECENT_MESSAGES = int(os.getenv("COMPACTION_RECENT_MESSAGES", "6"))` are defined and importable.

- [ ] Task: Create `CompactingMiddleware` abstract base class in new file `backend/src/utils/compacting.py`
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/compacting.py` (NEW)
  - Acceptance: ABC defines abstract method `compact(messages) -> messages`. Has `token_threshold` and `recent_messages` constructor params with defaults from constants. System prompt messages are never passed to `compact()`. Is importable from `backend.src.utils.compacting`.

- [ ] Task: Implement `SummarizationMiddleware` subclass in `backend/src/utils/compacting.py`
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/compacting.py`
  - Depends on: CompactingMiddleware ABC, constants
  - Acceptance:
    - Estimates tokens via `len(content) // 4` (consistent with AutoEvictMiddleware)
    - Triggers only when total tokens exceed `DEFAULT_COMPACTION_TOKEN_THRESHOLD`
    - Preserves system prompt messages (never summarized)
    - Preserves the N most recent messages (`DEFAULT_COMPACTION_RECENT_MESSAGES`)
    - Summarizes older messages using `DEFAULT_CHAT_MODEL_BASIC`
    - Summary is a `SystemMessage` with `[CONVERSATION SUMMARY]` prefix
    - Summary message has `metadata={"compacted": True, "original_count": N}`
    - Is a no-op when total tokens are under threshold

- [ ] Task: Create `compaction_middleware` as a `@wrap_model_call` decorator function in `backend/src/utils/compacting.py`
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/compacting.py`
  - Depends on: SummarizationMiddleware
  - Acceptance: Decorator function wraps model calls, invokes `SummarizationMiddleware` on the message list before passing to the model. Only applies if deepagents does NOT have internal summarization (Phase 2B). If deepagents has it (Phase 2A), this decorator is still created but not wired into defaults.

## Integration

- [ ] Task: Register compaction middleware in `init_default_middleware()` (Phase 2B only)
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/middleware.py`
  - Depends on: compaction_middleware decorator, deepagents verification result
  - Acceptance: If Phase 2B -- compaction middleware is the FIRST item in the middleware list returned by `init_default_middleware()`. If Phase 2A -- middleware is NOT added to defaults (deepagents handles it internally). Either way, no breaking changes to existing callers of `construct_agent()`.

- [ ] Task: Wire configurable thresholds through `init_graph()` to agent construction (Phase 2A path)
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/agents/__init__.py`
  - Depends on: constants, deepagents verification result
  - Acceptance: If Phase 2A and deepagents accepts configurable params, Orchestra passes `DEFAULT_COMPACTION_TOKEN_THRESHOLD` and `DEFAULT_COMPACTION_RECENT_MESSAGES` to `create_deep_agent()`. If deepagents does not accept params yet, document this as a follow-up upstream PR.

## Testing

- [ ] Task: Create unit tests for `CompactingMiddleware` ABC and `SummarizationMiddleware`
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/tests/unit/utils/test_compacting.py` (NEW)
  - Depends on: SummarizationMiddleware implementation
  - Acceptance: Minimum 10 test cases covering:
    1. No-op when under token threshold
    2. Triggers compaction when over threshold
    3. System prompt is never summarized
    4. Recent N messages are preserved verbatim
    5. Summary message has `[CONVERSATION SUMMARY]` prefix
    6. Summary message has `compacted: True` metadata
    7. Summary message has correct `original_count` metadata
    8. Uses `DEFAULT_CHAT_MODEL_BASIC` for summarization call
    9. Custom threshold overrides default
    10. Custom recent_messages count overrides default

- [ ] Task: Create integration tests for middleware stack composition
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/tests/unit/utils/test_middleware_integration.py` (NEW)
  - Depends on: Integration step complete
  - Acceptance: Minimum 4 test cases covering:
    1. Compaction middleware is present (and first) in default middleware list (Phase 2B) OR not present if Phase 2A
    2. Compaction middleware coexists with AutoEvictMiddleware without conflict
    3. Existing agent construction is backward-compatible (no regressions)
    4. Middleware is a no-op for short message contexts (existing tests unaffected)

- [ ] Task: Run full existing test suite to confirm no regressions
  - Files: `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/tests/`
  - Acceptance: All pre-existing tests pass. No test failures introduced.

## Verification

- [ ] Task: Run type checker across affected files
  - Files: All modified and new files
  - Acceptance: `mypy` or project type checker passes with no new errors on `backend/src/utils/compacting.py`, `backend/src/constants/llm.py`, `backend/src/utils/middleware.py`, `backend/src/agents/__init__.py`.

- [ ] Task: Manual smoke test -- confirm agent operates normally with compaction enabled
  - Files: N/A (runtime verification)
  - Acceptance: Start an agent session, confirm it responds normally for short conversations (no-op path). If possible, simulate a long conversation to observe compaction triggering and the summary message appearing in context.

- [ ] Task: Verify environment variable overrides work at runtime
  - Files: N/A (runtime verification)
  - Acceptance: Setting `COMPACTION_TOKEN_THRESHOLD=100000` and `COMPACTION_RECENT_MESSAGES=10` via env vars changes the middleware behavior accordingly.

## Completion Signature
- Total Tasks: 13
- Dependencies: deepagents verification (Task 1) gates the Phase 2A/2B decision for Tasks 5, 6, and integration approach
- Critical Path: Verify deepagents -> Constants -> ABC -> SummarizationMiddleware -> Decorator -> Integration -> Tests -> Verification
- Estimated Effort: 12-16 hours
- Non-Negotiable Requirements:
  1. System prompt must never be compacted
  2. Recent N messages preserved verbatim
  3. No-op when under threshold
  4. Summary messages clearly marked with prefix and metadata
  5. Summarization uses cheap/fast model
  6. No breaking changes to existing API
  7. Backward-compatible with existing `construct_agent()` callers
