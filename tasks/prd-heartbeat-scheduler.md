# PRD: Heartbeat-Inspired Scheduler System

## Introduction

Orchestra has a full APScheduler-based scheduling system (cron triggers, TaskIQ workers, React UI with calendar/table views), but it operates as a separate page — disconnected from the chat experience. Users can't ask an agent to schedule tasks conversationally. Additionally, every scheduled job fires a full LLM invocation regardless of whether anything needs attention, which is wasteful.

This PRD introduces two complementary capabilities:

1. **Schedule Tools** — LangChain tools that let users create, list, and delete schedules from chat conversation.
2. **Heartbeat Engine** — A periodic-awareness system inspired by OpenClaw's HEARTBEAT.md pattern, where agents read a checklist and only escalate when something needs attention. Uses TaskIQ Scheduler with `ListRedisScheduleSource` for dynamic schedule management, with config/state stored in LangGraph store (namespaced keys).

## Goals

- Let users create, list, and delete schedules conversationally from chat via LangChain tools
- Introduce a heartbeat engine where agents periodically check a markdown checklist and only escalate when action is needed (HEARTBEAT_OK suppression)
- Support `activeHours` time-window control to skip heartbeats outside business hours
- Use `isolatedSession` and `lightContext` to reduce token cost from ~100K to ~2-5K per tick
- Provide REST API endpoints for heartbeat CRUD and manual triggering
- Build a full heartbeat dashboard on the Schedules page with toggle, checklist editor, interval selector, active hours config, status card, and activity timeline
- Tag heartbeat-triggered chat messages with source metadata and collapse HEARTBEAT_OK responses
- Plan future migration of existing APScheduler cron schedules to TaskIQ Scheduler (spec only, no implementation)

## User Stories

### US-001: Create schedule from chat
**Description:** As a user, I want to say "schedule a daily weather check at 8am" in chat and have the agent create a cron schedule for me, so I don't need to leave the conversation.

**Acceptance Criteria:**
- [ ] New `create_schedule` tool in `backend/src/tools/schedule.py` using `@tool` + `RunnableConfig` pattern
- [ ] Tool extracts `user_id` from `config["configurable"].get("user_id")`
- [ ] Tool calls `ScheduleService.create_job()` to create the schedule
- [ ] Tool accepts title, cron expression (or natural language like "daily at 8am"), and prompt message
- [ ] Agent responds with confirmation including schedule ID and next run time
- [ ] Created schedule visible on `/schedules` page
- [ ] Typecheck/lint passes (`make format && make lint`)

### US-002: List schedules from chat
**Description:** As a user, I want to ask "what are my schedules?" in chat and see a summary, so I can manage schedules without navigating away.

**Acceptance Criteria:**
- [ ] New `list_schedules` tool in `backend/src/tools/schedule.py`
- [ ] Tool calls `ScheduleService.get_jobs()` filtered by `user_id`
- [ ] Returns formatted list with schedule ID, title, trigger expression, and next run time
- [ ] Returns "No schedules found" when list is empty
- [ ] Typecheck/lint passes

### US-003: Delete schedule from chat
**Description:** As a user, I want to say "delete that schedule" in chat and have the agent remove it, so I can manage schedules conversationally.

**Acceptance Criteria:**
- [ ] New `delete_schedule` tool in `backend/src/tools/schedule.py`
- [ ] Tool accepts schedule ID (or title for fuzzy match)
- [ ] Tool calls `ScheduleService.delete_job()` with ownership validation
- [ ] Agent confirms deletion with schedule title
- [ ] Schedule no longer appears on `/schedules` page
- [ ] Typecheck/lint passes

### US-004: Register schedule tools in default tool library
**Description:** As a developer, I need schedule tools available to all agents by default so users can manage schedules from any conversation.

**Acceptance Criteria:**
- [ ] `SCHEDULE_TOOLS` list exported from `backend/src/tools/schedule.py`
- [ ] `SCHEDULE_TOOLS` added to `default_tools()` in `backend/src/tools/__init__.py`
- [ ] Tools appear in tool library when agent is initialized
- [ ] Typecheck/lint passes

### US-005: Unit tests for schedule tools
**Description:** As a developer, I need tests for the schedule tools to prevent regressions.

**Acceptance Criteria:**
- [ ] New test file `backend/tests/unit/tools/test_schedule_tools.py`
- [ ] Tests for `create_schedule`, `list_schedules`, `delete_schedule`
- [ ] Mock `ScheduleService` methods to isolate tool logic
- [ ] Tests pass with `make test`

### US-006: Heartbeat config and state Pydantic models
**Description:** As a developer, I need data models for heartbeat configuration and runtime state so the system has well-defined schemas.

**Acceptance Criteria:**
- [ ] New file `backend/src/schemas/entities/heartbeat.py`
- [ ] `ActiveHours` model: `start` (str, "HH:MM"), `end` (str, "HH:MM"), `timezone` (str, default "UTC")
- [ ] `HeartbeatConfig` model: `user_id`, `assistant_id`, `enabled` (bool), `checklist` (str, markdown), `every_seconds` (int, default 3600), `active_hours` (Optional[ActiveHours]), `isolated_session` (bool, default True), `light_context` (bool, default True), `ack_max_chars` (int, default 300), `prompt` (Optional[str])
- [ ] `HeartbeatState` model: `last_run_at` (Optional[datetime]), `last_result` (Optional[str]), `consecutive_ok_count` (int, default 0), `next_due_at` (Optional[datetime])
- [ ] `HeartbeatTickResult` model: `action` (Literal["ok", "escalated", "skipped"]), `reason` (str), `response` (Optional[str])
- [ ] Typecheck/lint passes

### US-007: Heartbeat repository with LangGraph store
**Description:** As a developer, I need a data access layer for heartbeat config and state that follows the existing `BaseRepo` pattern with per-user namespace isolation.

**Acceptance Criteria:**
- [ ] New file `backend/src/repos/heartbeat_repo.py`
- [ ] `HeartbeatRepo` extends `BaseRepo` with `entity_type="heartbeat_config"`
- [ ] Methods: `get_config(user_id)`, `set_config(user_id, config)`, `delete_config(user_id)`
- [ ] Separate namespace `(user_id, "heartbeat_state")` for runtime state
- [ ] Methods: `get_state(user_id)`, `set_state(user_id, state)`
- [ ] Typecheck/lint passes

### US-008: Heartbeat service with tick logic
**Description:** As a developer, I need a service that executes heartbeat ticks — checking active hours, reading the checklist, invoking the agent with minimal context, and applying HEARTBEAT_OK suppression.

**Acceptance Criteria:**
- [ ] New file `backend/src/services/heartbeat.py` with `HeartbeatService` class
- [ ] `tick(user_id)` method:
  - Loads config from `HeartbeatRepo`
  - Checks `active_hours` — skips if outside window (returns `HeartbeatTickResult(action="skipped")`)
  - Reads `checklist` markdown from config
  - Invokes agent with `isolated_session=True` (fresh thread) and `light_context=True` (checklist only)
  - Detects `HEARTBEAT_OK` token at start or end of response
  - If remaining content <= `ack_max_chars` (300 chars), suppresses response (returns `action="ok"`)
  - Otherwise returns `action="escalated"` with full response
  - Updates `HeartbeatState` (last_run_at, last_result, consecutive_ok_count, next_due_at)
- [ ] `register(user_id)` — Creates TaskIQ scheduled task via `run_heartbeat_tick.schedule_by_interval()`
- [ ] `unregister(user_id)` — Removes scheduled task via `CreatedSchedule.unschedule()`
- [ ] `get_history(user_id, limit)` — Returns recent tick results from store
- [ ] Typecheck/lint passes

### US-009: TaskIQ heartbeat worker task
**Description:** As a developer, I need a TaskIQ task that the scheduler invokes on each heartbeat interval.

**Acceptance Criteria:**
- [ ] New file `backend/src/workers/heartbeat.py`
- [ ] `run_heartbeat_tick` task decorated with `@broker.task(task_name="run_heartbeat_tick")`
- [ ] Accepts `user_id` parameter
- [ ] Creates `HeartbeatService` with fresh store (following `run_agent_stream` pattern from `backend/src/workers/tasks.py`)
- [ ] Calls `heartbeat_service.tick(user_id)`
- [ ] Logs result and handles errors gracefully
- [ ] Typecheck/lint passes

### US-010: TaskIQ Scheduler setup with ListRedisScheduleSource
**Description:** As a developer, I need a TaskIQ Scheduler process that reads scheduled heartbeat tasks from Redis and dispatches them at the configured intervals.

**Acceptance Criteria:**
- [ ] New file `backend/src/workers/scheduler.py`
- [ ] Configures `TaskiqScheduler` with `ListRedisScheduleSource` from `taskiq-redis`
- [ ] Imports broker from `backend/src/workers/broker.py`
- [ ] Scheduler reads schedule entries from Redis and dispatches tasks to broker
- [ ] Typecheck/lint passes

### US-011: Wire HeartbeatService into ServiceContext
**Description:** As a developer, I need the heartbeat service available through the standard service context so it can be used by routes and tools.

**Acceptance Criteria:**
- [ ] Modify `backend/src/contexts/service.py` to add `self.heartbeat_service = HeartbeatService(user_id=self.user_id, store=store)`
- [ ] Import `HeartbeatService` at top of file
- [ ] Typecheck/lint passes

### US-012: Docker scheduler service
**Description:** As a developer, I need a `scheduler` service in docker-compose.dev.yml that runs the TaskIQ Scheduler process alongside the existing worker.

**Acceptance Criteria:**
- [ ] New `scheduler` service in `docker-compose.dev.yml`
- [ ] Runs `taskiq scheduler backend.src.workers.scheduler:scheduler`
- [ ] Shares same network, env, and volume mounts as `worker` service
- [ ] Depends on `redis` and `backend` services
- [ ] Hot-reloads on code changes (same pattern as worker)
- [ ] `make dev.docker.up` starts the scheduler service

### US-013: Unit tests for heartbeat service
**Description:** As a developer, I need tests for the heartbeat service tick logic, HEARTBEAT_OK detection, and active hours checking.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/services/test_heartbeat_service.py`
- [ ] Test: tick skips when outside active hours
- [ ] Test: tick returns "ok" when agent responds with HEARTBEAT_OK and content <= ack_max_chars
- [ ] Test: tick returns "escalated" when agent responds without HEARTBEAT_OK or content > ack_max_chars
- [ ] Test: consecutive_ok_count increments on ok, resets on escalated
- [ ] Test: register creates TaskIQ schedule, unregister removes it
- [ ] Tests pass with `make test`

### US-014: Heartbeat REST API endpoints
**Description:** As a user or frontend, I need REST endpoints to configure, monitor, and manually trigger heartbeat.

**Acceptance Criteria:**
- [ ] New file `backend/src/routes/v0/heartbeat.py`
- [ ] `GET /api/heartbeat` — Returns current heartbeat config for authenticated user
- [ ] `PUT /api/heartbeat` — Creates or updates heartbeat config + checklist; calls `register()` if enabled
- [ ] `DELETE /api/heartbeat` — Disables and removes heartbeat; calls `unregister()`
- [ ] `GET /api/heartbeat/state` — Returns runtime state (last_run_at, consecutive_ok_count, next_due_at)
- [ ] `POST /api/heartbeat/tick` — Manual trigger for testing; calls `tick()` and returns result
- [ ] `GET /api/heartbeat/history` — Returns recent tick results (default limit 20)
- [ ] All endpoints use `Depends(verify_credentials)` for auth
- [ ] User isolation enforced (users can only access their own config)
- [ ] Typecheck/lint passes

### US-015: Register heartbeat router
**Description:** As a developer, I need the heartbeat router registered in the API so endpoints are accessible.

**Acceptance Criteria:**
- [ ] Modify `backend/src/routes/v0/__init__.py` to import and include heartbeat router
- [ ] Heartbeat endpoints accessible at `/api/heartbeat*`
- [ ] Typecheck/lint passes

### US-016: Heartbeat LangChain tools for chat
**Description:** As a user, I want to configure heartbeat from chat by saying "set up a heartbeat to check my inbox every 2 hours between 9am and 6pm".

**Acceptance Criteria:**
- [ ] New file `backend/src/tools/heartbeat.py`
- [ ] `configure_heartbeat` tool: accepts checklist (str), every_hours (float), active_hours_start (str), active_hours_end (str), timezone (str); creates/updates config and registers schedule
- [ ] `get_heartbeat_status` tool: returns current config + state summary
- [ ] `disable_heartbeat` tool: disables and unregisters
- [ ] All tools use `@tool` + `RunnableConfig` pattern, extract `user_id` from config
- [ ] Typecheck/lint passes

### US-017: Register heartbeat tools in default tool library
**Description:** As a developer, I need heartbeat tools in the default tool library so users can configure heartbeat from any conversation.

**Acceptance Criteria:**
- [ ] `HEARTBEAT_TOOLS` list exported from `backend/src/tools/heartbeat.py`
- [ ] `HEARTBEAT_TOOLS` added to `default_tools()` in `backend/src/tools/__init__.py`
- [ ] Typecheck/lint passes

### US-018: Frontend TypeScript interfaces for heartbeat
**Description:** As a frontend developer, I need TypeScript types for heartbeat config, state, and tick results.

**Acceptance Criteria:**
- [ ] New file `frontend/src/lib/entities/heartbeat.ts`
- [ ] Interfaces: `ActiveHours`, `HeartbeatConfig`, `HeartbeatState`, `HeartbeatTickResult`, `HeartbeatHistory`
- [ ] Types match backend Pydantic models exactly
- [ ] Typecheck passes (`npx tsc --noEmit`)

### US-019: Frontend heartbeat API service
**Description:** As a frontend developer, I need an API service to interact with heartbeat endpoints.

**Acceptance Criteria:**
- [ ] New file `frontend/src/lib/services/heartbeatService.ts`
- [ ] Methods: `getConfig()`, `updateConfig(config)`, `deleteConfig()`, `getState()`, `triggerTick()`, `getHistory(limit?)`
- [ ] Uses existing API client pattern (auth headers, base URL)
- [ ] Typecheck passes

### US-020: Frontend heartbeat React hook
**Description:** As a frontend developer, I need a React hook that manages heartbeat state with auto-refresh for the dashboard.

**Acceptance Criteria:**
- [ ] New file `frontend/src/hooks/useHeartbeat.ts`
- [ ] `useHeartbeat()` hook returns: `config`, `state`, `history`, `isLoading`, `updateConfig()`, `deleteConfig()`, `triggerTick()`, `refetch()`
- [ ] Auto-refreshes state every 60 seconds when heartbeat is enabled
- [ ] Typecheck passes

### US-021: Heartbeat section on Schedules page
**Description:** As a user, I want to see a "Heartbeat" section on the Schedules page where I can enable/disable heartbeat, select an agent, edit the checklist, set the interval, configure active hours, and see status.

**Acceptance Criteria:**
- [ ] Modify `frontend/src/pages/schedules/index.tsx` to add Heartbeat section above existing schedule content
- [ ] Enable/disable toggle with visual state indicator
- [ ] Agent selector dropdown (reuse existing `useAgentContext()`)
- [ ] Checklist editor (markdown textarea)
- [ ] Interval selector dropdown (30m, 1h, 2h, 4h, 8h, 12h, 24h)
- [ ] Active hours config (start time, end time inputs)
- [ ] Status card showing: last run time, next due time, consecutive OK count, last result
- [ ] Recent activity timeline showing last 10 tick results with action badges (ok/escalated/skipped)
- [ ] Save button persists config via `PUT /api/heartbeat`
- [ ] Typecheck passes
- [ ] **Verify in browser using agent-browser skill**

### US-022: Heartbeat badge on chat messages
**Description:** As a user, I want to know when a chat message was triggered by a heartbeat so I can distinguish automated from manual interactions.

**Acceptance Criteria:**
- [ ] Heartbeat-triggered messages include `{ source: "heartbeat" }` in metadata
- [ ] Chat message component shows "Heartbeat" badge when `source === "heartbeat"`
- [ ] Badge uses distinct color/style (e.g., pulsing dot or clock icon)
- [ ] Typecheck passes
- [ ] **Verify in browser using agent-browser skill**

### US-023: Collapse HEARTBEAT_OK messages in chat
**Description:** As a user, I want HEARTBEAT_OK (no-action-needed) messages collapsed by default in chat so they don't clutter the conversation.

**Acceptance Criteria:**
- [ ] Messages with `source: "heartbeat"` and `action: "ok"` are collapsed by default
- [ ] Collapsed state shows one-line summary: "Heartbeat check — all clear" with timestamp
- [ ] "Show details" button expands to show full response
- [ ] Escalated heartbeat messages always shown expanded
- [ ] Typecheck passes
- [ ] **Verify in browser using agent-browser skill**

### US-024: Frontend tests for heartbeat components
**Description:** As a developer, I need frontend tests for the heartbeat dashboard and chat integration.

**Acceptance Criteria:**
- [ ] Tests for heartbeat section rendering on Schedules page
- [ ] Tests for heartbeat badge on chat messages
- [ ] Tests for HEARTBEAT_OK collapse/expand behavior
- [ ] Tests pass with `npm run test`

### US-025: APScheduler to TaskIQ Scheduler migration spec
**Description:** As a developer, I need a documented migration plan for moving existing cron schedules from APScheduler to TaskIQ Scheduler so the team can plan the work.

**Acceptance Criteria:**
- [ ] New file `specs/005-scheduler-migration.md`
- [ ] Documents current APScheduler usage (jobstore, triggers, pickle constraints)
- [ ] Proposes TaskIQ Scheduler equivalent for each APScheduler feature
- [ ] Includes data migration strategy (PostgreSQL jobstore → Redis `ListRedisScheduleSource`)
- [ ] Lists breaking changes and rollback plan
- [ ] Includes migration script pseudocode
- [ ] Identifies risks: Redis persistence vs PostgreSQL durability, schedule state during migration
- [ ] No implementation — spec only

## Functional Requirements

- FR-1: `create_schedule` tool must accept title, trigger (cron expression or natural language), and prompt; create via `ScheduleService.create_job()`
- FR-2: `list_schedules` tool must return all schedules for the authenticated user with ID, title, trigger, and next run time
- FR-3: `delete_schedule` tool must validate ownership before deletion and confirm with schedule title
- FR-4: `HeartbeatConfig` must support `every_seconds` (min 1800 in production), `active_hours`, `isolated_session`, `light_context`, and `ack_max_chars`
- FR-5: Heartbeat tick must check `active_hours` before invoking agent; skip and record "skipped" if outside window
- FR-6: Heartbeat tick must detect `HEARTBEAT_OK` token at start or end of agent response
- FR-7: If agent response contains `HEARTBEAT_OK` and remaining content <= `ack_max_chars` (300), the tick result is "ok" and response is suppressed
- FR-8: If agent response does not contain `HEARTBEAT_OK` or remaining content > `ack_max_chars`, the tick result is "escalated" and full response is preserved
- FR-9: `HeartbeatState.consecutive_ok_count` increments on "ok", resets to 0 on "escalated"
- FR-10: TaskIQ Scheduler must run as a separate Docker service reading from `ListRedisScheduleSource`
- FR-11: `PUT /api/heartbeat` must create or update config and call `register()` when `enabled=true`
- FR-12: `DELETE /api/heartbeat` must call `unregister()` to remove the TaskIQ schedule
- FR-13: `POST /api/heartbeat/tick` must execute a single tick synchronously and return the result
- FR-14: Heartbeat tools must allow conversational configuration (e.g., "check my inbox every 2 hours between 9am and 6pm")
- FR-15: Heartbeat section on Schedules page must include toggle, agent selector, checklist editor, interval selector, active hours config, status card, and activity timeline
- FR-16: Chat messages from heartbeat ticks must include `{ source: "heartbeat" }` metadata
- FR-17: HEARTBEAT_OK messages must be collapsed by default in chat, with expand option

## Non-Goals

- No automatic priority or urgency scoring of heartbeat escalations
- No multi-user heartbeat (one config per user, not per team)
- No heartbeat chaining (one heartbeat triggering another)
- No custom heartbeat response format beyond HEARTBEAT_OK token
- No migration of existing APScheduler cron schedules in this PRD (Spec 005 is spec-only)
- No mobile-specific heartbeat UI (responsive layout only)
- No heartbeat notifications via email, Slack, or push — escalated responses appear in chat thread only
- No rate limiting on manual tick endpoint beyond standard API rate limits

## Design Considerations

- Heartbeat section should appear above existing schedule content on the Schedules page, visually distinct with a section header
- Reuse existing UI components: `Select` for dropdowns, `Textarea` for checklist, `Switch` for toggle, `Card` for status
- Activity timeline should use existing badge component with color variants: green for "ok", yellow for "skipped", red for "escalated"
- Heartbeat badge in chat should use a clock icon or pulsing dot, consistent with existing message metadata display
- Collapsed HEARTBEAT_OK messages should have a subtle, muted appearance to minimize visual noise

## Technical Considerations

- **Storage:** Heartbeat config and state stored in LangGraph store using `BaseRepo` pattern with namespaces `(user_id, "heartbeat_config")` and `(user_id, "heartbeat_state")`. No Alembic migration needed.
- **Scheduler:** New `scheduler` Docker service running `taskiq scheduler` process. Reads from `ListRedisScheduleSource` (Redis). Coexists with existing APScheduler in FastAPI process.
- **Token cost:** Isolated session + light context should reduce per-tick cost from ~100K tokens to ~2-5K tokens. Checklist-only prompt avoids loading conversation history, tool descriptions, and memory.
- **Agent invocation:** Heartbeat tick creates a fresh `LLMRequest` with checklist as system prompt, invokes via `scheduled_llm_invoke()` pattern from `backend/src/services/schedule.py`
- **Pickling:** TaskIQ uses task names (no pickling constraint), unlike APScheduler which requires module-level functions
- **Dependencies:** `taskiq-redis` already in `pyproject.toml`. No new packages needed. `ListRedisScheduleSource` is part of `taskiq-redis`.
- **Concurrency:** Only one heartbeat config per user. TaskIQ Scheduler handles interval timing; no need for distributed locks.
- **Persistence tradeoff:** Redis-based schedule source is less durable than PostgreSQL. Acceptable for heartbeat (recreated on config save). Existing cron schedules remain in PostgreSQL via APScheduler.

## Success Metrics

- Users can create a schedule from chat in under 3 messages (ask → confirm → done)
- Heartbeat tick with HEARTBEAT_OK completes in < 5 seconds and uses < 5K tokens
- 90%+ of heartbeat ticks return "ok" for stable environments (no unnecessary escalations)
- Heartbeat dashboard loads in < 1 second on Schedules page
- Zero regression in existing schedule CRUD functionality

## Open Questions

- Should heartbeat history be stored indefinitely or pruned after N entries (e.g., last 100)?
- Should the heartbeat checklist support dynamic items (e.g., "check tool X output") or static markdown only?
- Should escalated heartbeat responses create a new chat thread or append to a dedicated heartbeat thread?
- What should happen if the TaskIQ Scheduler process crashes — should the FastAPI process detect and alert?
- Should there be a global admin toggle to disable all heartbeats (e.g., during maintenance windows)?

## PR Submission & E2E Validation Steps

After implementation is complete, push changes and open a PR against `development` with the following E2E validation steps for the human reviewer:

### Prerequisites
```bash
make dev.docker.up          # Start backend, worker, postgres, redis, search
cd frontend && npm run dev  # Start frontend on :5173
```

### 1. Schedule Tools from Chat (Spec 001)
```bash
# Login at http://localhost:5173 with admin@example.com / test1234
# In chat, send: "Schedule a daily weather check at 8am"
# Verify: Agent confirms schedule created with ID and next run time
# Navigate to /schedules page
# Verify: New schedule appears in list with cron "0 8 * * *"
# In chat, send: "List my schedules"
# Verify: Agent returns formatted list including the new schedule
# In chat, send: "Delete that schedule"
# Verify: Agent confirms deletion
# Navigate to /schedules page
# Verify: Schedule no longer appears
```

### 2. Heartbeat REST API (Specs 002 + 003)
```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test1234"}' | jq -r '.access_token')

# Create heartbeat config
curl -X PUT http://localhost:8000/api/heartbeat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "<agent-id>",
    "enabled": true,
    "checklist": "# Heartbeat checklist\n- Check for urgent items\n- Summarize pending tasks",
    "every_seconds": 3600,
    "active_hours": {"start": "09:00", "end": "22:00", "timezone": "America/Chicago"}
  }'
# Verify: 200 OK with config returned

# Check state
curl -s http://localhost:8000/api/heartbeat/state \
  -H "Authorization: Bearer $TOKEN" | jq .
# Verify: State object with null last_run_at, consecutive_ok_count=0

# Manual tick
curl -X POST http://localhost:8000/api/heartbeat/tick \
  -H "Authorization: Bearer $TOKEN" | jq .
# Verify: Returns HeartbeatTickResult with action "ok", "escalated", or "skipped"

# Check history
curl -s http://localhost:8000/api/heartbeat/history \
  -H "Authorization: Bearer $TOKEN" | jq .
# Verify: History includes the manual tick result

# Delete config
curl -X DELETE http://localhost:8000/api/heartbeat \
  -H "Authorization: Bearer $TOKEN"
# Verify: 200 OK, GET /api/heartbeat returns empty/null
```

### 3. Heartbeat from Chat (Spec 003)
```bash
# In chat, send: "Set up a heartbeat to check my inbox every 2 hours between 9am and 6pm"
# Verify: Agent confirms heartbeat configured with interval and active hours
# In chat, send: "What's my heartbeat status?"
# Verify: Agent returns config summary and state (last run, next due, consecutive OKs)
# In chat, send: "Disable my heartbeat"
# Verify: Agent confirms heartbeat disabled
```

### 4. Heartbeat Dashboard (Spec 004)
```bash
# Navigate to http://localhost:5173/schedules
# Verify: "Heartbeat" section visible above schedule list
# Toggle heartbeat ON
# Verify: Toggle shows enabled state, form fields become active
# Select an agent from dropdown
# Enter checklist markdown in textarea
# Select "Every 2 hours" interval
# Set active hours 09:00 - 18:00
# Click Save
# Verify: Status card shows next_due_at, consecutive_ok_count=0
# Click "Trigger Now" (manual tick button)
# Verify: Activity timeline updates with new tick result
# Verify: Status card updates with last_run_at
```

### 5. Chat Heartbeat Messages (Spec 004)
```bash
# After a heartbeat tick has fired (manual or scheduled):
# Navigate to chat
# Verify: Heartbeat-triggered messages show "Heartbeat" badge
# Verify: HEARTBEAT_OK messages are collapsed with "Heartbeat check — all clear"
# Click "Show details" on a collapsed message
# Verify: Full response expands
# Verify: Escalated heartbeat messages are shown expanded by default
```

### 6. Docker Scheduler Service (Spec 002)
```bash
make dev.docker.ps
# Verify: "scheduler" service is running alongside backend, worker, postgres, redis
make dev.docker.logs DOCKER_DEV_LOG_SERVICES="scheduler"
# Verify: Scheduler process started, reading from Redis schedule source
```

### 7. Automated Tests
```bash
cd backend && make test    # All backend tests pass including new heartbeat tests
cd frontend && npm run test # All frontend tests pass including heartbeat component tests
```
