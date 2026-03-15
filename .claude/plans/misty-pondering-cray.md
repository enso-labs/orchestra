# Plan: Align Orchestra Schedules with OpenClaw Cron + Heartbeat Architecture

## Context

Orchestra has a basic scheduling system (APScheduler + TaskIQ) that supports cron-triggered agent invocations. OpenClaw has a mature two-tier architecture: **Heartbeat** (periodic batched checks in the main session) and **Cron** (precise standalone jobs with delivery/retry). The frontend already has types and service methods for execution history (`ScheduleExecution`, `getScheduleExecutions`, `getRecentExecutions`) but the backend endpoints don't exist yet. The goal is to close the gaps that matter most for Orchestra's multi-tenant SaaS context.

## Gap Analysis: Orchestra vs OpenClaw

| Feature | OpenClaw | Orchestra | Gap |
|---------|----------|-----------|-----|
| Cron scheduling | 5/6-field + timezone | 5/6-field, no timezone | Minor |
| One-shot "at" schedules | DateTrigger (ISO 8601) | Not supported | Missing |
| Execution history | Per-job JSONL run logs | None | **Critical** |
| Run now (manual trigger) | `cron run <jobId>` | Not supported | Missing |
| Heartbeat polling | 30min interval, HEARTBEAT.md, HEARTBEAT_OK suppression, active hours | Concept in memory files, no execution | **Critical** |
| Retry policy | Exponential backoff, transient vs permanent classification | None | Missing |
| Delivery (channels/webhook) | Slack, Discord, Telegram, webhook | None | Future |
| Session targeting | Main / isolated / custom | Always new thread | Minor |
| Concurrency control | maxConcurrentRuns | None | Minor |
| HEARTBEAT.md template | Seeded, agent-editable | Referenced but not seeded | Easy fix |

## Phased Implementation

### Phase 1: Execution History + Run Now (Foundation)

Everything else depends on being able to track and query execution results.

#### 1A. Schedule Execution DB Table

Create Alembic migration for `schedule_executions`:

```
id: UUID PK
schedule_id: VARCHAR (APScheduler job ID)
user_id: VARCHAR (indexed)
thread_id: VARCHAR (nullable)
status: VARCHAR ('scheduled'|'running'|'success'|'failure'|'skipped')
scheduled_time: TIMESTAMP WITH TZ
started_at: TIMESTAMP WITH TZ (nullable)
completed_at: TIMESTAMP WITH TZ (nullable)
duration_ms: INTEGER (nullable)
error_message: TEXT (nullable)
metadata: JSONB
created_at: TIMESTAMP WITH TZ (default now)
```

**Files:**
- New: `backend/migrations/versions/XXXX_add_schedule_executions.py`
- New: `backend/src/schemas/models/schedule_execution.py` (SQLAlchemy model)
- New: `backend/src/repos/schedule_execution_repo.py` (CRUD repository)

#### 1B. Record Executions in `scheduled_llm_invoke`

Modify `backend/src/services/schedule.py`:
- Create execution record with `status=running` before dispatch
- On success, update to `status=success` with `completed_at` and `duration_ms`
- On failure, update to `status=failure` with `error_message`

#### 1C. Execution History API Endpoints

The frontend already calls these URLs -- we just need the backend:

- `GET /schedules/{schedule_id}/executions?limit=N` - per-schedule history
- `GET /schedules/executions/recent?limit=N` - cross-schedule recent runs
- `GET /schedules/executions?start_date=X&end_date=Y` - date range query

**File:** `backend/src/routes/v0/schedule.py`

#### 1D. Run Now Endpoint

- `POST /schedules/{job_id}/run` - immediate execution
- Verify ownership, create execution record, dispatch via TaskIQ
- Return execution ID + thread_id for client tracking

**Files:**
- `backend/src/routes/v0/schedule.py` - new endpoint
- `backend/src/services/schedule.py` - `run_job_now()` method

---

### Phase 2: Heartbeat System

The highest-value missing feature. All infrastructure exists (memory files, agent execution, TaskIQ). The gap is the polling/dispatch mechanism.

#### 2A. Heartbeat Configuration Schema

Add to assistant/agent entity:

```python
class HeartbeatConfig(BaseModel):
    enabled: bool = False
    every: str = "30m"  # "15m"|"30m"|"1h"|"2h"|"4h"
    active_hours_start: str | None = None  # "08:00"
    active_hours_end: str | None = None    # "22:00"
    timezone: str = "UTC"
```

**Files:**
- `backend/src/schemas/entities/assistant.py` - add HeartbeatConfig
- `backend/src/services/assistant.py` - on create/update, sync APScheduler interval job

#### 2B. Heartbeat Execution Service

New: `backend/src/services/heartbeat.py`

- `heartbeat_invoke(user_id, assistant_id)` function registered with APScheduler
- Check active hours (timezone-aware), skip if outside window
- Read user's `HEARTBEAT.md` via MemoryService
- If empty, log skip and return (save tokens)
- Construct LLMRequest with heartbeat prompt: "Review HEARTBEAT.md. If nothing needs attention, respond HEARTBEAT_OK."
- Dispatch via `run_agent_stream.kiq()`
- Create schedule_execution record (status=skipped if HEARTBEAT_OK)

#### 2C. Seed HEARTBEAT.md

Add actual `HEARTBEAT.md` entry to `DEFAULT_MEMORIES` in `backend/src/constants/default_memories.py`:

```markdown
# HEARTBEAT.md - Proactive Task Checklist
# Keep empty to skip heartbeat checks and save tokens.
# Add periodic tasks below:
```

#### 2D. Frontend Heartbeat Config

Add heartbeat toggle + settings to agent detail page:
- Enable/disable toggle
- Interval picker
- Active hours range
- Timezone selector

---

### Phase 3: Enhanced Cron (Incremental)

#### 3A. Timezone Support

APScheduler already supports this natively:
- Add `timezone: str = "UTC"` to `JobTrigger` schema
- Pass to `CronTrigger.from_crontab(expr, timezone=tz)`

**Files:** `backend/src/schemas/entities/schedule.py`, `backend/src/services/schedule.py`

#### 3B. One-Shot "At" Schedule Type

- Add `type: "at"` with `run_at: str` (ISO 8601) to `JobTrigger`
- Use APScheduler's `DateTrigger(run_date=dt)`
- Auto-delete after execution

**Files:** same as 3A + frontend schedule form

#### 3C. Retry Policy

Add retry logic to `scheduled_llm_invoke`:
- Classify errors: transient (network, timeout, 429, 5xx) vs permanent (auth, config)
- Transient: schedule one-shot retry with exponential backoff (30s, 1m, 5m), max 3 retries
- Permanent: mark job as failed, optionally disable
- Track retry count in execution metadata

#### 3D. Concurrency Control

Before dispatching, query `schedule_executions` for running count per schedule_id. Skip if at limit.

---

### Phase 4: Delivery + Notifications (Future/Out of Scope)

- Webhook delivery (POST results to user-configured URLs)
- Channel delivery (email, in-app notifications)
- Session targeting (new thread vs existing thread)

Not recommended for initial implementation -- requires significant new infrastructure.

---

## Architecture Decisions

1. **Heartbeats use APScheduler interval jobs** -- same reliability as cron, no custom polling loop
2. **Both heartbeat and cron dispatch through TaskIQ** -- single execution path, same worker
3. **Execution history in PostgreSQL** -- durable, queryable, user-scoped (not Redis)
4. **Heartbeat config lives on the assistant entity** -- per-agent in multi-tenant context

## Critical Files

| File | Role |
|------|------|
| `backend/src/services/schedule.py` | Core scheduling, execution tracking |
| `backend/src/routes/v0/schedule.py` | API endpoints |
| `backend/src/schemas/entities/schedule.py` | Schedule/trigger schemas |
| `backend/src/workers/tasks.py` | TaskIQ worker task |
| `backend/src/constants/default_memories.py` | HEARTBEAT.md seed |
| `frontend/src/lib/entities/schedule.ts` | Already has ScheduleExecution types |
| `frontend/src/lib/services/scheduleService.ts` | Already calls execution history endpoints |

## Verification

- **Phase 1**: Create a schedule, verify execution appears in `schedule_executions` table. Hit `GET /schedules/{id}/executions` and confirm data. Use "Run Now" and verify immediate dispatch.
- **Phase 2**: Enable heartbeat on an agent with a populated HEARTBEAT.md. Wait for interval. Verify execution record created. Empty HEARTBEAT.md and verify skip. Test active hours boundary.
- **Phase 3**: Create schedule with timezone, verify next_run_time is correct. Create one-shot schedule, verify it fires and auto-deletes. Simulate transient error and verify retry.
