# Plan: Harness Templates — Pre-Built Multi-Agent Architectures

## Context

Orchestra has the primitives (subagents, tools, MCP, A2A) but no pre-built orchestration patterns that encode proven harness configurations. Every user reinvents the wheel. Anthropic's research identifies specific multi-agent architectures (planner → generator → evaluator) that consistently outperform solo agents. These should be packaged as selectable templates.

## Requirements

- `HarnessTemplate` entity bundling planner + generator + evaluator configs
- Built-in templates seeded on first run
- Template selector in new-assistant and new-thread creation flows
- Templates are forkable and customizable
- Each template includes model recommendations, evaluation criteria, and cost/time estimates

## Implementation Steps

### Step 1: Schema definition

```python
# harness_template.py
class HarnessTemplate(BaseModel):
    id: str
    name: str
    description: str
    is_builtin: bool = False
    planner: Optional[PlannerConfig] = None
    evaluator: Optional[EvaluatorConfig] = None
    default_models: dict[str, str]       # {"planner": "...", "generator": "...", "evaluator": "..."}
    evaluation_criteria: list[EvaluationCriterion] = []
    context_strategy: Literal["compact", "reset", "auto"] = "auto"
    estimated_cost_range: Optional[str] = None   # e.g. "$5-$50"
    estimated_duration: Optional[str] = None     # e.g. "30min-4hrs"
```

### Step 2: Built-in templates

Seed via `backend/seeds/`:

| Template | Planner | Evaluator | Context | Best For |
|----------|---------|-----------|---------|----------|
| **Solo** | None | None | compact | Quick tasks, Q&A, simple code |
| **Reviewed** | None | Yes (code quality criteria) | compact | Code generation with quality gates |
| **Full Harness** | Yes (ambitious) | Yes (product depth + functionality + design) | auto | Long-running app development |
| **Frontend Design** | Yes | Yes (design quality, originality, craft, functionality — Playwright MCP) | compact | UI/UX work with subjective quality grading |

### Step 3: API endpoints

- `GET /api/v0/templates` — list all templates (built-in + user-created)
- `GET /api/v0/templates/{id}` — get template details
- `POST /api/v0/templates` — create user template (fork or new)
- `PUT /api/v0/templates/{id}` — update user template
- `DELETE /api/v0/templates/{id}` — delete user template (built-in cannot be deleted)

### Step 4: Assistant integration

When creating an assistant, user can select a template. Template config is applied to the assistant's planner and evaluator fields. User can then customize from the template baseline.

### Step 5: Frontend

- Template selector card grid in assistant creation dialog
- Template preview showing: description, agent count, model recommendations, cost estimate
- "Fork" button on built-in templates
- Template indicator badge on assistants created from templates

### Step 6: Seeder

Create `backend/seeds/harness_templates.py` to seed built-in templates on first run, similar to existing `user_seeder.py`.

### Step 7: Tests

- Unit test: template schema validation
- Unit test: built-in templates cannot be deleted
- Integration test: creating assistant from template applies planner + evaluator config
- Integration test: forking a template creates an editable copy

## File Changes

- `backend/src/schemas/entities/harness_template.py` — new
- `backend/src/repos/harness_template_repo.py` — new
- `backend/src/services/harness_template.py` — new
- `backend/src/routes/v0/harness_template.py` — new
- `backend/seeds/harness_templates.py` — new
- `frontend/src/components/cards/TemplateCard.tsx` — new
- `frontend/src/components/dialogs/TemplateSelector.tsx` — new

## Dependencies

- Requires evaluator agent (plan: `evaluator-agent.md`)
- Requires planner agent (plan: `planner-agent.md`)

## GitHub Issue

**Title:** `feat: Harness Templates — reusable planner→generator→evaluator architectures`
**Labels:** `enhancement`, `agents`, `ux`, `high-impact`, `harness-design`
**Milestone:** v0.9.0 — Harness Design
