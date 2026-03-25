# Agent Phase Observability & Trace Visualization

## Summary

Structured spans per agent phase (planner, generator, evaluator, handoff) with timing, token counts, model, cost, and error info. Frontend timeline component showing phases as visual blocks with drill-down. OpenTelemetry export for external tools (Jaeger, Honeycomb, Datadog).

## Motivation

Today, when an agent processes a request it passes through multiple internal phases — planning, generation, evaluation, tool calls, handoffs — but there is no structured visibility into what happened, how long each phase took, how many tokens were consumed, or where errors occurred. Operators and developers debugging agent behavior must rely on raw logs. This spec introduces first-class observability spans that capture per-phase telemetry and expose it through both an API and a visual frontend timeline.

## Key Components

### 1. AgentSpan Schema (`backend/src/schemas/entities/trace.py`)

A Pydantic model representing a single phase span:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `uuid` | Unique span identifier |
| `trace_id` | `uuid` | Groups spans belonging to the same thread turn |
| `parent_span_id` | `uuid \| None` | For nested spans (e.g., tool call inside generator) |
| `thread_id` | `str` | Thread this span belongs to |
| `phase` | `enum` | One of: `planner`, `generator`, `evaluator`, `handoff`, `tool_call`, `retrieval` |
| `model` | `str \| None` | LLM model used (if applicable) |
| `started_at` | `datetime` | Phase start timestamp |
| `ended_at` | `datetime \| None` | Phase end timestamp |
| `duration_ms` | `int \| None` | Computed duration in milliseconds |
| `input_tokens` | `int \| None` | Prompt/input token count |
| `output_tokens` | `int \| None` | Completion/output token count |
| `cost_usd` | `float \| None` | Estimated cost in USD |
| `status` | `enum` | `running`, `completed`, `errored` |
| `error` | `str \| None` | Error message if status is errored |
| `metadata` | `dict \| None` | Arbitrary key-value metadata |

### 2. Span Lifecycle Management (`backend/src/utils/tracing.py`)

- `start_span(trace_id, phase, **kwargs) -> AgentSpan` — create and persist a new span
- `end_span(span_id, status, **kwargs)` — finalize timing and token counts
- `@trace_phase(phase)` — decorator / async context manager for automatic span lifecycle
- Thread-local or context-var based trace context propagation

### 3. Storage — PostgreSQL `agent_spans` Table

New Alembic migration adding `agent_spans` table with indexes on `trace_id`, `thread_id`, and `started_at`. Supports efficient retrieval of all spans for a thread turn.

### 4. API Endpoints

- `GET /api/v0/threads/{thread_id}/traces` — list all trace groups for a thread
- `GET /api/v0/threads/{thread_id}/traces/{trace_id}` — get all spans for a specific trace
- `GET /api/v0/traces/{trace_id}/spans/{span_id}` — get a single span with full metadata

### 5. Frontend Timeline Component

- Horizontal swimlane timeline showing phases as colored blocks
- Color coding per phase type (planner = blue, generator = green, evaluator = amber, etc.)
- Hover tooltip with timing, token counts, cost
- Click drill-down to see full span details (metadata, error info, nested spans)
- Responsive layout, dark-mode compatible

### 6. OpenTelemetry OTLP Exporter

- Optional OTLP gRPC/HTTP exporter for shipping spans to Jaeger, Honeycomb, Datadog, etc.
- Configured via environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`)
- Maps `AgentSpan` fields to OTel span attributes
- Disabled by default; zero overhead when off

## Dependencies

- Works standalone; most valuable when planner + evaluator phases are active
- Integrates with existing cost-tracking infrastructure for `cost_usd` field
- No external service dependencies required (OTLP export is optional)

## Labels

`enhancement`, `observability`, `frontend`, `harness-design`

## Milestone

v0.10.0 — Harness Design v2
