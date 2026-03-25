# Cost Tracking -- Implementation Plan

## Overview

Add per-run cost and duration tracking to Orchestra. Every LLM invocation records token counts, cost (USD), duration, and phase metadata. Aggregated metrics are surfaced per thread, with configurable budget caps that integrate with the existing HITL interrupt system. The frontend displays real-time cost badges and a detailed breakdown panel.

Spec: [`.claude/specs/cost-tracking.md`](../specs/cost-tracking.md)

## User Stories

1. **As a user**, I want to see the running cost of my current thread in the chat header so I can monitor spend in real time.
2. **As a user**, I want to set a budget cap on a thread or assistant so that execution pauses before exceeding my limit.
3. **As a user**, I want to view a per-turn cost breakdown (model, tokens, cost, duration) so I can identify expensive steps.
4. **As an admin**, I want to configure model pricing tables via API so costs stay accurate when providers change rates.
5. **As a team lead**, I want historical cost data per thread so I can analyze spending trends across projects.

## Implementation Phases

### Phase 1: Backend Data Layer (Priority: Critical)

**Goal**: Define schemas, database tables, and pricing constants.

**Tasks**:
1. Create `backend/src/schemas/entities/metrics.py` with `TurnMetrics`, `ThreadCostSummary`, and `RunBudget` Pydantic models.
2. Create `backend/src/constants/pricing.py` with hardcoded pricing dictionary for OpenAI, Anthropic, Google models.
3. Create Alembic migration for `turn_metrics` table (columns: turn_id, thread_id, assistant_id, user_id, model, input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost, duration_ms, phase, created_at).
4. Create Alembic migration for `run_budgets` table (columns: id, thread_id, assistant_id, user_id, max_cost_usd, max_tokens, action_on_exceed, is_active, created_at, updated_at).
5. Create Alembic migration for `pricing_overrides` table (columns: id, model, input_per_1k, output_per_1k, currency, created_at, updated_at).

**Acceptance Criteria**:
- Migrations run without errors on a clean database.
- Pydantic schemas validate correctly with sample data.
- Pricing dictionary covers at least 10 commonly used models.

### Phase 2: Metrics Capture Middleware (Priority: Critical)

**Goal**: Instrument LLM calls to capture token usage, cost, and duration.

**Tasks**:
1. Create `backend/src/utils/metrics.py` with `capture_turn_metrics()` wrapper.
2. Hook into the LangChain callback system (or wrap the LLM service layer) to intercept response metadata.
3. Extract `usage` (input_tokens, output_tokens) from LLM response.
4. Compute cost using pricing lookup (DB override -> hardcoded fallback).
5. Measure wall-clock duration with `time.perf_counter()`.
6. Persist `TurnMetrics` asynchronously (background task or fire-and-forget DB write).
7. Emit a `cost_update` event on the SSE/streaming channel for real-time frontend updates.

**Acceptance Criteria**:
- Every LLM call produces a `TurnMetrics` record in the database.
- Cost calculation matches expected values for known token counts and pricing.
- Metrics capture adds < 5ms overhead to request latency.

### Phase 3: Budget Enforcement (Priority: High)

**Goal**: Enforce spending limits with HITL integration.

**Tasks**:
1. Create `backend/src/services/budget.py` with budget check logic.
2. Before each LLM call, query cumulative thread cost (cached, refresh per turn).
3. Compare against active `RunBudget` for the thread/assistant.
4. Implement three actions: `pause` (HITL interrupt), `warn` (log + UI event), `stop` (raise error).
5. Integrate with existing HITL interrupt flow for the `pause` action.
6. Add budget status to the `cost_update` SSE event payload.

**Acceptance Criteria**:
- Thread pauses when cost exceeds budget with `pause` action.
- User can approve continuation after HITL interrupt.
- `stop` action halts execution and returns a clear error message.
- `warn` action logs and sends notification but does not block.

### Phase 4: API Endpoints (Priority: High)

**Goal**: Expose metrics, pricing, and budget management via REST API.

**Tasks**:
1. Create `backend/src/routes/v0/metrics.py` with thread metrics endpoints.
2. Create `backend/src/routes/v0/pricing.py` with pricing CRUD endpoints.
3. Create `backend/src/routes/v0/budgets.py` with budget CRUD endpoints.
4. Create corresponding controller and service layers.
5. Add OpenAPI documentation for all new endpoints.
6. Register routes in the v0 router.

**Acceptance Criteria**:
- All endpoints return correct data with proper HTTP status codes.
- Pricing CRUD is restricted to admin users.
- Thread metrics are scoped to the requesting user's threads.
- Endpoints appear in `/docs` with full OpenAPI schemas.

### Phase 5: Frontend Integration (Priority: Medium)

**Goal**: Display cost data in the chat UI with budget configuration.

**Tasks**:
1. Add `CostBadge` component to chat header showing running thread cost.
2. Subscribe to `cost_update` SSE events for real-time updates.
3. Build `CostBreakdownPanel` (expandable side panel or modal) with per-turn table and per-phase summary.
4. Build `BudgetConfigDialog` for setting budget caps on threads/assistants.
5. Add color-coded warning indicators: green (< 75%), yellow (75-99%), red (>= 100%) of budget.
6. Add cost column to thread list view for historical comparison.

**Acceptance Criteria**:
- Cost badge updates within 1 second of each LLM response.
- Breakdown panel displays accurate per-turn data with model, tokens, cost, and duration.
- Budget dialog saves configuration and reflects active budget in the UI.
- Warning colors transition correctly at threshold boundaries.

### Phase 6: Testing & Documentation (Priority: High)

**Goal**: Comprehensive test coverage and developer documentation.

**Tasks**:
1. Unit tests for pricing calculation (`test_pricing.py`).
2. Unit tests for budget threshold logic (`test_budget.py`).
3. Unit tests for metrics aggregation (`test_metrics.py`).
4. Integration tests for metrics capture during LLM calls.
5. Integration tests for budget enforcement with HITL interrupt.
6. Integration tests for all API endpoints.
7. Frontend tests for `CostBadge`, `CostBreakdownPanel`, `BudgetConfigDialog`.
8. Update API documentation and `llm.txt` if public-facing.

**Acceptance Criteria**:
- >= 80% code coverage on new backend modules.
- All integration tests pass in CI.
- Frontend component tests cover rendering and user interaction flows.

## Dependencies

- **Existing HITL system**: Budget `pause` action depends on the interrupt flow in `backend/src/schemas/entities/hitl.py`.
- **LangChain callback system**: Metrics capture hooks into the existing LLM invocation layer.
- **SSE/streaming infrastructure**: Real-time cost updates use the existing event streaming channel.
- **Database**: Requires PostgreSQL with Alembic migrations.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider pricing changes frequently | Stale costs | DB-backed overrides + periodic review cadence |
| Metrics capture adds latency | Slower responses | Async DB writes, fire-and-forget pattern |
| Token count unavailable for some models | Missing cost data | Graceful fallback: log warning, record zero cost |
| Budget check race condition (concurrent turns) | Overspend | Optimistic check + post-turn reconciliation |
| Large turn_metrics table over time | DB performance | Indexed queries, future: partitioning or archival |

## Testing Strategy

- **Unit**: Pure function tests for pricing math, budget thresholds, aggregation logic. No DB or network needed.
- **Integration**: Full request cycle with test database. Verify metrics records created, budget enforcement triggers, API responses correct.
- **Frontend**: Vitest + Testing Library for component rendering, mock SSE events, form validation.
- **Manual QA**: End-to-end flow with real LLM calls in dev environment, verify cost badge accuracy.
