# Plan: Harness Templates — Pre-Built Multi-Agent Architectures

## Overview

Orchestra provides all the primitives for multi-agent workflows (subagents, tools, MCP, A2A), but users must manually assemble planner, generator, and evaluator configurations every time. Anthropic's research shows that specific multi-agent architectures (planner -> generator -> evaluator) consistently outperform solo agents. Harness Templates package these proven patterns as selectable, forkable, and customizable templates that users can apply when creating assistants or threads.

This feature introduces a `HarnessTemplate` entity, seeds four built-in templates (Solo, Reviewed, Full Harness, Frontend Design), exposes CRUD API endpoints, integrates template selection into assistant creation flows, and provides a frontend template selector with card grid, preview, and fork capabilities.

## User Stories

1. **As a new user**, I want to select from pre-built harness templates when creating an assistant, so I can get a proven multi-agent architecture without manual configuration.

2. **As a developer building a complex app**, I want to choose the "Full Harness" template that includes a planner and evaluator, so I get planning and quality gates out of the box for long-running development tasks.

3. **As an experienced user**, I want to fork a built-in template and customize the planner config, evaluation criteria, and model selections, so I can tailor the architecture to my specific domain.

4. **As a cost-conscious user**, I want to see estimated cost ranges and duration estimates for each template, so I can make informed decisions about which harness architecture to use.

5. **As a team lead**, I want to create and share custom harness templates within my organization, so my team can follow standardized multi-agent patterns.

## Implementation Phases

### Phase 1: Schema and Data Layer

**Goal:** Define the HarnessTemplate entity, database model, and repository.

**Tasks:**
- Create `backend/src/schemas/entities/harness_template.py` with `HarnessTemplate`, `PlannerConfig`, `EvaluatorConfig`, and `EvaluationCriterion` Pydantic models
- Create database migration for `harness_templates` table (id, name, description, is_builtin, planner config JSON, evaluator config JSON, default_models JSON, evaluation_criteria JSON, context_strategy, estimated_cost_range, estimated_duration, user_id FK, forked_from FK, timestamps)
- Create `backend/src/repos/harness_template_repo.py` with CRUD operations
- Add `is_builtin` protection: built-in templates cannot be deleted or modified

**Acceptance Criteria:**
- [ ] HarnessTemplate schema validates all fields including nested PlannerConfig and EvaluatorConfig
- [ ] Migration creates table with proper indexes and foreign keys
- [ ] Repository supports list, get, create, update, delete with built-in protection
- [ ] Unit tests pass for schema validation and built-in deletion guard

### Phase 2: Seeder and Built-in Templates

**Goal:** Seed four built-in templates on first run.

**Tasks:**
- Create `backend/seeds/harness_templates.py` seeder following the pattern of existing `user_seeder.py`
- Define four built-in templates:
  - **Solo** — No planner, no evaluator, compact context. Best for quick tasks, Q&A, simple code.
  - **Reviewed** — No planner, evaluator with code quality criteria, compact context. Best for code generation with quality gates.
  - **Full Harness** — Planner (ambitious mode), evaluator (product depth + functionality + design criteria), auto context. Best for long-running app development.
  - **Frontend Design** — Planner enabled, evaluator with design quality/originality/craft/functionality criteria (Playwright MCP), compact context. Best for UI/UX work with subjective quality grading.
- Include model recommendations (default_models) for each role per template
- Include cost/time estimates per template
- Wire seeder into startup or `make seeds` target

**Acceptance Criteria:**
- [ ] Running the seeder creates all four built-in templates
- [ ] Seeder is idempotent (re-running does not duplicate templates)
- [ ] Each template has complete planner, evaluator, model, and cost/time configuration
- [ ] Seeder integrates with existing seed infrastructure

### Phase 3: API Endpoints

**Goal:** Expose CRUD API for harness templates.

**Tasks:**
- Create `backend/src/services/harness_template.py` service layer
- Create `backend/src/routes/v0/harness_template.py` with endpoints:
  - `GET /api/v0/templates` — list all templates (built-in + user-created), filterable
  - `GET /api/v0/templates/{id}` — get template details
  - `POST /api/v0/templates` — create user template (new or fork)
  - `PUT /api/v0/templates/{id}` — update user template (reject updates to built-in)
  - `DELETE /api/v0/templates/{id}` — delete user template (reject deletion of built-in)
- Add fork endpoint or fork flag on POST that copies a template with `forked_from` reference
- Register routes in the v0 router

**Acceptance Criteria:**
- [ ] All CRUD endpoints return proper status codes and error messages
- [ ] Built-in templates return 403 on update/delete attempts
- [ ] Fork creates a new template with `is_builtin=False` and `forked_from` set
- [ ] List endpoint supports filtering by `is_builtin` and search by name
- [ ] Integration tests cover all endpoints including error cases

### Phase 4: Assistant Integration

**Goal:** Wire template selection into assistant creation flow.

**Tasks:**
- Add `template_id` optional field to assistant creation schema
- When a template is selected during assistant creation, apply the template's planner and evaluator config to the new assistant
- Allow user to override individual template fields after selection
- Add template indicator to assistant detail view (which template it was created from)

**Acceptance Criteria:**
- [ ] Creating an assistant with a `template_id` applies planner + evaluator config
- [ ] User can override template defaults during creation
- [ ] Assistant stores reference to source template for traceability
- [ ] Integration test: create assistant from template, verify config applied correctly

### Phase 5: Frontend — Template Selector

**Goal:** Build the template selector UI for assistant creation flows.

**Tasks:**
- Create `frontend/src/components/cards/TemplateCard.tsx` — card showing template name, description, agent count, model recommendations, cost estimate badge
- Create `frontend/src/components/dialogs/TemplateSelector.tsx` — card grid dialog for browsing and selecting templates
- Add template preview panel showing full configuration details
- Add "Fork" button on built-in template cards
- Add template indicator badge on assistants created from templates
- Integrate selector into existing assistant creation dialog

**Acceptance Criteria:**
- [ ] Template cards display name, description, cost estimate, and agent configuration summary
- [ ] Selecting a template populates the assistant creation form
- [ ] Fork button creates a user-owned copy and opens it for editing
- [ ] Responsive card grid layout works on desktop and mobile
- [ ] Frontend tests cover card rendering and selection flow

## Dependencies and Risks

### Dependencies
- **Evaluator Agent spec** (`evaluator-agent.md`): The `EvaluatorConfig` schema and evaluator behavior must be defined before templates can fully configure evaluators. Templates can be created with placeholder evaluator configs, but full integration requires the evaluator agent implementation.
- **Planner Agent spec** (`planner-agent.md`): The `PlannerConfig` schema and planner behavior must be defined before templates can fully configure planners. Same mitigation as evaluator.

### Risks
- **Schema coupling**: If evaluator/planner config schemas change, all built-in templates need updating. Mitigate by using a version field on templates and migration scripts.
- **Scope creep**: Template customization UI could become complex. Mitigate by keeping Phase 5 to selection and fork only; advanced editing can come later.
- **Seeder ordering**: Template seeder must run after user seeder if templates have user ownership. Mitigate by making built-in templates system-owned (no user FK).

### Mitigation Strategy
Phases 1-3 (schema, seeder, API) can proceed with stub PlannerConfig/EvaluatorConfig types. The templates will hold the configuration data even before planner/evaluator agents are fully implemented. Phase 4 integration is the point where dependency on those specs becomes blocking.

## Testing Strategy

### Unit Tests (`backend/tests/unit/`)
- `test_harness_template_schema.py`: Validate HarnessTemplate, PlannerConfig, EvaluatorConfig schema parsing and defaults
- `test_harness_template_builtin_protection.py`: Verify built-in templates cannot be deleted or modified
- `test_harness_template_fork.py`: Verify fork creates proper copy with correct field values

### Integration Tests (`backend/tests/integration/`)
- `test_harness_template_api.py`: Full CRUD lifecycle via API endpoints
- `test_harness_template_seeder.py`: Seeder creates all built-in templates, idempotent on re-run
- `test_harness_template_assistant_integration.py`: Creating assistant from template applies correct config

### Frontend Tests (`frontend/src/tests/`)
- `TemplateCard.test.tsx`: Card renders template data correctly
- `TemplateSelector.test.tsx`: Grid displays templates, selection works, fork triggers API call

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/schemas/entities/harness_template.py` | New | HarnessTemplate, PlannerConfig, EvaluatorConfig schemas |
| `backend/src/repos/harness_template_repo.py` | New | Repository with CRUD + built-in protection |
| `backend/src/services/harness_template.py` | New | Service layer for template operations |
| `backend/src/routes/v0/harness_template.py` | New | REST API endpoints |
| `backend/seeds/harness_templates.py` | New | Built-in template seeder |
| `backend/src/routes/v0/__init__.py` | Modify | Register template routes |
| `frontend/src/components/cards/TemplateCard.tsx` | New | Template card component |
| `frontend/src/components/dialogs/TemplateSelector.tsx` | New | Template selector dialog |
| Alembic migration | New | harness_templates table |
| `backend/tests/unit/test_harness_template_*.py` | New | Unit tests |
| `backend/tests/integration/test_harness_template_*.py` | New | Integration tests |
| `frontend/src/tests/TemplateCard.test.tsx` | New | Frontend card tests |
| `frontend/src/tests/TemplateSelector.test.tsx` | New | Frontend selector tests |
