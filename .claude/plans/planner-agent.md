# Implementation Plan: Planner Agent — Automated Spec Expansion

## Overview

The Planner Agent introduces a pre-execution planning phase to Orchestra's assistant pipeline. When enabled via `PlannerConfig` on an Assistant, the planner intercepts the first message in a thread, expands the user's short prompt into a structured product specification (persisted as `/PLAN.md` in StateBackend), and optionally pauses for human-in-the-loop approval before the generator begins work. This follows Anthropic's harness research showing that a high-level planning phase dramatically improves the ambition and coherence of generated output.

## User Stories

1. **As an assistant creator**, I want to toggle a planner phase on my assistant so that short user prompts are automatically expanded into structured product specs before execution begins.

2. **As a user chatting with a planner-enabled assistant**, I want to see a "Planning..." indicator and then a collapsible plan panel so I understand what the assistant intends to build before it starts.

3. **As a team lead**, I want to require human approval of the generated plan (auto_approve=false) so that I can review and refine scope before the generator consumes tokens on implementation.

4. **As a power user**, I want to choose between "conservative" and "ambitious" scope levels so I can control how aggressively the planner expands my prompt.

5. **As a developer**, I want the planner to use a configurable model override (e.g., Opus for planning, Sonnet for generation) so I can balance quality and cost across phases.

## Implementation Phases

### Phase 1: Schema & Data Layer
**Files:**
- `backend/src/schemas/entities/planner.py` (new)
- `backend/src/schemas/entities/llm.py` (modify)
- `backend/migrations/versions/xxx_add_planner.py` (new)

**Tasks:**
1. Create `PlannerConfig` Pydantic model with fields: `enabled`, `auto_approve`, `model`, `scope_level`.
2. Add optional `planner: PlannerConfig` field to the `Assistant` schema.
3. Generate Alembic migration to persist planner config as a JSONB column on the assistants table.

**Acceptance Criteria:**
- PlannerConfig validates all field types and defaults correctly.
- Migration runs forward and backward cleanly.
- Existing assistants default to `planner=None` (no breaking change).

### Phase 2: Planner System Prompt
**Files:**
- `backend/src/static/prompts/md/planner.md` (new)

**Tasks:**
1. Write a system prompt that instructs the planner to:
   - Expand short prompts into structured product specs.
   - Be ambitious about scope; identify AI feature opportunities.
   - Stay high-level (product context, features, user stories, design direction).
   - Avoid granular implementation details.
   - Output structured markdown: Overview, Features (with user stories), Tech Stack, Design Direction.

**Acceptance Criteria:**
- Prompt produces well-structured specs from 1-4 sentence inputs.
- Output format is consistent and parseable.

### Phase 3: Pre-Execution Phase in LLMController
**Files:**
- `backend/src/controllers/llm.py` (modify)

**Tasks:**
1. On first message in a thread, check if the assistant has `planner.enabled = True`.
2. Invoke the planner with the user's message using the configured (or default) model.
3. If `auto_approve=False`, create a HITL interrupt presenting the plan for user approval.
4. On approval (or if `auto_approve=True`), persist the plan to StateBackend as `/PLAN.md`.
5. Inject the plan into the generator's context/memory sources.
6. Proceed to generator execution with original user message + plan context.

**Acceptance Criteria:**
- Planner phase only triggers on the first message of a thread.
- HITL interrupt blocks generator execution until approved.
- Plan is accessible to the generator throughout the thread lifecycle.
- Subsequent messages in the thread skip the planner phase.

### Phase 4: Frontend Display
**Files:**
- `frontend/src/components/chat/PlanPanel.tsx` (new)
- Thread view integration (modify existing thread/chat components)

**Tasks:**
1. Create `PlanPanel` component: collapsible panel rendering the plan markdown.
2. Show plan status indicator: "Planning...", "Awaiting approval", "Approved".
3. If `auto_approve=False`, render approval/rejection buttons using existing HITL interrupt UI patterns.
4. Integrate PlanPanel at the top of the thread view.

**Acceptance Criteria:**
- Plan panel renders markdown correctly and is collapsible.
- Approval UI integrates with existing HITL flow.
- Status transitions are reflected in real-time.

### Phase 5: Tests & Example
**Files:**
- `backend/tests/unit/test_planner_config.py` (new)
- `backend/tests/integration/test_planner_phase.py` (new)
- `examples/agents/planner_example.ipynb` (new)

**Tasks:**
1. Unit test: `PlannerConfig` field validation and defaults.
2. Unit test: planner phase triggers only on first message.
3. Integration test: planner expands "Build a todo app" into a multi-feature spec.
4. Integration test: `auto_approve=False` creates HITL interrupt.
5. Create example notebook demonstrating planner + generator pipeline.

**Acceptance Criteria:**
- All tests pass in CI.
- Example notebook runs end-to-end with a planner-enabled assistant.

## Dependencies & Risks

### Dependencies
- Existing HITL interrupt infrastructure (for approval flow).
- StateBackend file persistence (for `/PLAN.md` storage).
- Frontend HITL interrupt components (for approval UI).

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-scoping by planner | Generator cannot implement the full spec | `scope_level` config; generator can flag unimplementable items |
| Latency from extra LLM round-trip | Slower time-to-first-output | Use fast model for planner; show "Planning..." state in UI |
| Plan staleness over long threads | Plan becomes irrelevant as conversation evolves | Allow re-planning via user command or after N messages |
| Migration on large assistant tables | Slow deployment | JSONB column with NULL default; no table rewrite needed |

## Testing Strategy

- **Unit tests**: Schema validation, planner trigger logic, plan persistence.
- **Integration tests**: End-to-end planner flow with mocked LLM, HITL interrupt creation and resolution.
- **Manual QA**: Create a planner-enabled assistant in the UI, send a short prompt, verify plan display and approval flow.
- **Performance**: Measure added latency from planner phase; ensure it stays under 10s for typical prompts.
