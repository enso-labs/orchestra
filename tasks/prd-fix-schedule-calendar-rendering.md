# PRD: Fix Schedule Calendar Not Rendering — Missing Backend Execution Endpoints

## Introduction

The Schedules page calendar view (shipped in PR #722/feat-722-frontend-schedule-refactor) shows "Total: 2" but renders zero events on the calendar. The root cause is that the frontend calls three execution API endpoints (`/api/schedules/executions/recent`, `/api/schedules/{id}/executions`, `/api/schedules/executions?start=&end=`) that **do not exist** in the backend. FastAPI's SPA catch-all serves `index.html` (HTML) instead of JSON for these unrecognized routes, so the frontend silently fails to parse the response and renders an empty calendar.

This is a **critical, blocking bug** — the entire calendar feature is non-functional.

## Root Cause Analysis

1. **Backend routes missing**: `backend/src/routes/v0/schedule.py` only has CRUD routes for schedules (`GET /schedules`, `GET /schedules/{job_id}`, `POST`, `PUT`, `DELETE`). No execution endpoints exist.
2. **No execution data model**: There is no `schedule_execution` database table or model. Schedules use APScheduler's `SQLAlchemyJobStore` (table `schedules`), and task dispatch goes through TaskIQ workers that stream to Redis — but execution history is never persisted.
3. **SPA fallback masks the 404**: The backend serves `index.html` for any unrecognized route, so `/api/schedules/executions/recent` returns `200 OK` with `content-type: text/html` instead of a `404`. The frontend receives HTML, fails to parse it as JSON, and silently shows an empty calendar.

### Evidence (curl)

```
$ curl -s -D- http://localhost:8000/api/schedules/executions/recent | head -3
HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
<!doctype html>...
```

## Goals

- Implement backend execution tracking so schedule runs are recorded in the database
- Add the three missing API endpoints that the frontend already calls
- Ensure the calendar renders execution events correctly
- Maintain backward compatibility with existing schedule CRUD operations

## User Stories

### US-001: Create ScheduleExecution database model and migration
**Description:** As a developer, I need a database table to persist schedule execution records so the API can serve execution history.

**Acceptance Criteria:**
- [ ] Create `schedule_executions` table with columns matching the frontend `ScheduleExecution` interface:
  - `id` (UUID, primary key)
  - `schedule_id` (string, foreign key reference to APScheduler job ID)
  - `thread_id` (string, nullable — links to the thread created by the execution)
  - `status` (enum: `scheduled`, `running`, `success`, `failure`)
  - `scheduled_time` (datetime, not null)
  - `started_at` (datetime, nullable)
  - `completed_at` (datetime, nullable)
  - `error_message` (text, nullable)
  - `metadata` (JSONB, default `{}`)
- [ ] Create Pydantic schema `ScheduleExecutionResponse` matching the above
- [ ] Migration runs without errors
- [ ] Typecheck passes

### US-002: Record execution lifecycle in scheduled_llm_invoke
**Description:** As a system, I need to track each schedule execution from dispatch through completion so users can see run history.

**Acceptance Criteria:**
- [ ] When `scheduled_llm_invoke` fires, insert a `schedule_executions` row with status `running`, `scheduled_time` = the trigger time, `started_at` = now
- [ ] On successful completion, update status to `success`, set `completed_at`, store `thread_id`
- [ ] On failure/exception, update status to `failure`, set `completed_at`, store `error_message`
- [ ] When using distributed mode (TaskIQ), the same lifecycle tracking applies
- [ ] Existing schedule functionality is not broken

### US-003: Add GET /schedules/executions/recent endpoint
**Description:** As a frontend consumer, I need an endpoint to fetch recent executions across all schedules so the calendar and sidebar can display them.

**Acceptance Criteria:**
- [ ] `GET /api/schedules/executions/recent?limit=20` returns JSON array of `ScheduleExecutionResponse`
- [ ] Results ordered by `scheduled_time` descending
- [ ] Respects `limit` query parameter (default 20)
- [ ] Scoped to the authenticated user's schedules only
- [ ] Returns `[]` (empty array) when no executions exist — not HTML
- [ ] Returns proper `content-type: application/json` header

### US-004: Add GET /schedules/{schedule_id}/executions endpoint
**Description:** As a frontend consumer, I need to fetch executions for a specific schedule.

**Acceptance Criteria:**
- [ ] `GET /api/schedules/{schedule_id}/executions` returns JSON array of `ScheduleExecutionResponse`
- [ ] Results ordered by `scheduled_time` descending
- [ ] Returns 404 if schedule doesn't exist or doesn't belong to user
- [ ] Returns proper `content-type: application/json` header

### US-005: Add GET /schedules/executions endpoint with date range filtering
**Description:** As a frontend consumer, I need to fetch executions within a date range so the calendar can display events for the visible window.

**Acceptance Criteria:**
- [ ] `GET /api/schedules/executions?start=<ISO>&end=<ISO>` returns executions within the date range
- [ ] Both `start` and `end` are optional (defaults to last 30 days if omitted)
- [ ] Scoped to authenticated user's schedules
- [ ] Returns proper `content-type: application/json` header

### US-006: Generate projected "scheduled" executions from cron expressions
**Description:** As a user, I want to see upcoming scheduled runs on the calendar so I can visualize when my agents will execute next.

**Acceptance Criteria:**
- [ ] The recent/date-range endpoints include projected future executions computed from each schedule's cron expression
- [ ] Projected executions have status `scheduled` and no `started_at`/`completed_at`
- [ ] Projections cover up to 30 days into the future (matching `getCalendarDateRange` in frontend)
- [ ] Projected executions have synthetic IDs (e.g., `{schedule_id}_proj_{iso_time}`) to avoid collision with real execution records

## Functional Requirements

- FR-1: Create `schedule_executions` PostgreSQL table with the schema defined in US-001
- FR-2: Insert execution records in `scheduled_llm_invoke` (both distributed and in-process paths)
- FR-3: Implement `GET /api/schedules/executions/recent` — returns recent executions as JSON
- FR-4: Implement `GET /api/schedules/{schedule_id}/executions` — returns executions for one schedule
- FR-5: Implement `GET /api/schedules/executions` — returns executions filtered by date range
- FR-6: All new endpoints require authentication (`ProtectedUser` dependency)
- FR-7: All new endpoints return `application/json` content type
- FR-8: Compute projected future executions from cron expressions using `croniter` or similar library
- FR-9: Route ordering must ensure `/executions/recent` and `/executions` match before `/{schedule_id}` to avoid path parameter conflicts

## Non-Goals

- No frontend changes — the frontend code from PR #722 is already correct
- No changes to the existing schedule CRUD endpoints
- No real-time execution status streaming (existing Redis stream mechanism is sufficient)
- No execution retry/replay functionality
- No execution log storage (just status tracking)

## Technical Considerations

- **Route ordering matters**: FastAPI matches routes top-to-bottom. `/executions/recent` and `/executions` must be defined BEFORE `/{schedule_id}` to avoid `executions` being captured as a `schedule_id` path parameter.
- **APScheduler job IDs**: Schedules use APScheduler's internal job IDs (not standard UUID). The `schedule_id` column in executions must match this format.
- **Cron projection**: Use `croniter` (already available in Python ecosystem) to compute next N occurrences from a cron expression.
- **Distributed mode**: When `DISTRIBUTED_WORKERS=True`, the TaskIQ worker (`run_agent_stream`) handles execution. Execution tracking needs to work in both distributed and in-process modes.
- **Database**: The app uses PostgreSQL via SQLAlchemy async. New table should follow existing patterns.

## Success Metrics

- Calendar renders execution events for schedules (visual confirmation via agent-browser)
- `curl /api/schedules/executions/recent` returns JSON with `content-type: application/json`
- Sidebar shows recent executions with correct status indicators
- No regression in existing schedule create/update/delete functionality

## Open Questions

- Should execution records be cleaned up after a retention period (e.g., 90 days)?
- Should the projected execution count be configurable or fixed at 30 days?
- Is there an existing `croniter` dependency, or does it need to be added?
