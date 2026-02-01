# PRD: Schedule Service TaskIQ Worker Dispatch

## Introduction

The schedule service (`src/services/schedule.py`) executes scheduled LLM jobs in-process via APScheduler, while the rest of the system has migrated to TaskIQ workers for agent execution. This creates resource contention on the API server and a divergent code path that misses features like abort support, Redis streaming, and resilient checkpointing. This feature updates `scheduled_llm_invoke()` to dispatch to the existing `run_agent_stream` TaskIQ task when `DISTRIBUTED_WORKERS=true`, while keeping the in-process fallback as a permanent option.

## Goals

- Align scheduled job execution with the TaskIQ worker architecture used by `/llm/stream`
- Offload scheduled agent execution from the API server to dedicated worker processes
- Consolidate the `DISTRIBUTED_WORKERS` constant into `src/constants/__init__.py`
- Simplify the schedule create route by removing unnecessary `LLMController` indirection
- Maintain backward compatibility with in-process execution when `DISTRIBUTED_WORKERS=false`

## User Stories

### US-001: Add DISTRIBUTED_WORKERS constant to src/constants
**Description:** As a developer, I need `DISTRIBUTED_WORKERS` available as a shared constant so multiple modules can reference it without duplicating the env var read.

**Acceptance Criteria:**
- [ ] `DISTRIBUTED_WORKERS` added to `backend/src/constants/__init__.py` as `os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"`
- [ ] `backend/src/routes/v0/llm.py` imports `DISTRIBUTED_WORKERS` from `src.constants` instead of defining it inline
- [ ] Inline definition removed from `llm.py`
- [ ] Existing behavior unchanged
- [ ] Typecheck/lint passes (`make format`)

### US-002: Dispatch scheduled jobs to TaskIQ when distributed mode enabled
**Description:** As an operator, I want scheduled LLM jobs to run on TaskIQ workers when `DISTRIBUTED_WORKERS=true` so that scheduled execution doesn't consume API server resources and benefits from worker features (abort, resilient checkpointing).

**Acceptance Criteria:**
- [ ] `scheduled_llm_invoke()` checks `DISTRIBUTED_WORKERS` at the top of the function
- [ ] When `true`, dispatches to `run_agent_stream.kiq()` with `task_dict`, `user_id`, and a `thread_id` (from metadata or generated UUID)
- [ ] When `false`, existing in-process execution path runs unchanged
- [ ] Dispatch is logged with job title and thread_id
- [ ] Typecheck/lint passes (`make format`)

### US-003: Simplify schedule create route
**Description:** As a developer, I want the create schedule endpoint to call `schedule_service.create_job()` directly instead of going through `LLMController.llm_task()`, which is an unnecessary indirection layer.

**Acceptance Criteria:**
- [ ] `create_job` route in `schedule.py` calls `schedule_service.create_job(job)` directly
- [ ] `LLMController`, `init_config`, `get_store`, and `BaseStore` imports removed from `schedule.py`
- [ ] `store` dependency removed from `create_job` route signature
- [ ] Response format unchanged (201 with `job.id` and `next_run_time`)
- [ ] Typecheck/lint passes (`make format`)

### US-004: Add unit tests for TaskIQ dispatch path
**Description:** As a developer, I need tests verifying that `scheduled_llm_invoke()` correctly dispatches to TaskIQ or runs in-process based on the `DISTRIBUTED_WORKERS` flag.

**Acceptance Criteria:**
- [ ] Test that when `DISTRIBUTED_WORKERS=true`, `run_agent_stream.kiq()` is called with correct args
- [ ] Test that when `DISTRIBUTED_WORKERS=false`, the existing in-process path is invoked
- [ ] Test that thread_id is extracted from task_dict metadata when present
- [ ] Test that thread_id is generated as UUID when not present in metadata
- [ ] All existing tests still pass (`make test`)

## Functional Requirements

- FR-1: `DISTRIBUTED_WORKERS` must be defined once in `src/constants/__init__.py` and imported wherever needed
- FR-2: `scheduled_llm_invoke()` must check `DISTRIBUTED_WORKERS` and dispatch to `run_agent_stream.kiq()` when true
- FR-3: `scheduled_llm_invoke()` must preserve existing in-process execution when `DISTRIBUTED_WORKERS` is false
- FR-4: The `thread_id` for dispatched jobs must come from `task_dict["metadata"]["thread_id"]` if present, otherwise a new UUID
- FR-5: The schedule create route must call `schedule_service.create_job()` directly without `LLMController` indirection
- FR-6: The schedule API contract (request/response formats, status codes) must remain unchanged

## Non-Goals

- No changes to APScheduler job storage or trigger management
- No changes to the `run_agent_stream` TaskIQ task itself
- No changes to schedule schemas or examples
- No frontend changes
- No changes to the in-process execution path logic (just wrapped in an else branch)
- No deprecation of the in-process fallback

## Technical Considerations

- `scheduled_llm_invoke()` is a module-level function (not a method) because APScheduler needs to pickle it. Imports inside the function body must be preserved for this reason.
- The `run_agent_stream` task already handles all agent execution concerns (checkpointing, streaming, abort). No duplication needed.
- APScheduler still manages job scheduling (cron triggers, persistence in PostgreSQL). Only the execution target changes.
- When dispatched to TaskIQ, results stream to Redis (`agent:stream:{thread_id}`) but there's no SSE consumer for scheduled jobs currently. This is acceptable — the job runs and persists results to the thread.

## Success Metrics

- Scheduled jobs execute on TaskIQ workers when `DISTRIBUTED_WORKERS=true`
- API server memory/CPU usage reduced during scheduled job execution (distributed mode)
- Zero regressions in schedule CRUD operations
- All existing tests pass

## Open Questions

- Should we add a dedicated SSE endpoint for monitoring scheduled job execution in real-time? (Deferred — not needed for this change)
- Should scheduled jobs have their own TaskIQ queue separate from interactive requests? (Deferred — can be added later if needed)

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/constants/__init__.py` | Add `DISTRIBUTED_WORKERS` constant |
| `backend/src/routes/v0/llm.py` | Import from `src.constants` instead of inline |
| `backend/src/services/schedule.py` | Add TaskIQ dispatch in `scheduled_llm_invoke()` |
| `backend/src/routes/v0/schedule.py` | Simplify create route, remove LLMController |
| `backend/tests/unit/services/test_schedule_service.py` | Add dispatch path tests |
