# Plan: Context Reset with Structured Handoff Artifacts

## Context

Orchestra's `CompactingMiddleware` summarizes history in-place, but Anthropic's research found this insufficient for models exhibiting "context anxiety" — agents start wrapping up prematurely as the context window fills. Full context resets with structured handoff artifacts give the next agent a clean slate. This is critical for Sonnet-class models, which most Orchestra users choose for cost reasons.

Opus 4.6 largely removed context anxiety, making compaction sufficient for that model. But for Sonnet (and future models that may re-exhibit the pattern), resets remain essential.

## Requirements

- `ContextResetMiddleware` monitoring context utilization
- Standardized handoff artifact schema
- Agent produces handoff when reset triggers, new agent spawns with clean context
- Configurable per assistant: `context_strategy: "compact" | "reset" | "auto"`
- Thread UI shows reset boundaries
- Complements existing compaction, does not replace it

## Implementation Steps

### Step 1: Handoff schema

```python
# handoff.py
class HandoffArtifact(BaseModel):
    completed_work: list[str]        # What was finished
    in_progress: Optional[str]       # What was being worked on when reset triggered
    remaining_tasks: list[str]       # What still needs to be done
    key_decisions: list[str]         # Important decisions made during this session
    files_modified: list[str]        # Files touched in this session
    current_state_summary: str       # High-level summary for next agent
    plan_reference: Optional[str]    # Path to plan file if planner was used
```

### Step 2: ContextResetMiddleware

New middleware in `backend/src/utils/context_reset.py`:

1. After each model call, estimate current context utilization (input tokens / model context window)
2. When utilization exceeds configurable threshold (default: 80%), trigger reset
3. Inject a final instruction asking the agent to produce a `HandoffArtifact`
4. Parse the handoff from agent's response
5. Persist handoff to StateBackend as `/HANDOFF-{session_number}.md`
6. Spawn new agent instance with: system prompt + handoff artifact + relevant files only
7. New agent continues from the handoff

### Step 3: Assistant schema extension

Add `context_strategy: Literal["compact", "reset", "auto"]` to Assistant schema. Default: `"auto"` (compact for Opus-class, reset for Sonnet-class, based on model detection).

### Step 4: Session tracking

Track session number within a thread. Each context reset increments the session counter. Store mapping of session boundaries in thread metadata for UI rendering.

### Step 5: Frontend

- Visual divider in thread view at reset boundaries (e.g. "— Session 2 started —")
- Expandable handoff summary at each boundary showing what was carried forward
- Session navigator for long threads with many resets

### Step 6: Integration with planner/evaluator

- If planner produced a `/PLAN.md`, include it in every handoff so new sessions always have the plan
- Evaluator config carries across resets automatically
- Sprint contract state (if using sprint contracts) persists through resets

### Step 7: Tests

- Unit test: `HandoffArtifact` schema validation
- Unit test: middleware triggers at configurable threshold
- Unit test: auto strategy selects correct approach based on model name
- Integration test: agent completes a multi-step task across 2+ context resets
- Integration test: files and plan persist through resets

## File Changes

- `backend/src/schemas/entities/handoff.py` — new
- `backend/src/utils/context_reset.py` — new
- `backend/src/schemas/entities/llm.py` — add context_strategy field
- `backend/src/utils/middleware.py` — register new middleware
- `frontend/src/components/chat/SessionDivider.tsx` — new
- `frontend/src/components/chat/HandoffSummary.tsx` — new

## Risks

- Handoff quality: if the agent produces a poor summary, the next session starts with bad context. Mitigation: structured schema forces completeness; add validation.
- Token overhead: producing the handoff costs tokens. Mitigation: handoff prompt is short and structured; total overhead is small vs. the full context being summarized.
- Race conditions: if user sends a message during reset, it could be lost. Mitigation: queue incoming messages during reset, deliver to new session.

## GitHub Issue

**Title:** `feat: Context reset with structured handoff artifacts for long-running sessions`
**Labels:** `enhancement`, `context-management`, `high-impact`, `harness-design`
**Milestone:** v0.9.0 — Harness Design
