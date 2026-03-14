# Spec 006: Schedule Execution History + Run Now

## Problem

Orchestra's scheduling system (APScheduler + TaskIQ) fires cron jobs but provides no visibility into execution results. The frontend already defines `ScheduleExecution` types and calls `getScheduleExecutions()`, `getRecentExecutions()`, and `getExecutionsByDateRange()` — but the backend endpoints don't exist. Users have no way to verify jobs ran, diagnose failures, or manually trigger a job for testing.

## Changes

### 1. Pydantic entity

**File:** `backend/src/schemas/entities/schedule_execution.py`

```python
class ScheduleExecution(BaseModel):
    id: str
    schedule_id: str
    thread_id: Optional[str] = None
    status: str = "scheduled"  # scheduled | running | success | failure | skipped
    scheduled_time: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
```

Fields match the frontend `ScheduleExecution` interface exactly.

### 2. Repository (LangGraph Store pattern)

**File:** `backend/src/repos/schedule_execution_repo.py`

Following the `MemoryRepo`/`ThreadRepo` BaseRepo pattern with namespace `(user_id, "schedule_executions")`:

- `create(schedule_id, scheduled_time, **kwargs) -> ScheduleExecution`
- `update_status(execution_id, status, **kwargs) -> ScheduleExecution | None`
- `get_by_schedule(schedule_id, limit=50) -> list[ScheduleExecution]`
- `get_recent(limit=20) -> list[ScheduleExecution]`
- `get_by_date_range(start_date, end_date) -> list[ScheduleExecution]`

No Alembic migration required — data is stored in the LangGraph Postgres Store.

### 4. Record executions in `scheduled_llm_invoke`

**File:** `backend/src/services/schedule.py`

Wrap the existing dispatch logic:

```python
async def scheduled_llm_invoke(...):
    # Create execution record: status='running', started_at=now
    execution = await repo.create(schedule_id, user_id, scheduled_time=now)
    await repo.update_status(execution.id, "running", started_at=now)
    try:
        # Existing dispatch logic (TaskIQ or in-process)
        ...
        await repo.update_status(execution.id, "success",
            completed_at=now, duration_ms=elapsed, thread_id=thread_id)
    except Exception as e:
        await repo.update_status(execution.id, "failure",
            completed_at=now, duration_ms=elapsed, error_message=str(e))
        raise
```

### 5. API endpoints

**File:** `backend/src/routes/v0/schedule.py`

Add three new GET endpoints and one POST:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/schedules/{schedule_id}/executions?limit=50` | Per-schedule history |
| `GET` | `/schedules/executions/recent?limit=20` | Cross-schedule recent |
| `GET` | `/schedules/executions?start_date=X&end_date=Y` | Date range query |
| `POST` | `/schedules/{job_id}/run` | Immediate manual trigger |

**Run Now** verifies job ownership, creates execution record, dispatches via TaskIQ, returns `{ execution_id, thread_id }`.

**Important:** Route ordering matters — `/schedules/executions/recent` and `/schedules/executions` must be registered BEFORE `/schedules/{schedule_id}` to avoid path parameter capture.

### 6. Pydantic response schemas

**File:** `backend/src/schemas/entities/schedule.py`

```python
class ScheduleExecutionResponse(BaseModel):
    id: str
    schedule_id: str
    thread_id: str | None
    status: str
    scheduled_time: datetime
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    error_message: str | None
    metadata: dict = {}

class RunNowResponse(BaseModel):
    execution_id: str
    thread_id: str
```

## Files Modified

- `backend/src/schemas/entities/schedule_execution.py` (new)
- `backend/src/repos/schedule_execution_repo.py` (new)
- `backend/src/repos/base_repo.py` (modified — add schedule_executions to _format)
- `backend/src/services/schedule.py` (modified)
- `backend/src/routes/v0/schedule.py` (modified)
- `backend/src/schemas/entities/schedule.py` (modified)

## Verification

```bash
# Create a schedule, wait for execution, check history
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v0/schedules/$SCHEDULE_ID/executions

# Recent executions across all schedules
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v0/schedules/executions/recent

# Run now
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v0/schedules/$JOB_ID/run

# Run tests
make test
```
