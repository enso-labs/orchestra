# Implementation Plan: Context Reset with Structured Handoff Artifacts

## Overview

This feature introduces a **ContextResetMiddleware** that monitors context window utilization during long-running agent sessions. When utilization exceeds a configurable threshold, the middleware triggers a structured handoff: the current agent produces a `HandoffArtifact` summarizing its progress, and a new agent instance spawns with a clean context seeded only with the handoff artifact and essential references (system prompt, plan files, modified files).

This complements the existing `CompactingMiddleware` (which summarizes history in-place) by providing a full context reset path. The approach is especially valuable for Sonnet-class models, which exhibit "context anxiety" — premature task wrap-up as the context window fills. Per-assistant configuration allows operators to choose `compact`, `reset`, or `auto` (model-aware default).

**Spec file:** `.claude/specs/context-reset-handoff.md`

---

## User Stories

1. **As an operator**, I want to configure whether my assistant uses compaction or full context resets, so I can optimize for cost vs. quality based on the model I'm using.

2. **As a user running a long coding task**, I want the agent to seamlessly continue my work across context resets without losing track of what was done, what's in progress, and what remains.

3. **As a user reviewing a long thread**, I want to see clear visual boundaries where context resets occurred and be able to expand the handoff summary at each boundary to understand what was carried forward.

4. **As a developer**, I want the handoff artifact to include structured fields (completed work, in-progress tasks, remaining tasks, key decisions, files modified) so that downstream tooling can programmatically consume session state.

5. **As an operator using the planner/evaluator pattern**, I want plan files and evaluator configs to automatically persist through context resets so the new session always has the full plan context.

---

## Implementation Phases

### Phase 1: Backend Schema & Middleware Core

**Goal:** Define the HandoffArtifact schema and implement the core ContextResetMiddleware.

#### Tasks

1. **Create `backend/src/schemas/entities/handoff.py`**
   - Define `HandoffArtifact(BaseModel)` with fields: `completed_work`, `in_progress`, `remaining_tasks`, `key_decisions`, `files_modified`, `current_state_summary`, `plan_reference`, `session_number`, `timestamp`.
   - Add validation (e.g., `current_state_summary` non-empty, `session_number >= 1`).

2. **Create `backend/src/utils/context_reset.py`**
   - Implement `ContextResetMiddleware` class.
   - Monitor context utilization after each model call: `input_tokens / model_context_window`.
   - Configurable threshold (default 80%).
   - When threshold exceeded:
     a. Inject handoff-generation prompt into conversation.
     b. Parse the structured `HandoffArtifact` from agent response.
     c. Persist handoff to StateBackend as `/HANDOFF-{session_number}.md`.
     d. Spawn new agent with: system prompt + handoff artifact + relevant file references.
   - Handle edge cases: user messages arriving during reset (queue and replay).

3. **Extend `backend/src/schemas/entities/llm.py`**
   - Add `context_strategy: Literal["compact", "reset", "auto"]` field to the Assistant schema.
   - Default value: `"auto"`.
   - Auto logic: select `compact` for Opus-class models, `reset` for Sonnet-class models based on model name detection.

4. **Register middleware in `backend/src/utils/middleware.py`**
   - Add `ContextResetMiddleware` to the middleware chain.
   - Ensure it runs after `CompactingMiddleware` (compaction is tried first if strategy is `auto`).

#### Acceptance Criteria
- [ ] `HandoffArtifact` schema validates correctly with all required fields.
- [ ] Middleware triggers reset when context utilization exceeds threshold.
- [ ] `context_strategy` field is persisted and respected per assistant.
- [ ] Auto strategy correctly maps model names to strategies.
- [ ] Handoff artifact is persisted to StateBackend.

---

### Phase 2: Session Tracking & Thread Metadata

**Goal:** Track session boundaries within threads for UI rendering and API consumers.

#### Tasks

1. **Add session metadata to thread model**
   - Track `current_session_number` in thread metadata.
   - Store array of `session_boundaries` with: `session_number`, `handoff_artifact_path`, `timestamp`, `trigger_reason` (threshold vs. manual).

2. **Expose session data via API**
   - Extend thread detail endpoint to include session boundary data.
   - Add endpoint to retrieve a specific handoff artifact by session number.

#### Acceptance Criteria
- [ ] Thread metadata accurately tracks session count and boundaries.
- [ ] API returns session boundary data in thread detail responses.
- [ ] Handoff artifacts are retrievable by session number.

---

### Phase 3: Frontend UX

**Goal:** Visualize context reset boundaries in the chat thread UI.

#### Tasks

1. **Create `frontend/src/components/chat/SessionDivider.tsx`**
   - Horizontal divider component rendered at reset boundaries.
   - Shows: "Session {n} started" with timestamp.
   - Subtle visual treatment (e.g., dashed line with label).

2. **Create `frontend/src/components/chat/HandoffSummary.tsx`**
   - Expandable/collapsible card at each session boundary.
   - Displays the handoff artifact fields in a readable format.
   - Collapsed by default; shows a brief one-line summary.

3. **Session navigator (stretch)**
   - For threads with many resets, add a mini-navigator to jump between sessions.

4. **Integrate into chat message list**
   - Insert `SessionDivider` + `HandoffSummary` components between messages at session boundaries.
   - Use session boundary data from the thread detail API.

#### Acceptance Criteria
- [ ] Session dividers render at correct positions in the message list.
- [ ] Handoff summaries are expandable and display all artifact fields.
- [ ] UI degrades gracefully when no resets have occurred (no dividers shown).

---

### Phase 4: Planner/Evaluator Integration

**Goal:** Ensure plan files, evaluator configs, and sprint contract state persist through resets.

#### Tasks

1. **Include plan file in handoff context**
   - If a `/PLAN.md` exists in StateBackend, always include it in the new session's initial context alongside the handoff artifact.

2. **Carry evaluator configuration**
   - Evaluator settings (criteria, rubric) are re-injected into the new session's system prompt.

3. **Sprint contract persistence**
   - If sprint contracts are active, serialize current sprint state into the handoff artifact.

#### Acceptance Criteria
- [ ] New sessions receive the plan file if one exists.
- [ ] Evaluator config persists across resets without user intervention.
- [ ] Sprint contract state is accurately carried forward.

---

### Phase 5: Testing

**Goal:** Comprehensive test coverage for all components.

#### Tasks

1. **Unit tests (`backend/tests/unit/`)**
   - `test_handoff_schema.py`: Validate `HandoffArtifact` schema — required fields, optional fields, validation errors.
   - `test_context_reset_middleware.py`: Verify threshold detection, trigger logic, auto-strategy model mapping.
   - `test_context_strategy_field.py`: Verify assistant schema accepts and persists `context_strategy`.

2. **Integration tests (`backend/tests/integration/`)**
   - `test_context_reset_flow.py`: End-to-end test of a task completing across 2+ context resets.
   - `test_handoff_persistence.py`: Verify handoff artifacts and plan files persist through resets.
   - `test_session_boundaries_api.py`: Verify thread detail API returns correct session boundary data.

3. **Frontend tests**
   - `SessionDivider.test.tsx`: Renders with correct session number and timestamp.
   - `HandoffSummary.test.tsx`: Expand/collapse behavior, displays all artifact fields.

#### Acceptance Criteria
- [ ] All unit tests pass.
- [ ] Integration tests demonstrate multi-session continuity.
- [ ] Frontend component tests cover rendering and interaction.

---

## Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `CompactingMiddleware` | Exists | Context reset complements, does not replace compaction |
| `StateBackend` | Exists | Used to persist handoff artifacts |
| Assistant schema | Exists | Extended with `context_strategy` field |
| Thread metadata | Exists | Extended with session boundary tracking |
| Token counting utilities | Exists | Needed for context utilization calculation |

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Poor handoff quality from agent | High | Medium | Structured schema enforces completeness; add validation and fallback prompting |
| Token overhead for handoff generation | Low | High | Handoff prompt is short and structured; overhead is small relative to full context |
| Race condition: user message during reset | Medium | Low | Queue incoming messages during reset window; deliver to new session |
| Model detection for auto strategy | Low | Medium | Maintain a mapping of model name patterns; default to `compact` for unknown models |
| Breaking change to assistant schema | Medium | Low | New field has a default value (`auto`); existing assistants unaffected |

## Testing Strategy

- **Unit tests** cover schema validation, middleware trigger logic, and strategy selection in isolation.
- **Integration tests** verify the full reset flow end-to-end with mocked LLM responses.
- **Frontend tests** verify component rendering and interaction behavior.
- **Manual QA** for the visual UX of session dividers and handoff summaries in the chat thread.
- All tests runnable via `make test` (backend) and `npm run test` (frontend).
