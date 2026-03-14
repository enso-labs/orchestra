# Spec 006: Schedule Execution History + Run Now

## Problem

Orchestra's scheduling system (APScheduler + TaskIQ) fires cron jobs but provides no visibility into execution results. The frontend already defines `ScheduleExecution` types and calls `getScheduleExecutions()`, `getRecentExecutions()`, and `getExecutionsByDateRange()` — but the backend endpoints don't exist. Users have no way to verify jobs ran, diagnose failures, or manually trigger a job for testing.

## Changes

### 1. Alembic migration: `schedule_executions` table

**File:** `backend/migrations/versions/0002_add_schedule_executions.py`

```sql
CREATE TABLE schedule_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     VARCHAR NOT NULL,
    user_id         VARCHAR NOT NULL,
    thread_id       VARCHAR,
    status          VARCHAR NOT NULL DEFAULT 'scheduled',
    scheduled_time  TIMESTAMPTZ NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_schedule_executions_schedule_id ON schedule_executions (schedule_id);
CREATE INDEX ix_schedule_executions_user_id ON schedule_executions (user_id);
CREATE INDEX ix_schedule_executions_status ON schedule_executions (status);
CREATE INDEX ix_schedule_executions_created_at ON schedule_executions (created_at DESC);
```

Columns match the frontend `ScheduleExecution` interface exactly.

### 2. SQLAlchemy model

**File:** `backend/src/schemas/models/schedule_execution.py`

```python
class ScheduleExecution(Base):
    __tablename__ = "schedule_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    thread_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="scheduled")
    scheduled_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

### 3. Repository

**File:** `backend/src/repos/schedule_execution_repo.py`

Following the `UserRepo` SQL pattern (not BaseRepo/Store pattern):

- `create(schedule_id, user_id, scheduled_time, **kwargs) -> ScheduleExecution`
- `update_status(execution_id, status, **kwargs) -> ScheduleExecution | None`
- `get_by_schedule(schedule_id, user_id, limit=50) -> list[ScheduleExecution]`
- `get_recent(user_id, limit=20) -> list[ScheduleExecution]`
- `get_by_date_range(user_id, start_date, end_date) -> list[ScheduleExecution]`

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

- `backend/migrations/versions/0002_add_schedule_executions.py` (new)
- `backend/src/schemas/models/schedule_execution.py` (new)
- `backend/src/repos/schedule_execution_repo.py` (new)
- `backend/src/services/schedule.py` (modified)
- `backend/src/routes/v0/schedule.py` (modified)
- `backend/src/schemas/entities/schedule.py` (modified)

## Verification

```bash
# Run migration
alembic upgrade head

# Verify table exists
psql -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedule_executions';"

# Create a schedule, wait for execution, check history
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v0/schedules/$SCHEDULE_ID/executions

# Run now
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v0/schedules/$JOB_ID/run

# Run tests
make test
```
