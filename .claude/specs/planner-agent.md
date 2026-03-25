# Plan: Planner Agent — Automated Spec Expansion

## Context

Anthropic's harness research shows a planner agent that expands 1–4 sentence prompts into full product specs dramatically increases the ambition and coherence of generated output. The planner stays intentionally high-level — specifying granular implementation details upfront leads to cascading errors downstream. The planner focuses on product context, features, user stories, and design direction, then lets the generator figure out implementation.

Orchestra currently jumps straight from user input to agent execution with no planning phase.

## Requirements

- `PlannerConfig` on the Assistant schema (toggleable)
- Planner runs as a pre-phase before the generator
- Expands short prompts into structured product specs
- Persists plan as `/PLAN.md` in StateBackend for generator to reference
- Optionally presents plan to user for approval before execution (HITL integration)
- Planner prompted to be ambitious about scope and identify AI feature opportunities

## Implementation Steps

### Step 1: Schema definitions

Add to `backend/src/schemas/entities/`:

```python
# planner.py
class PlannerConfig(BaseModel):
    enabled: bool = False
    auto_approve: bool = True     # False = pause for user approval via HITL
    model: Optional[str] = None   # Override model for planner (e.g. use Opus)
    scope_level: Literal["conservative", "ambitious"] = "ambitious"
```

### Step 2: Extend Assistant schema

Add optional `planner: PlannerConfig` to `Assistant` in `backend/src/schemas/entities/llm.py`.

### Step 3: Planner system prompt

Create `backend/src/static/prompts/md/planner.md`:

- Role: expand a short user prompt into a structured product specification
- Be ambitious about scope — include features the user didn't explicitly request
- Stay high-level: product context, feature list, user stories, design language
- Do NOT specify granular implementation details (avoids cascading errors)
- Identify opportunities to weave AI-powered features into the product
- Output format: structured markdown with sections for Overview, Features (with user stories), Tech Stack, Design Direction

### Step 4: Pre-execution phase in LLMController

Modify `backend/src/controllers/llm.py`:

1. On first message in a thread, check if assistant has planner enabled
2. If yes, invoke planner assistant with user's message
3. Planner produces `/PLAN.md` content
4. If `auto_approve=False`, create HITL interrupt presenting the plan for user approval
5. If approved (or auto_approve), persist plan to StateBackend as `/PLAN.md`
6. Add plan file to generator's memory sources so it's available throughout execution
7. Proceed to generator with original user message + plan context

### Step 5: Frontend display

- Show plan in a collapsible panel at the top of the thread
- If `auto_approve=False`, render approval UI using existing HITL interrupt components
- Plan status indicator: "Planning...", "Awaiting approval", "Approved"

### Step 6: Migration

Alembic migration for planner config persistence on assistants.

### Step 7: Tests

- Unit test: `PlannerConfig` validation
- Unit test: planner phase triggers only on first message
- Integration test: planner expands "Build a todo app" into multi-feature spec with user stories
- Integration test: `auto_approve=False` creates HITL interrupt

### Step 8: Example

Create `examples/agents/planner_example.ipynb` demonstrating planner + generator pipeline.

## File Changes

- `backend/src/schemas/entities/planner.py` — new
- `backend/src/schemas/entities/llm.py` — add planner field
- `backend/src/controllers/llm.py` — pre-execution phase
- `backend/src/static/prompts/md/planner.md` — new
- `backend/migrations/versions/xxx_add_planner.py` — new
- `frontend/src/components/chat/PlanPanel.tsx` — new
- `examples/agents/planner_example.ipynb` — new

## Risks

- Over-scoping: planner may generate specs too ambitious for the generator. Mitigation: `scope_level` config, and generator can flag spec items it can't implement.
- Latency: planner adds a full LLM round-trip before work begins. Mitigation: use a fast model for planner when possible, show "Planning..." state in UI.
- Plan staleness: if the thread evolves, the initial plan may become irrelevant. Mitigation: allow re-planning via user command or after N messages.

## GitHub Issue

**Title:** `feat: Planner Agent — auto-expand short prompts into full product specs`
**Labels:** `enhancement`, `agents`, `high-impact`, `harness-design`
**Milestone:** v0.9.0 — Harness Design
