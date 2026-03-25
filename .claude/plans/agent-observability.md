# Plan: Agent Phase Observability & Trace Visualization

## Overview

Add structured observability to Orchestra's agent execution pipeline. Each agent phase (planner, generator, evaluator, handoff, tool_call, retrieval) emits a span with timing, token usage, model, cost, and error information. Spans are persisted to PostgreSQL, exposed via REST API, rendered in a frontend swimlane timeline, and optionally exported via OpenTelemetry OTLP.

Full spec: [`.claude/specs/agent-observability.md`](../specs/agent-observability.md)

## User Stories

1. **As a developer**, I want to see a visual timeline of every phase my agent went through when processing a request, so I can identify bottlenecks and understand execution flow.

2. **As an operator**, I want per-phase token counts and cost breakdowns for each thread turn, so I can monitor spending and optimize prompt sizes.

3. **As a developer debugging an error**, I want to click on a failed phase span and see the error message, metadata, and timing context, so I can quickly root-cause issues.

4. **As a platform engineer**, I want to export agent spans to our existing Datadog/Jaeger infrastructure via OTLP, so agent telemetry integrates with our broader observability stack.

5. **As a team lead**, I want to compare trace timelines across different agent configurations, so I can evaluate which setups produce faster, cheaper, or more reliable results.

## Implementation Phases

### Phase 1: Backend Schema & Storage

**Goal:** Define the data model, create the database table, and implement span CRUD.

**Tasks:**
- [ ] Create `backend/src/schemas/entities/trace.py` with `AgentSpan`, `SpanPhase` enum, `SpanStatus` enum Pydantic models
- [ ] Create SQLAlchemy model in `backend/src/models/` (or extend existing models module) for `agent_spans` table
- [ ] Create Alembic migration `0002_add_agent_spans.py` with columns matching the schema, indexes on `trace_id`, `thread_id`, `started_at`
- [ ] Create `backend/src/repos/trace_repo.py` with `create_span`, `update_span`, `get_spans_by_trace`, `get_spans_by_thread`, `get_span_by_id`

**Acceptance Criteria:**
- Migration runs cleanly on fresh and existing databases
- Repo methods pass unit tests for CRUD operations
- Schema validates all field types and constraints

### Phase 2: Span Lifecycle & Instrumentation Utilities

**Goal:** Provide ergonomic utilities for emitting spans from agent code.

**Tasks:**
- [ ] Create `backend/src/utils/tracing.py` with:
  - `start_span(trace_id, phase, thread_id, **kwargs) -> AgentSpan`
  - `end_span(span_id, status, output_tokens, cost_usd, error, **kwargs)`
  - `@trace_phase(phase)` async context manager / decorator
  - `TraceContext` using `contextvars` for propagating `trace_id` and `parent_span_id`
- [ ] Integrate `@trace_phase` into existing agent pipeline phases (planner, generator, evaluator, handoff points)
- [ ] Wire token count and cost data from LLM callbacks into span finalization

**Acceptance Criteria:**
- Context manager correctly creates and finalizes spans with accurate timing
- Nested spans (e.g., tool_call inside generator) have correct `parent_span_id`
- Token counts and cost flow through from LLM callbacks
- Unit tests cover normal completion, error, and nested span scenarios

### Phase 3: REST API Endpoints

**Goal:** Expose trace data for frontend consumption and external integrations.

**Tasks:**
- [ ] Create `backend/src/routes/v0/trace.py` with endpoints:
  - `GET /api/v0/threads/{thread_id}/traces` — paginated list of trace groups
  - `GET /api/v0/threads/{thread_id}/traces/{trace_id}` — all spans for a trace
  - `GET /api/v0/traces/{trace_id}/spans/{span_id}` — single span detail
- [ ] Add response schemas in `backend/src/schemas/entities/trace.py` (list/detail response wrappers)
- [ ] Register routes in the v0 router
- [ ] Add authentication/authorization checks (same as thread access)

**Acceptance Criteria:**
- Endpoints return correct data shapes per OpenAPI spec
- Thread-level auth prevents cross-user trace access
- Pagination works for threads with many traces
- Integration tests cover happy path and 404/403 scenarios

### Phase 4: Frontend Timeline Component

**Goal:** Visual swimlane timeline in the thread view showing agent phases.

**Tasks:**
- [ ] Create `frontend/src/components/timeline/TraceTimeline.tsx` — main container component
- [ ] Create `frontend/src/components/timeline/SpanBlock.tsx` — individual phase block with color coding
- [ ] Create `frontend/src/components/timeline/SpanDetail.tsx` — drill-down panel for a selected span
- [ ] Add React Query hook `frontend/src/hooks/useTraceData.ts` for fetching trace API data
- [ ] Integrate timeline into the thread/chat view (collapsible panel)
- [ ] Phase color mapping: planner=blue, generator=green, evaluator=amber, handoff=purple, tool_call=slate, retrieval=cyan
- [ ] Dark mode support via Tailwind classes
- [ ] Hover tooltip showing duration, tokens, cost

**Acceptance Criteria:**
- Timeline renders correctly for traces with 1-20+ spans
- Span blocks are proportionally sized by duration
- Hover shows tooltip; click opens detail panel
- Responsive on desktop and tablet viewports
- Vitest component tests for rendering and interaction

### Phase 5: OpenTelemetry OTLP Export

**Goal:** Optional export of spans to external observability platforms.

**Tasks:**
- [ ] Add `opentelemetry-api`, `opentelemetry-sdk`, `opentelemetry-exporter-otlp-proto-grpc` to `backend/pyproject.toml` as optional dependencies
- [ ] Create `backend/src/utils/otel_exporter.py` with:
  - OTel `TracerProvider` setup (conditional on `OTEL_EXPORTER_OTLP_ENDPOINT` env var)
  - `export_span(agent_span: AgentSpan)` mapping function
  - Attribute mapping: phase, model, tokens, cost, thread_id, error
- [ ] Call `export_span` from `end_span` when OTLP is configured
- [ ] Add `.env.example` entries for OTLP configuration

**Acceptance Criteria:**
- When `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, no OTel code is loaded (zero overhead)
- When configured, spans appear in Jaeger/collector with correct attributes
- Unit tests mock the exporter and verify attribute mapping

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| Agent pipeline phase hooks | Medium — planner/evaluator may not have clean entry/exit points today | Phase 2 may require refactoring phase boundaries; start with generator which is well-defined |
| LLM callback token counts | Low — LangChain callbacks already provide this | Wire existing callback data into span finalization |
| PostgreSQL migration | Low — additive table, no schema changes to existing tables | Standard Alembic migration; reversible |
| OpenTelemetry deps | Low — optional extras, not required at runtime | Conditional imports; feature-flagged via env var |
| Frontend bundle size | Low — timeline is a small component | Lazy-load the timeline panel |

## Testing Strategy

### Unit Tests
- `backend/tests/unit/test_tracing.py` — span lifecycle, context propagation, timing accuracy
- `backend/tests/unit/test_trace_repo.py` — CRUD operations with mocked DB
- `backend/tests/unit/test_otel_exporter.py` — attribute mapping, conditional loading
- `frontend/src/tests/TraceTimeline.test.tsx` — rendering, interaction, empty states

### Integration Tests
- `backend/tests/integration/test_trace_routes.py` — full API roundtrip (create spans via tracing utils, fetch via API)
- Database migration up/down test

### Manual Testing
- Run agent with tracing enabled, verify timeline appears in frontend
- Configure OTLP endpoint, verify spans in Jaeger UI

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Schema & Storage | 1-2 days |
| Phase 2: Lifecycle & Instrumentation | 2-3 days |
| Phase 3: REST API | 1 day |
| Phase 4: Frontend Timeline | 2-3 days |
| Phase 5: OTLP Export | 1-2 days |
| **Total** | **7-11 days** |
