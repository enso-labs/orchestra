# Per-Run Cost & Duration Tracking

## Summary

Per-turn metrics (model, tokens, cost, duration, phase), aggregate metrics per thread/phase, provider pricing tables (configurable), real-time cost display in frontend, budget cap per thread/assistant with pause-on-exceed, historical cost data for analytics.

## Motivation

Users and operators need visibility into the cost of every AI interaction. Without cost tracking, teams cannot forecast budgets, identify expensive workflows, or enforce spending limits. This feature adds full-stack cost observability -- from token-level capture to real-time UI display -- plus budget enforcement that integrates with the existing HITL (human-in-the-loop) interrupt system.

## Key Components

### Backend

#### Schemas (`backend/src/schemas/entities/metrics.py`)

- **TurnMetrics** -- Per-turn record capturing:
  - `turn_id`, `thread_id`, `assistant_id`, `user_id`
  - `model` (string, e.g. `gpt-4o`, `claude-sonnet-4-20250514`)
  - `input_tokens`, `output_tokens`, `total_tokens`
  - `input_cost`, `output_cost`, `total_cost` (Decimal, USD)
  - `duration_ms` (int, wall-clock time of LLM call)
  - `phase` (enum: `planning`, `execution`, `reflection`, `tool_call`)
  - `created_at` timestamp

- **ThreadCostSummary** -- Aggregate view:
  - `thread_id`
  - `total_cost`, `total_tokens`, `total_duration_ms`
  - `turn_count`
  - Per-phase breakdown (dict keyed by phase enum)
  - Per-model breakdown (dict keyed by model string)

- **RunBudget** -- Budget configuration:
  - `thread_id` or `assistant_id` (nullable, at least one required)
  - `max_cost_usd` (Decimal)
  - `max_tokens` (int, optional)
  - `action_on_exceed` (enum: `pause`, `warn`, `stop`)
  - `is_active` (bool)

#### Pricing Tables (`backend/src/constants/pricing.py`)

- Dictionary of model -> `{ input_per_1k, output_per_1k, currency }` pricing.
- Covers OpenAI, Anthropic, Google, and open-source model families.
- Admin-configurable via API (CRUD endpoints) with DB-backed overrides.
- Fallback to hardcoded defaults when no DB override exists.

#### Metrics Capture Middleware (`backend/src/utils/metrics.py`)

- Wraps LLM invocations to capture:
  - Token counts from response metadata (`usage` field)
  - Wall-clock duration via `time.perf_counter()`
  - Model identifier from the request config
- Computes cost = tokens * pricing rate
- Persists `TurnMetrics` record asynchronously (fire-and-forget DB write)
- Emits metrics event for real-time streaming to frontend

#### Budget Enforcement

- Before each LLM call, check cumulative thread cost against `RunBudget`.
- If `max_cost_usd` exceeded:
  - `pause` -- Trigger HITL interrupt, let user approve continuation.
  - `warn` -- Log warning and continue, send UI notification.
  - `stop` -- Halt execution, return budget-exceeded error.
- Budget checks are lightweight (cached running total, refreshed on each turn).

#### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v0/threads/{id}/metrics` | Thread cost summary |
| GET | `/v0/threads/{id}/metrics/turns` | Per-turn breakdown |
| GET | `/v0/pricing` | List all pricing entries |
| POST | `/v0/pricing` | Create/update pricing entry |
| DELETE | `/v0/pricing/{model}` | Delete pricing override |
| GET | `/v0/budgets` | List budgets for user |
| POST | `/v0/budgets` | Create/update budget |
| DELETE | `/v0/budgets/{id}` | Delete budget |

### Frontend

- **Running cost badge** -- Small pill in the chat header showing cumulative thread cost (e.g. `$0.12`), updated in real-time via SSE/streaming events.
- **Cost breakdown panel** -- Expandable side panel or modal showing per-turn and per-phase cost tables with charts.
- **Budget configuration** -- Settings UI to set `max_cost_usd` per thread or per assistant, choose action-on-exceed behavior.
- **Warning indicators** -- Yellow/red badge color when approaching/exceeding budget thresholds (75%/100%).

### Database Migration

- New `turn_metrics` table (Alembic migration):
  - Columns matching `TurnMetrics` schema
  - Indexes on `thread_id`, `created_at`, `model`
  - Foreign key to threads table
- New `run_budgets` table:
  - Columns matching `RunBudget` schema
  - Unique constraint on (`thread_id`, `assistant_id`)
- Optional `pricing_overrides` table for admin-managed pricing.

### Testing

- **Unit tests**: Pricing calculation, budget threshold logic, metrics aggregation.
- **Integration tests**: End-to-end LLM call with metrics capture, budget enforcement with HITL interrupt, API endpoint responses.
- **Frontend tests**: Cost badge rendering, budget config form validation.

## Non-Goals (v1)

- Multi-currency support (USD only for now)
- Organization-level billing aggregation
- Automated payment/invoicing integration
- Cost prediction/forecasting ML models
