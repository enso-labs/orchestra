# Council Review: Issue #555 -- Add Compacting Middleware

**Review Date:** 2026-01-31
**Reviewers:** Elite Council (Synthesis of 3 Agent Proposals)
**Status:** CONDITIONAL GO

---

## 1. Executive Summary

All three proposals agree on the core need and general approach: add a `CompactingMiddleware` base class and `SummarizationMiddleware` implementation that auto-summarizes older messages when context exceeds ~170k tokens. The proposals are largely complementary rather than contradictory. The Middleware Architect (AGENT_1) uncovered a critical ordering issue with `deepagents` internals that must drive the implementation strategy. The Token Strategist (AGENT_2) provided the most detailed token counting and threshold design. The Integration Engineer (AGENT_3) delivered the most practical, ship-ready integration plan with the best testing strategy.

**Overall assessment: 9 of 10 requirements addressed. One critical architectural decision (middleware ordering vs. deepagents internals) must be resolved before implementation begins.**

---

## 2. Proposal Comparison Matrix

| Aspect | MIDDLEWARE_ARCHITECT | TOKEN_STRATEGIST | INTEGRATION_ENGINEER | Council Verdict |
|--------|---------------------|------------------|----------------------|-----------------|
| **Architecture** | Deep analysis of deepagents internals; identified double-middleware risk; proposed Options A/B/C | ABC base class with TokenCounter protocol; tiered counting; context window map | Pragmatic: implement in Orchestra, upstream later; clean separation into `compacting.py` | Adopt AGENT_3's file layout with AGENT_1's awareness of deepagents internals |
| **Token Counting** | Deferred to deepagents' existing `count_tokens_approximately` | Tiered: fast char estimate + tiktoken for OpenAI; `TokenCounter` protocol | Simple chars/4 estimate | Adopt AGENT_2's tiered approach but defer tiktoken to a follow-up; chars/4 is sufficient for MVP |
| **Configuration** | Per-assistant Pydantic schema (`CompactingConfig`) | Ratio-based thresholds (0.85 trigger, 0.50 target); static context window map | Env vars + constants (matches existing patterns) | Start with AGENT_3's env var approach for MVP; add AGENT_1's per-assistant config in a follow-up |
| **Middleware Ordering** | Identified that Orchestra middleware runs AFTER deepagents internal stack -- critical finding | Placed compaction before PII/AutoEvict in Orchestra stack | Placed compaction first in Orchestra stack | AGENT_1's finding is critical -- see Divergence Analysis below |
| **Maintainability** | High -- ABC pattern, clear extension points | High -- protocol-based, multiple strategy classes planned | High -- simple, minimal new abstractions | All acceptable |
| **Risk Level** | Medium -- identified double-summarization risk honestly | Low-Medium -- thorough risk table but missed deepagents ordering issue | Low -- simpler approach avoids some risks but missed deepagents internals | AGENT_1's risk analysis is the most accurate |
| **Completeness** | Most thorough on architecture; lighter on tests | Most thorough on token strategy; good on tests | Most thorough on integration and testing; lightest on architecture | Complementary -- combine all three |
| **Effort Estimate** | 10-14 hours | 12-17 hours | 8-12 hours | ~12-16 hours realistic |

---

## 3. Consensus Points

All proposals agree on:

1. **CompactingMiddleware ABC** -- An abstract base class for extensibility, with `SummarizationMiddleware` as the default implementation.
2. **Token threshold ~170k** -- Aligns with 85% of Anthropic's 200k context window.
3. **Preserve recent messages** -- Keep the N most recent messages (6-10) intact; only summarize older messages.
4. **System prompt preservation** -- Never compact/summarize the system prompt.
5. **Use a cheap model for summarization** -- `DEFAULT_CHAT_MODEL_BASIC` (fast/cheap model) to avoid cost blowup.
6. **Middleware pattern** -- `@wrap_model_call` decorator to intercept before model invocation.
7. **Backward compatibility** -- No-op when under threshold; no breaking API changes.
8. **AutoEvictMiddleware is complementary** -- Handles individual large results; compaction handles cumulative growth. No conflict.
9. **Summary message should be clearly marked** -- Prefix with `[CONVERSATION SUMMARY]` or `[Context Summary]` so the model knows it is reading compressed history.

---

## 4. Divergence Analysis

### Divergence 1: Deepagents Internal SummarizationMiddleware (CRITICAL)

**AGENT_1** discovered that `create_deep_agent()` in `deepagents==0.3.8` already auto-applies `SummarizationMiddleware` with hardcoded defaults (85%/170k). Orchestra middleware is appended AFTER the internal stack, meaning Orchestra's compaction would run after the internal one has already fired.

**AGENT_2 and AGENT_3** did not account for this. AGENT_2 places compaction in `init_default_middleware()` assuming it runs independently. AGENT_3 states deepagents has "no SummarizationMiddleware" -- this contradicts AGENT_1's finding.

**Council Decision:** AGENT_1's analysis must be verified against the actual `deepagents==0.3.8` source. If confirmed:
- For MVP, accept the deepagents defaults (they already implement the 170k threshold from the issue).
- Orchestra's role reduces to: (a) exposing an on/off toggle, (b) providing the `CompactingMiddleware` ABC for future custom strategies, and (c) pursuing Option A (upstream param) to make thresholds configurable.
- If deepagents does NOT have internal `SummarizationMiddleware`, proceed with AGENT_2/AGENT_3's approach of adding it in Orchestra's middleware stack.

**This is the single most important finding in the review and must be resolved before coding begins.**

### Divergence 2: Token Counting Complexity

| Proposal | Approach |
|----------|----------|
| AGENT_1 | Relies on deepagents' existing `count_tokens_approximately` |
| AGENT_2 | New `TokenCounter` protocol with `TiktokenCounter` + `ApproximateCounter` + `MODEL_CONTEXT_WINDOWS` map |
| AGENT_3 | Simple `len(content) // 4` inline |

**Council Decision:** For MVP, use `len(content) // 4` (AGENT_3). It is consistent with `AutoEvictMiddleware`'s existing approach in the codebase. Add AGENT_2's `TokenCounter` protocol and `MODEL_CONTEXT_WINDOWS` map as a follow-up enhancement. Do not add tiktoken as a dependency for v1.

### Divergence 3: Configuration Surface

| Proposal | Approach |
|----------|----------|
| AGENT_1 | Per-assistant Pydantic `CompactingConfig` schema; requires schema migration |
| AGENT_2 | Ratio-based config fields on the middleware class |
| AGENT_3 | Environment variables + constants; no schema changes |

**Council Decision:** Start with AGENT_3's env var approach (zero schema changes, zero migration, matches existing patterns). Add AGENT_1's per-assistant config in a subsequent PR. The env var approach ships faster and satisfies the issue requirements.

### Divergence 4: Summary Message Type

| Proposal | Message Type |
|----------|-------------|
| AGENT_1 | Not specified explicitly |
| AGENT_2 | `SystemMessage` with `[CONVERSATION SUMMARY]` prefix |
| AGENT_3 | `AIMessage` with `[Context Summary]` prefix and `metadata={"compacted": True}` |

**Council Decision:** Use `SystemMessage` (AGENT_2). Rationale: summaries are meta-information about the conversation, not utterances from the user or assistant. SystemMessage is semantically correct. Add AGENT_3's metadata tag (`compacted: True, original_count: N`) for observability.

### Divergence 5: File Organization

| Proposal | Location |
|----------|----------|
| AGENT_1 | All in `backend/src/utils/middleware.py` |
| AGENT_2 | Split: `utils/tokens.py` + `utils/compacting.py` + updated `middleware.py` |
| AGENT_3 | `utils/compacting.py` + updated `middleware.py` |

**Council Decision:** Adopt AGENT_2/AGENT_3's approach: new `backend/src/utils/compacting.py` for the compaction classes. Keep `middleware.py` focused on the middleware factory. Defer `tokens.py` to a follow-up (not needed if using simple chars/4).

---

## 5. Unified Implementation Plan

### Phase 1: Verify Deepagents Internals (1 hour)

**Before any code is written**, verify whether `deepagents==0.3.8` ships `SummarizationMiddleware` internally in `create_deep_agent()`. Check `deepagents/graph.py` lines 200-230.

- If YES: Phase 2A (lighter implementation)
- If NO: Phase 2B (full implementation)

### Phase 2A: Deepagents Already Has Summarization (if confirmed)

1. Add `CompactingMiddleware` ABC to `backend/src/utils/compacting.py` (foundation for future custom strategies)
2. Add constants to `backend/src/constants/llm.py`:
   - `DEFAULT_COMPACTION_TOKEN_THRESHOLD = int(os.getenv("COMPACTION_TOKEN_THRESHOLD", "170000"))`
   - `DEFAULT_COMPACTION_RECENT_MESSAGES = int(os.getenv("COMPACTION_RECENT_MESSAGES", "6"))`
3. Upstream PR to `deepagents` to accept configurable `summarization_trigger` and `summarization_keep` params in `create_deep_agent()`
4. Wire Orchestra's constants through `init_graph()` to `create_deep_agent()` once upstream merges
5. Unit tests for the ABC and configuration wiring
6. Integration test confirming summarization fires at threshold

### Phase 2B: Orchestra Implements Summarization (if deepagents lacks it)

1. Create `backend/src/utils/compacting.py`:
   - `CompactingMiddleware` ABC
   - `SummarizationMiddleware` class (AGENT_3's design with AGENT_2's threshold ratios)
2. Add `compaction_middleware` as a `@wrap_model_call` decorator function
3. Add to `init_default_middleware()` as the FIRST item in the list
4. Add constants to `backend/src/constants/llm.py` (same as 2A)
5. Unit tests (~10 cases per AGENT_3's test table)
6. Integration tests (~4 cases for stack composition)

### Phase 3: Follow-up Enhancements (separate PRs)

- Per-assistant `CompactingConfig` schema (AGENT_1)
- `TokenCounter` protocol with tiktoken support (AGENT_2)
- `MODEL_CONTEXT_WINDOWS` static map (AGENT_2)
- Frontend UI for compaction settings
- Metrics/observability for compaction events

### Implementation Sequence

```
[Verify deepagents] -> [ABC + Constants] -> [Middleware impl or upstream PR] -> [Wire into stack] -> [Tests] -> [PR]
```

### Non-Negotiable Requirements

1. System prompt must never be compacted
2. Recent N messages (configurable, default 6-10) must be preserved verbatim
3. Compaction must be a no-op when under threshold
4. Summary messages must be clearly marked with a prefix and metadata
5. Summarization must use a cheap/fast model, not the agent's primary model
6. No breaking changes to existing API contracts
7. Backward-compatible with existing `construct_agent()` callers

---

## 6. Risk Consolidation

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Double summarization (deepagents internal + Orchestra) | **Critical** | High (if deepagents has internal summarization) | Verify deepagents internals first; use Option A (upstream param) or accept defaults |
| Summary loses critical context | High | Medium | Preserve recent messages; structured prompt; mark summaries clearly |
| Summarization LLM call adds latency | Medium | High (when triggered) | Use cheapest model; only triggers above threshold; log timing |
| Token estimation inaccuracy | Low | Medium | chars/4 overestimates (conservative); 15% buffer before context limit |
| Summarization call failure | Medium | Low | Fallback to simple truncation; existing retry middleware helps |
| Middleware ordering conflicts with dynamic_model_selection | Medium | Medium | Use model from request at invocation time; document ordering requirements |
| Breaking existing tests | Low | Low | Compaction is no-op for short contexts; existing tests use short messages |

---

## 7. Final Verdict

**CONDITIONAL GO**

**Conditions:**

1. **MUST** verify whether `deepagents==0.3.8` internally applies `SummarizationMiddleware` in `create_deep_agent()` before any implementation begins. This determines whether we follow Phase 2A or 2B.
2. **MUST** resolve the middleware ordering question -- if deepagents applies summarization internally, adding a second instance in Orchestra's stack would be redundant or harmful.
3. **MUST** include at minimum the unit tests outlined by AGENT_3 (10 cases) and integration tests (4 cases).

**Confidence Level: Medium-High**

The proposals are well-researched and largely complementary. The one critical unknown (deepagents internal behavior) is easily resolved with a 30-minute code inspection. Once that is confirmed, the implementation path is clear and low-risk. Estimated total effort: 12-16 hours for one developer.

---

## Appendix: Key Files

| File | Purpose |
|------|---------|
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/agents/__init__.py` | Agent construction, `init_graph()`, middleware injection |
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/middleware.py` | Current middleware factory |
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/utils/stream.py` | Stream path agent construction |
| `/home/ryaneggz/ruska-ai/orchestra/.worktrees/feat-555/backend/src/constants/llm.py` | LLM constants (add compaction thresholds here) |
| `backend/src/utils/compacting.py` (NEW) | CompactingMiddleware ABC + SummarizationMiddleware |
| `backend/tests/unit/utils/test_compacting.py` (NEW) | Unit tests |
| `backend/tests/unit/utils/test_middleware_integration.py` (NEW) | Integration tests |
