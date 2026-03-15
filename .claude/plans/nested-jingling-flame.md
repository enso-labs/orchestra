# Plan: Heartbeat-Inspired Scheduler Specs

## Context

Orchestra has a full APScheduler-based scheduling system (cron triggers, TaskIQ workers, React UI with calendar/table views), but it operates as a separate page — disconnected from the chat experience. Users can't ask an agent to schedule tasks conversationally. Additionally, every scheduled job fires a full LLM invocation regardless of whether anything needs attention, which is wasteful.

**OpenClaw's HEARTBEAT.md pattern** (studied from `docs.openclaw.ai/gateway/heartbeat` and `docs.openclaw.ai/automation/cron-vs-heartbeat`) offers a complementary model:

- **HEARTBEAT.md** — A simple markdown checklist the agent reads periodically (default 30m). The agent decides if action is needed.
- **HEARTBEAT_OK token** — Must appear at start/end of reply. If remaining content <= `ackMaxChars` (default 300), the entire reply is silently dropped.
- **activeHours** — Time window control to skip heartbeats outside business hours.
- **isolatedSession** — Fresh session per heartbeat run, reducing token cost ~100K → ~2-5K.
- **lightContext** — Limits bootstrap to just the checklist for minimal prompt size.
- **Cron vs Heartbeat decision flow**: Exact time? → Cron. Isolation needed? → Cron (isolated). Batch with checks? → Heartbeat. One-shot? → Cron with `--at`.

## Scheduler Analysis: APScheduler vs TaskIQ Scheduler

Studied `taskiq-python.github.io/guide/scheduling-tasks.html` and compared with current APScheduler setup.

### Current State
- **APScheduler 3.11.0** handles timing (cron/interval triggers) in the FastAPI process
- **TaskIQ** handles execution (broker + Redis worker) — already a dependency
- Two separate systems for one pipeline: APScheduler fires → `scheduled_llm_invoke()` dispatches → TaskIQ worker executes

### Comparison

| Dimension | APScheduler (Current) | TaskIQ Scheduler |
|---|---|---|
| Already used for | Timing only | Execution only (broker + worker) |
| Persistence | PostgreSQL (SQLAlchemy jobstore) | Redis (`ListRedisScheduleSource`) |
| Dynamic CRUD | `add_job()`, `modify_job()`, `remove_job()` | `schedule_by_cron()`, `schedule_by_interval()`, `unschedule()` |
| Process model | Runs in FastAPI process | Separate `taskiq scheduler` process |
| Pickling | Functions must be module-level (picklable) | Uses task names (no pickling) |
| Stack unity | Separate dependency | Unifies with existing TaskIQ |
| Maturity | v3.x maintenance mode | Newer, less battle-tested |

### Recommendation

**TaskIQ Scheduler for new heartbeat feature.** Rationale:
1. Orchestra already uses TaskIQ for execution — unifies the stack
2. Redis is already a dependency — `ListRedisScheduleSource` fits naturally
3. No pickling constraint — cleaner code than APScheduler's module-level function requirement
4. `schedule_by_interval()` + `CreatedSchedule.unschedule()` = exactly what heartbeat registration needs

**Keep APScheduler for existing cron schedules** (non-trivial migration). Add a future spec for full migration.

---

## Deliverables

Generate **5 spec files** in `specs/` using parallel subagents:

### Spec 001: `specs/001-schedule-tool.md` — Agent-Initiated Scheduling from Chat

**User Story:** As a user from the chat page, I want to ask my agent to schedule a task, and have it create/manage schedules seamlessly.

**Purpose:** Let users say "schedule a daily weather check at 8am" in chat. Agent creates/manages schedules via LangChain tools.

**Key changes:**
- **New file:** `backend/src/tools/schedule.py` — LangChain tools (`create_schedule`, `list_schedules`, `delete_schedule`) following `@tool` + `RunnableConfig` pattern from `backend/src/tools/memory.py`
- **Modify:** `backend/src/tools/__init__.py` — Add `SCHEDULE_TOOLS` to `default_tools()` (line 16-22)
- **Reuses:** `ScheduleService.create_job()` (schedule.py:221), `.get_jobs()` (schedule.py:190), `.delete_job()` (schedule.py:296)
- Tools extract `user_id` from `config["configurable"].get("user_id")` and build `LLMRequest` from current agent context
- Works with current APScheduler system — no migration needed
- **Tests:** `backend/tests/unit/tools/test_schedule_tools.py`

### Spec 002: `specs/002-heartbeat-engine.md` — Heartbeat Engine (TaskIQ Scheduler)

**User Story:** As a developer, I want the scheduling system to support heartbeat-style periodic awareness so agents only escalate to full LLM invocations when something needs attention.

**Purpose:** Core heartbeat engine using **TaskIQ Scheduler** with `ListRedisScheduleSource` for dynamic schedule management, inspired by OpenClaw's HEARTBEAT.md pattern.

**Key OpenClaw concepts adapted:**
- **Checklist** — Stored as markdown in LangGraph store (not filesystem), equivalent to HEARTBEAT.md
- **HEARTBEAT_OK token** — Agent responds with `HEARTBEAT_OK` when nothing needs attention; if remaining content <= `ackMaxChars` (300 chars), response is suppressed
- **activeHours** — Time window control to skip heartbeats outside configured hours
- **isolatedSession** — Fresh session per tick to reduce token cost
- **lightContext** — Limit context to just the checklist

**Key changes:**
- **New file:** `backend/src/schemas/entities/heartbeat.py` — Pydantic models:
  - `HeartbeatConfig`: `user_id`, `assistant_id`, `enabled`, `checklist` (markdown), `every_seconds` (default 3600), `active_hours` (start/end/timezone), `isolated_session`, `light_context`, `ack_max_chars` (300), `prompt`
  - `HeartbeatState`: `last_run_at`, `last_result`, `consecutive_ok_count`, `next_due_at`
  - `HeartbeatTickResult`: `action` ("ok"|"escalated"|"skipped"), `reason`, `response`
- **New file:** `backend/src/services/heartbeat.py` — `HeartbeatService`:
  - `tick()` — Check activeHours, read checklist, invoke agent, apply HEARTBEAT_OK detection, record state
  - `register()` — Create TaskIQ scheduled task via `run_heartbeat_tick.schedule_by_interval(redis_source, seconds, user_id=user_id)`
  - `unregister()` — `CreatedSchedule.unschedule()` to remove
- **New file:** `backend/src/workers/heartbeat.py` — TaskIQ task `run_heartbeat_tick` using `@broker.task()` decorator
- **New file:** `backend/src/workers/scheduler.py` — TaskIQ Scheduler setup with `ListRedisScheduleSource`
- **New file:** `backend/src/repos/heartbeat_repo.py` — Following `BaseRepo` pattern, namespaces `(user_id, "heartbeat_config")` and `(user_id, "heartbeat_state")`
- **Modify:** `backend/src/contexts/service.py` — Wire `HeartbeatService` into `ServiceContext`
- **Modify:** `backend/pyproject.toml` — No new deps needed (taskiq already installed)
- **Modify:** `docker-compose.dev.yml` — Add `scheduler` service running `taskiq scheduler backend.src.workers.scheduler:scheduler`
- **Tests:** `backend/tests/unit/services/test_heartbeat_service.py`

### Spec 003: `specs/003-heartbeat-api-tools.md` — REST API + Chat Tools

**User Story:** As a user, I want to configure heartbeat from the UI and conversationally ("set up a heartbeat to check my inbox every hour").

**Key changes:**
- **New file:** `backend/src/routes/v0/heartbeat.py` — REST endpoints:
  - `GET /api/heartbeat` — Get config
  - `PUT /api/heartbeat` — Create/update config + checklist
  - `DELETE /api/heartbeat` — Disable/remove
  - `GET /api/heartbeat/state` — Runtime state
  - `POST /api/heartbeat/tick` — Manual trigger
  - `GET /api/heartbeat/history` — Recent results
- **Modify:** `backend/src/routes/v0/__init__.py` — Register heartbeat router
- **New file:** `backend/src/tools/heartbeat.py` — LangChain tools:
  - `configure_heartbeat(checklist, every_hours, active_hours_start, active_hours_end)`
  - `get_heartbeat_status()`
  - `disable_heartbeat()`
- **Modify:** `backend/src/tools/__init__.py` — Add `HEARTBEAT_TOOLS` to `default_tools()`
- All endpoints use `Depends(verify_credentials)`, user isolation enforced

### Spec 004: `specs/004-heartbeat-frontend.md` — Dashboard + Chat Integration

**User Story:** As a user, I want to see heartbeat status on the Schedules page and understand when a chat message was triggered by a heartbeat.

**Key changes:**
- **New file:** `frontend/src/lib/entities/heartbeat.ts` — TypeScript interfaces
- **New file:** `frontend/src/lib/services/heartbeatService.ts` — API service
- **New file:** `frontend/src/hooks/useHeartbeat.ts` — React hook with auto-refresh
- **Modify:** `frontend/src/pages/schedules/index.tsx` — "Heartbeat" section:
  - Enable/disable toggle, agent selector, checklist editor (markdown)
  - Interval selector, active hours config
  - Status card (last run, next due, consecutive OKs)
  - Recent activity timeline
- **Chat treatment:** Heartbeat messages tagged with `{ source: "heartbeat" }`, show badge, collapse HEARTBEAT_OK responses

### Spec 005: `specs/005-scheduler-migration.md` — APScheduler → TaskIQ Scheduler Migration

**User Story:** As a developer, I want a unified scheduling stack so we don't maintain two separate systems.

**Purpose:** Future migration plan for moving existing cron schedules from APScheduler to TaskIQ Scheduler.

**Key changes (future):**
- Migrate `ScheduleService` from APScheduler API to TaskIQ `ListRedisScheduleSource`
- Migrate schedule persistence from PostgreSQL jobstore to Redis
- Remove `apscheduler` dependency from `pyproject.toml`
- Update `ScheduleService.create_job/get_jobs/delete_job` to use TaskIQ scheduler API
- Data migration script for existing schedules
- Update docker-compose to ensure scheduler service handles both cron + heartbeat

---

## Implementation Order

1. **Spec 001** (Schedule Tool) — No new dependencies, immediately useful, works with current APScheduler
2. **Spec 002** (Heartbeat Engine) — Core backend logic using TaskIQ Scheduler
3. **Spec 003** (Heartbeat API + Tools) — Depends on Spec 002
4. **Spec 004** (Frontend) — Depends on Spec 003, can develop UI with mock data in parallel
5. **Spec 005** (Migration) — Future work, after heartbeat is stable

## Execution Strategy

Generate specs 001-005 in parallel using specialized subagents. Each spec follows:
- Title, user story, purpose
- Problem statement
- Technical approach with file paths and line references
- Key interfaces/schemas
- Integration with existing code
- Acceptance criteria + test plan

## E2E Testing Plan (agent-browser)

Complete QA validation using the `agent-browser` CLI skill. All UI stories require agent-browser validation before completion (per project convention in `.github/ISSUE_TEMPLATE/feature_request.md`).

**Prerequisites:**
- Docker dev stack running: `make dev.docker.up`
- Frontend dev server: `cd frontend && npm run dev` (port 5173)
- Default test credentials: `admin@example.com` / `test1234`

### Phase 1: Spec 001 — Schedule Tool from Chat

**Test: User asks agent to create a schedule**
```bash
# 1. Navigate to chat page, log in
agent-browser open http://localhost:5173
agent-browser snapshot --json  # find login elements
agent-browser fill "input[name=email]" "admin@example.com"
agent-browser fill "input[name=password]" "test1234"
agent-browser click "button:has-text('Sign in')"
agent-browser screenshot specs/screenshots/001-login.png

# 2. Send a message asking agent to create a schedule
agent-browser snapshot --json  # find chat input
agent-browser fill "[data-testid=chat-input]" "Schedule a daily check at 9am with the message: What's the weather today?"
agent-browser press Enter
# Wait for agent response with schedule confirmation
agent-browser screenshot specs/screenshots/001-schedule-created.png

# 3. Verify schedule appears on Schedules page
agent-browser open http://localhost:5173/schedules
agent-browser snapshot --json
agent-browser screenshot specs/screenshots/001-schedules-page.png
# Verify: Schedule titled "daily check" exists with cron "0 9 * * *"

# 4. Return to chat, ask agent to list schedules
agent-browser open http://localhost:5173
agent-browser fill "[data-testid=chat-input]" "List my schedules"
agent-browser press Enter
agent-browser screenshot specs/screenshots/001-list-schedules.png

# 5. Ask agent to delete the schedule
agent-browser fill "[data-testid=chat-input]" "Delete that schedule"
agent-browser press Enter
agent-browser screenshot specs/screenshots/001-schedule-deleted.png

# 6. Verify removal on Schedules page
agent-browser open http://localhost:5173/schedules
agent-browser screenshot specs/screenshots/001-schedules-empty.png
```

**Backend curl validation (parallel):**
```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test1234"}' | jq -r '.access_token')

# Verify schedule CRUD via API
curl -s http://localhost:8000/api/schedules -H "Authorization: Bearer $TOKEN" | jq .
```

### Phase 2: Spec 002+003 — Heartbeat Configuration

**Test: Configure heartbeat via REST API**
```bash
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

# Check state
curl -s http://localhost:8000/api/heartbeat/state \
  -H "Authorization: Bearer $TOKEN" | jq .

# Manual tick (testing)
curl -X POST http://localhost:8000/api/heartbeat/tick \
  -H "Authorization: Bearer $TOKEN" | jq .

# Check history
curl -s http://localhost:8000/api/heartbeat/history \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Test: Configure heartbeat from chat**
```bash
# 1. Navigate to chat
agent-browser open http://localhost:5173
agent-browser snapshot --json

# 2. Ask agent to set up heartbeat
agent-browser fill "[data-testid=chat-input]" "Set up a heartbeat to check my inbox every 2 hours between 9am and 6pm"
agent-browser press Enter
agent-browser screenshot specs/screenshots/002-heartbeat-configured.png

# 3. Ask for heartbeat status
agent-browser fill "[data-testid=chat-input]" "What's my heartbeat status?"
agent-browser press Enter
agent-browser screenshot specs/screenshots/002-heartbeat-status.png
```

### Phase 3: Spec 004 — Frontend Heartbeat Dashboard

**Test: Heartbeat section on Schedules page**
```bash
# 1. Navigate to Schedules page
agent-browser open http://localhost:5173/schedules
agent-browser snapshot --json
agent-browser screenshot specs/screenshots/004-schedules-heartbeat-section.png

# 2. Verify heartbeat section exists
# Look for: enable/disable toggle, agent selector, checklist editor, interval selector

# 3. Toggle heartbeat on
agent-browser click "[data-testid=heartbeat-toggle]"
agent-browser screenshot specs/screenshots/004-heartbeat-enabled.png

# 4. Edit checklist
agent-browser snapshot --json  # find checklist textarea
agent-browser fill "[data-testid=heartbeat-checklist]" "# My checklist\n- Check email\n- Review calendar"
agent-browser screenshot specs/screenshots/004-checklist-edited.png

# 5. Set interval
agent-browser click "[data-testid=heartbeat-interval]"
agent-browser snapshot --json  # find dropdown options
agent-browser click "li:has-text('Every 2 hours')"
agent-browser screenshot specs/screenshots/004-interval-set.png

# 6. Set active hours
agent-browser fill "[data-testid=active-hours-start]" "09:00"
agent-browser fill "[data-testid=active-hours-end]" "18:00"
agent-browser screenshot specs/screenshots/004-active-hours.png

# 7. Save and verify status card
agent-browser click "button:has-text('Save')"
agent-browser screenshot specs/screenshots/004-saved.png
# Verify: status card shows next_due_at, consecutive OKs, last_result

# 8. Check recent activity timeline
agent-browser scroll down 300
agent-browser screenshot specs/screenshots/004-activity-timeline.png
```

**Test: Heartbeat badge in chat messages**
```bash
# 1. After a heartbeat tick has fired, navigate to the heartbeat thread
agent-browser open http://localhost:5173
agent-browser snapshot --json

# 2. Find thread with heartbeat messages
# Look for thread with "Heartbeat" badge on messages

# 3. Verify HEARTBEAT_OK messages are collapsed
agent-browser screenshot specs/screenshots/004-heartbeat-messages.png
# Verify: OK messages show collapsed, escalated messages show full content

# 4. Expand collapsed messages
agent-browser click "button:has-text('Show heartbeat activity')"
agent-browser screenshot specs/screenshots/004-heartbeat-expanded.png
```

### Phase 4: Mobile Viewport Validation

```bash
# Test responsive layout on mobile viewport
agent-browser set viewport 375 812
agent-browser open http://localhost:5173/schedules
agent-browser screenshot specs/screenshots/mobile-schedules.png

# Verify heartbeat section is accessible on mobile
agent-browser snapshot --json
agent-browser screenshot specs/screenshots/mobile-heartbeat.png

# Reset viewport
agent-browser set viewport 1280 720
```

### Phase 5: Cross-Session Validation

```bash
# 1. Configure heartbeat in one session
agent-browser open http://localhost:5173/schedules
# ... configure heartbeat ...

# 2. Open new session (different browser session)
agent-browser --session session2 open http://localhost:5173
agent-browser --session session2 fill "input[name=email]" "admin@example.com"
agent-browser --session session2 fill "input[name=password]" "test1234"
agent-browser --session session2 click "button:has-text('Sign in')"

# 3. Navigate to schedules in session2
agent-browser --session session2 open http://localhost:5173/schedules
agent-browser --session session2 screenshot specs/screenshots/cross-session-heartbeat.png
# Verify: same heartbeat config visible (persisted to backend)
```

### Success Criteria Checklist

- [ ] **Spec 001**: Agent creates schedule from chat, schedule visible on Schedules page
- [ ] **Spec 001**: Agent lists and deletes schedules from chat
- [ ] **Spec 002**: Heartbeat tick executes and returns HEARTBEAT_OK or escalated response
- [ ] **Spec 003**: REST API CRUD works for heartbeat config
- [ ] **Spec 003**: Agent configures heartbeat from chat
- [ ] **Spec 004**: Heartbeat section visible on Schedules page with all controls
- [ ] **Spec 004**: Heartbeat messages in chat show badge
- [ ] **Spec 004**: HEARTBEAT_OK messages collapsed by default
- [ ] **Mobile**: Heartbeat section accessible on 375px viewport
- [ ] **Cross-session**: Config persists across browser sessions
- [ ] All screenshots captured in `specs/screenshots/` for progress log

---

## Unit + Integration Test Verification

- Backend: `make test` after each spec implementation
- Frontend: `npm run test` after Spec 004
- Manual testing via curl examples (per backend CLAUDE.md)
- Docker: `make dev.docker.up` to verify scheduler service starts
