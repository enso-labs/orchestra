# Spec 005: APScheduler → TaskIQ Scheduler Migration

## User Story

As a developer, I want a unified scheduling stack so we don't maintain two separate systems (APScheduler for timing + TaskIQ for execution) — reducing operational complexity and dependency surface.

## Purpose

Migration plan to move all existing cron schedules from APScheduler to TaskIQ Scheduler. This is a **future spec** to be implemented after the heartbeat system (Specs 002-003) is stable and proven in production.

## Problem Statement

After Spec 002 introduces TaskIQ Scheduler for heartbeat, Orchestra will have:

| System | Used For | Persistence | Process |
|--------|----------|-------------|---------|
| **APScheduler 3.x** | Cron timing for scheduled LLM invocations | PostgreSQL (SQLAlchemy jobstore) | In-process (FastAPI) |
| **TaskIQ Scheduler** | Heartbeat intervals | Redis (`ListRedisScheduleSource`) | Separate process (`taskiq scheduler`) |
| **TaskIQ Broker** | Task execution | Redis Streams | Separate process (`taskiq worker`) |

Two scheduling systems means:
- Two sets of CRUD APIs to maintain
- Two persistence layers (PostgreSQL + Redis)
- Two process models (in-process + separate)
- Pickling constraints (APScheduler requires module-level functions)
- APScheduler 3.x is in maintenance mode — no new features

## Migration Strategy

### Phase 1: Dual-Mode (Current after Spec 002)

No changes needed. APScheduler handles existing cron schedules, TaskIQ Scheduler handles heartbeat. Both coexist.

### Phase 2: TaskIQ Cron Support

Migrate `ScheduleService` to use TaskIQ's `schedule_by_cron()` for new schedules while maintaining read access to existing APScheduler jobs.

#### Key Changes

**Modify: `backend/src/services/schedule.py`**

Replace APScheduler calls with TaskIQ Scheduler equivalents:

```python
# BEFORE (APScheduler):
def create_job(self, job: Job) -> Schedule:
    self.scheduler.add_job(
        scheduled_llm_invoke,
        trigger=CronTrigger.from_crontab(job.trigger.expression),
        args=job.args,
        kwargs=job.kwargs,
        id=job.id,
        misfire_grace_time=300,
    )

# AFTER (TaskIQ Scheduler):
async def create_job(self, job: Job) -> Schedule:
    from src.workers.tasks import run_scheduled_invoke
    from src.workers.scheduler import redis_source

    schedule = await run_scheduled_invoke.schedule_by_cron(
        redis_source,
        cron=job.trigger.expression,
        task_dict=job.args[0],
        user_id=job.kwargs["user_id"],
        title=job.kwargs["title"],
    )

    # Store schedule metadata in LangGraph store for retrieval
    await self._save_schedule_metadata(schedule.schedule_id, job)
    return Schedule(...)
```

**New file: `backend/src/workers/tasks.py` (addition)**

```python
@broker.task(task_name="run_scheduled_invoke")
async def run_scheduled_invoke(
    task_dict: dict,
    user_id: str,
    title: str,
) -> dict:
    """Execute a scheduled LLM invocation via TaskIQ."""
    from src.services.schedule import scheduled_llm_invoke
    result = await scheduled_llm_invoke(task_dict, user_id=user_id, title=title)
    return {"status": "complete", "result": result}
```

**Modify: `backend/src/repos/schedule_repo.py` (new)**

Move schedule metadata from APScheduler jobstore to LangGraph store:

```python
class ScheduleRepo(BaseRepo):
    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="schedules")

    async def save(self, schedule_id: str, metadata: dict) -> bool:
        return await self._set(schedule_id, metadata)

    async def get(self, schedule_id: str) -> dict | None:
        item = await self._get(schedule_id)
        return item.value if item else None

    async def list(self) -> list[dict]:
        items = await self._search({"user_id": self.user_id})
        return [item.value for item in items]

    async def delete(self, schedule_id: str) -> bool:
        return await self._delete(schedule_id)
```

### Phase 3: Data Migration

Script to migrate existing APScheduler jobs to TaskIQ:

**New file: `backend/scripts/migrate_schedules.py`**

```python
"""
Migrate APScheduler jobs to TaskIQ Scheduler.

Usage:
    python -m scripts.migrate_schedules [--dry-run]
"""
import asyncio
import argparse
from src.services.schedule import ScheduleService, SCHEDULER
from src.workers.scheduler import redis_source
from src.workers.tasks import run_scheduled_invoke


async def migrate(dry_run: bool = True):
    """Read all APScheduler jobs and recreate them as TaskIQ schedules."""
    jobs = SCHEDULER.get_jobs()
    print(f"Found {len(jobs)} APScheduler jobs")

    for job in jobs:
        cron = str(job.trigger)
        args = job.args
        kwargs = job.kwargs
        user_id = kwargs.get("user_id")
        title = kwargs.get("title", "Migrated schedule")

        print(f"  Job {job.id}: cron={cron}, user={user_id}, title={title}")

        if not dry_run:
            # Create TaskIQ schedule
            schedule = await run_scheduled_invoke.schedule_by_cron(
                redis_source,
                cron=cron,
                task_dict=args[0] if args else {},
                user_id=user_id,
                title=title,
            )
            print(f"    -> Created TaskIQ schedule: {schedule.schedule_id}")

            # Remove APScheduler job
            job.remove()
            print(f"    -> Removed APScheduler job: {job.id}")

    if dry_run:
        print("\nDry run complete. Run with --no-dry-run to execute migration.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--no-dry-run", dest="dry_run", action="store_false")
    args = parser.parse_args()
    asyncio.run(migrate(dry_run=args.dry_run))
```

### Phase 4: Cleanup

After migration is verified:

1. **Remove APScheduler dependency** from `backend/pyproject.toml`:
   ```
   - "apscheduler>=3.11.0",
   ```

2. **Remove APScheduler code** from `backend/src/services/schedule.py`:
   - Delete global `SCHEDULER` setup
   - Delete `init_scheduler()` function
   - Delete SQLAlchemy jobstore configuration

3. **Update `docker-compose.dev.yml`**:
   - Ensure `scheduler` service handles both cron + heartbeat schedules
   - Remove any APScheduler-specific configuration

4. **Update route handlers** to use async service methods (since TaskIQ operations are async)

## API Compatibility

The REST API (`/api/schedules`) should remain unchanged. Internal implementation switches from APScheduler to TaskIQ, but the external contract is preserved:

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /api/schedules` | `scheduler.add_job()` | `task.schedule_by_cron(redis_source)` |
| `GET /api/schedules` | `scheduler.get_jobs()` | `ScheduleRepo.list()` |
| `GET /api/schedules/:id` | `scheduler.get_job()` | `ScheduleRepo.get()` |
| `PUT /api/schedules/:id` | `scheduler.modify_job()` | `unschedule() + schedule_by_cron()` |
| `DELETE /api/schedules/:id` | `scheduler.remove_job()` | `CreatedSchedule.unschedule()` |

## Rollback Plan

If migration encounters issues:

1. **Dual-read**: Keep APScheduler jobstore (PostgreSQL) as read-only fallback
2. **Feature flag**: `USE_TASKIQ_SCHEDULER=true|false` environment variable
3. **Reverse migration**: Script to recreate APScheduler jobs from Redis schedule data
4. **No data loss**: PostgreSQL jobstore data preserved until explicit cleanup

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TaskIQ Scheduler less battle-tested | Medium | High | Keep APScheduler as fallback during transition |
| Redis data loss (no persistence) | Low | Medium | Enable Redis AOF persistence, backup before migration |
| Cron expression compatibility | Low | Low | TaskIQ uses standard cron syntax (same as APScheduler) |
| Async migration complexity | Medium | Medium | Phase migration, dual-mode period |
| Worker process dependency | Low | Medium | Scheduler process monitored via Docker healthcheck |

## Timeline

| Phase | When | Duration | Dependencies |
|-------|------|----------|-------------|
| Phase 1 (Dual-mode) | After Spec 002 | 0 effort | Spec 002 complete |
| Phase 2 (TaskIQ cron) | After heartbeat stable (~2 weeks) | 3-5 days | Phase 1 validated |
| Phase 3 (Data migration) | After Phase 2 tested | 1-2 days | Phase 2 complete |
| Phase 4 (Cleanup) | After Phase 3 verified | 1 day | Phase 3 successful |

## Acceptance Criteria

1. All existing cron schedules work identically after migration
2. No user-facing API changes
3. Frontend Schedules page functions without modification
4. Migration script handles all existing job types
5. Rollback to APScheduler possible within 1 hour
6. APScheduler removed from dependencies after successful migration
7. Single `taskiq scheduler` process handles both cron + heartbeat
8. Redis persistence configured for schedule data durability

## Test Plan

### Migration Tests

```python
class TestScheduleMigration:
    @pytest.mark.asyncio
    async def test_migrate_cron_job(self):
        """APScheduler cron job migrates to TaskIQ schedule."""

    @pytest.mark.asyncio
    async def test_migrated_job_executes(self):
        """Migrated schedule fires and invokes agent correctly."""

    @pytest.mark.asyncio
    async def test_dry_run_no_side_effects(self):
        """Dry run reads but doesn't modify anything."""

    @pytest.mark.asyncio
    async def test_rollback(self):
        """Reverse migration recreates APScheduler jobs."""


class TestTaskIQScheduleService:
    @pytest.mark.asyncio
    async def test_create_job(self):
        """create_job uses TaskIQ schedule_by_cron."""

    @pytest.mark.asyncio
    async def test_get_jobs(self):
        """get_jobs reads from LangGraph store."""

    @pytest.mark.asyncio
    async def test_delete_job(self):
        """delete_job calls unschedule on TaskIQ."""

    @pytest.mark.asyncio
    async def test_update_job(self):
        """update_job unschedules + re-schedules."""
```

### Integration Tests

```bash
# Start stack
make dev.docker.up

# Create schedule via old API
curl -X POST http://localhost:8000/api/schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","trigger":{"type":"cron","expression":"0 * * * *"},"task":{...}}'

# Run migration (dry run)
docker exec orchestra-backend python -m scripts.migrate_schedules --dry-run

# Run migration (real)
docker exec orchestra-backend python -m scripts.migrate_schedules --no-dry-run

# Verify schedule still appears
curl http://localhost:8000/api/schedules -H "Authorization: Bearer $TOKEN" | jq .

# Verify schedule fires (wait for next cron tick or adjust time)
docker logs orchestra-worker --follow
```
