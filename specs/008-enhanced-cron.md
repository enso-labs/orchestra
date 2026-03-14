# Spec 008: Enhanced Cron — Timezone, One-Shot, Retry, Concurrency

## Problem

Orchestra's cron scheduling lacks features that OpenClaw provides: timezone-aware scheduling, one-shot "at" triggers, retry on transient failures, and concurrency control. These are incremental improvements to the existing APScheduler infrastructure.

## Dependencies

- Spec 006 (execution history) — retry and concurrency read execution records

## Changes

### 1. Timezone support

**Files:** `backend/src/schemas/entities/schedule.py`, `backend/src/services/schedule.py`

Add `timezone: str = "UTC"` to `JobTrigger`. Pass to APScheduler:

```python
# In ScheduleService.create_job():
trigger = CronTrigger.from_crontab(job_trigger.expression, timezone=job_trigger.timezone)
```

APScheduler natively supports timezone via `pytz` or `zoneinfo`. No additional dependencies needed (Python 3.12+ has `zoneinfo`).

### 2. One-shot "at" schedule type

**Files:** `backend/src/schemas/entities/schedule.py`, `backend/src/services/schedule.py`

Extend `JobTrigger`:

```python
class JobTrigger(BaseModel):
    type: str  # "cron" | "at"
    expression: str | None = None   # cron expression (required if type="cron")
    run_at: str | None = None       # ISO 8601 datetime (required if type="at")
    timezone: str = "UTC"
```

Add validation: `expression` required when `type="cron"`, `run_at` required when `type="at"`.

In `ScheduleService.create_job()`:

```python
if job_trigger.type == "at":
    trigger = DateTrigger(run_date=datetime.fromisoformat(job_trigger.run_at))
else:
    trigger = CronTrigger.from_crontab(job_trigger.expression, timezone=job_trigger.timezone)
```

**Auto-cleanup:** After a one-shot job executes, delete it from APScheduler (APScheduler does this by default for DateTrigger).

### 3. Retry policy

**File:** `backend/src/services/schedule.py`

Add retry logic to `scheduled_llm_invoke`:

```python
TRANSIENT_ERRORS = (ConnectionError, TimeoutError, httpx.HTTPStatusError)  # 429, 5xx
MAX_RETRIES = 3
BACKOFF_SECONDS = [30, 60, 300]  # 30s, 1m, 5m

async def scheduled_llm_invoke(...):
    retry_count = kwargs.get("_retry_count", 0)
    try:
        # ... existing dispatch ...
    except TRANSIENT_ERRORS as e:
        if retry_count < MAX_RETRIES:
            # Schedule one-shot retry with backoff
            retry_at = datetime.now(UTC) + timedelta(seconds=BACKOFF_SECONDS[retry_count])
            scheduler.add_job(scheduled_llm_invoke, DateTrigger(run_date=retry_at),
                args=args, kwargs={**kwargs, "_retry_count": retry_count + 1})
            # Update execution: status='retrying', metadata includes retry_count
        else:
            # Max retries exceeded: status='failure'
    except Exception as e:
        # Permanent error: status='failure' immediately
```

Error classification:
- **Transient**: `ConnectionError`, `TimeoutError`, HTTP 429/5xx
- **Permanent**: `AuthenticationError`, `ValueError`, HTTP 4xx (except 429)

### 4. Concurrency control

**Files:** `backend/src/schemas/entities/schedule.py`, `backend/src/services/schedule.py`

Add `max_concurrent_runs: int = 1` to schedule config.

Before dispatching in `scheduled_llm_invoke`:

```python
running_count = await execution_repo.count_by_status(schedule_id, status="running")
if running_count >= max_concurrent_runs:
    await execution_repo.create(schedule_id, user_id, status="skipped",
        metadata={"reason": "max_concurrent_runs exceeded"})
    return
```

## Files Modified

- `backend/src/schemas/entities/schedule.py` (modified — timezone, at type, max_concurrent_runs)
- `backend/src/services/schedule.py` (modified — timezone, DateTrigger, retry, concurrency)
- Frontend schedule form (modified — timezone picker, at/cron toggle)

## Verification

```bash
# Timezone: Create schedule with timezone="America/Chicago", verify next_run_time offset
# One-shot: Create "at" schedule 1min in future, verify it fires and auto-deletes
# Retry: Mock a transient error, verify retry job scheduled with backoff
# Concurrency: Set max_concurrent_runs=1, trigger while running, verify skip
make test
```
