# PRD: Heartbeat-Inspired Scheduler

## Introduction

Orchestra has a full APScheduler-based scheduling system, but it operates as a disconnected page -- users cannot schedule tasks conversationally from chat. Additionally, every scheduled job fires a full LLM invocation regardless of whether anything needs attention, which is wasteful.

This PRD introduces two complementary capabilities:

1. **Chat-based schedule management** -- LangChain tools that let users say "schedule a daily check at 9am" from chat, wrapping the existing `ScheduleService`. Ships independently with no new infrastructure.
2. **Heartbeat engine** -- A lightweight periodic awareness system (inspired by OpenClaw's HEARTBEAT.md pattern) where an agent reads a checklist, decides if action is needed, and only escalates by creating a new chat thread when something requires attention. Uses TaskIQ Scheduler for unified timing + execution.

A future migration spec (005) documents the path to fully replacing APScheduler with TaskIQ Scheduler.

## Goals

- Let users create, list, and delete schedules conversationally from chat without leaving the conversation
- Introduce a heartbeat pattern that reduces cost by ~95% for "check and report" workflows (full invocation only on escalation)
- Escalated heartbeat results automatically create a new chat thread so users are proactively notified
- Provide a dashboard on the Schedules page for heartbeat configuration and monitoring
- Collapse HEARTBEAT_OK (no-action-needed) messages in chat to reduce noise
- Establish TaskIQ Scheduler as the scheduling foundation for future migration off APScheduler
- One heartbeat configuration per user; user selects which agent runs it

## User Stories

---

### US-001: Create schedule from chat
**Description:** As a user, I want to tell my agent "schedule a daily weather check at 9am" and have it create a recurring schedule without leaving the conversation.

**Acceptance Criteria:**
- [ ] New file `backend/src/tools/schedule.py` with `create_schedule` tool using `@tool` + `RunnableConfig` pattern from `backend/src/tools/memory.py`
- [ ] Tool accepts `title` (str), `cron_expression` (str, 5-field), `message` (str) parameters
- [ ] Tool extracts `user_id`, `assistant_id`, `model` from `config["configurable"]`
- [ ] Tool builds `LLMRequest` and calls `ScheduleService.create_job()` (line 221 of `backend/src/services/schedule.py`)
- [ ] Tool returns confirmation with schedule ID, title, cron expression, and next run time
- [ ] Cron expression validation rejects intervals shorter than 1 hour (via existing `JobTrigger` validator)
- [ ] `make format` and `make test` pass

### US-002: List schedules from chat
**Description:** As a user, I want to ask "list my schedules" and see all my active scheduled tasks.

**Acceptance Criteria:**
- [ ] `list_schedules` tool in `backend/src/tools/schedule.py` calls `ScheduleService.get_jobs()` (line 190)
- [ ] Returns formatted list with title, ID, cron expression, and next run time for each schedule
- [ ] Returns "You have no scheduled tasks." when list is empty
- [ ] Only shows current user's schedules (user isolation via `user_id`)
- [ ] `make format` and `make test` pass

### US-003: Delete schedule from chat
**Description:** As a user, I want to say "delete that schedule" and have the agent remove it.

**Acceptance Criteria:**
- [ ] `delete_schedule` tool in `backend/src/tools/schedule.py` accepts `schedule_id` parameter
- [ ] Calls `ScheduleService.delete_job()` (line 296) with ownership verification
- [ ] Returns confirmation message on success, error message if not found or not owned
- [ ] `make format` and `make test` pass

### US-004: Register schedule tools in default tool library
**Description:** As a developer, I need the schedule tools available to all agents by default.

**Acceptance Criteria:**
- [ ] `SCHEDULE_TOOLS = [create_schedule, list_schedules, delete_schedule]` exported from `backend/src/tools/schedule.py`
- [ ] Import added at top of `backend/src/tools/__init__.py`
- [ ] `SCHEDULE_TOOLS` added to the list in `default_tools()` (line ~16-22 of `backend/src/tools/__init__.py`)
- [ ] `make format` and `make test` pass

### US-005: Unit tests for schedule tools
**Description:** As a developer, I need unit tests for all three schedule tools to prevent regressions.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/tools/test_schedule_tools.py`
- [ ] `TestCreateSchedule`: test successful creation, test returns ID + next run, test rejects invalid cron, test uses model from config
- [ ] `TestListSchedules`: test lists user schedules formatted, test empty message, test user isolation
- [ ] `TestDeleteSchedule`: test deletes by ID, test nonexistent schedule error, test cannot delete other user's schedule
- [ ] All tests mock `ScheduleService` (no real APScheduler needed)
- [ ] `make test` passes

---

### US-006: Heartbeat Pydantic schemas
**Description:** As a developer, I need data models for heartbeat configuration, state, and tick results.

**Acceptance Criteria:**
- [ ] New file `backend/src/schemas/entities/heartbeat.py`
- [ ] `ActiveHours` model with `start` (str, HH:MM, default "09:00"), `end` (str, HH:MM, default "22:00"), `timezone` (str, IANA, default "UTC")
- [ ] `HeartbeatConfig` model with fields: `user_id` (str), `assistant_id` (str), `enabled` (bool, default False), `checklist` (str, markdown), `every_seconds` (int, default 3600, ge=300, le=86400), `active_hours` (ActiveHours), `isolated_session` (bool, default True), `light_context` (bool, default True), `ack_max_chars` (int, default 300), `prompt` (str, template with `{checklist}` placeholder), `schedule_id` (Optional[str])
- [ ] `HeartbeatState` model with fields: `last_run_at` (Optional[datetime]), `last_result` (Optional[str], "ok"/"escalated"/"skipped"), `consecutive_ok_count` (int, default 0), `next_due_at` (Optional[datetime]), `total_ticks` (int, default 0), `total_escalations` (int, default 0), `last_escalation_at` (Optional[datetime], for rate limiting)
- [ ] `HeartbeatTickResult` model with fields: `action` (Literal["ok", "escalated", "skipped"]), `reason` (str), `response` (Optional[str]), `tokens_used` (Optional[int]), `duration_ms` (Optional[int]), `timestamp` (datetime)
- [ ] `HeartbeatHistory` model with fields: `results` (list[HeartbeatTickResult]), `max_entries` (int, default 100)
- [ ] `make format` and `make test` pass

### US-007: Heartbeat repository layer
**Description:** As a developer, I need repos to persist heartbeat config, state, and history in the LangGraph store.

**Acceptance Criteria:**
- [ ] New file `backend/src/repos/heartbeat_repo.py`
- [ ] `HeartbeatConfigRepo(BaseRepo)` with `entity_type="heartbeat_config"`, namespace `(user_id, "heartbeat_config")`, key `"config"`
  - Methods: `get() -> HeartbeatConfig | None`, `save(config: HeartbeatConfig) -> bool`, `delete() -> bool`
- [ ] `HeartbeatStateRepo(BaseRepo)` with `entity_type="heartbeat_state"`, namespace `(user_id, "heartbeat_state")`, key `"state"`
  - Methods: `get() -> HeartbeatState` (returns empty state if none), `save(state: HeartbeatState) -> bool`
- [ ] `HeartbeatHistoryRepo(BaseRepo)` with `entity_type="heartbeat_history"`, namespace `(user_id, "heartbeat_history")`, key `"history"`
  - Methods: `get() -> HeartbeatHistory`, `append(result: HeartbeatTickResult) -> bool` (inserts at index 0, trims to `max_entries`)
- [ ] All repos follow `BaseRepo` pattern from `backend/src/repos/base_repo.py`
- [ ] `make format` and `make test` pass

### US-008: Heartbeat service -- tick logic
**Description:** As a developer, I need the core heartbeat service that executes ticks: checks active hours, invokes agent, detects HEARTBEAT_OK, records results, and creates a new chat thread on escalation.

**Acceptance Criteria:**
- [ ] New file `backend/src/services/heartbeat.py` with `HeartbeatService` class
- [ ] Constructor accepts `user_id: str` and optional `store: BaseStore`, initializes `HeartbeatConfigRepo`, `HeartbeatStateRepo`, `HeartbeatHistoryRepo`
- [ ] `HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK"` module constant
- [ ] `_is_within_active_hours(config)` checks current time against `active_hours` with timezone support via `zoneinfo.ZoneInfo`, handles midnight wrapping (e.g., 22:00-06:00)
- [ ] `_detect_heartbeat_ok(response, ack_max_chars)` returns True if `HEARTBEAT_OK` appears at start or end of stripped response AND remaining content length <= `ack_max_chars`
- [ ] `tick()` method flow:
  1. Load config (skip if None or disabled)
  2. Check active hours (skip if outside window)
  3. Build prompt by replacing `{checklist}` in template
  4. Invoke agent via `scheduled_llm_invoke()` with cheapest model (Haiku), `source: "heartbeat"` in metadata
  5. Detect HEARTBEAT_OK -> action "ok" (suppress response) or "escalated" (keep response)
  6. **On escalation**: create a new chat thread with the escalated response (not just stored in history)
  7. Record state + append to history
- [ ] `_record_result()` updates `HeartbeatState`: sets `last_run_at`, `last_result`, increments `total_ticks`, increments `consecutive_ok_count` on OK (resets to 0 on escalation), increments `total_escalations` on escalation, computes `next_due_at`
- [ ] **Escalation rate limiting**: if last escalation was < 15 minutes ago, store result in state but skip thread creation. Use `HeartbeatState.last_escalation_at` (new field) to track
- [ ] **History stores escalations only**: `_record_result()` only appends to `HeartbeatHistory` when `action == "escalated"`. OK and skipped ticks update `HeartbeatState` counters but do not append to history
- [ ] CRUD methods: `get_config()`, `save_config()`, `delete_config()` (calls `unregister()` first), `get_state()`, `get_history(limit=20)`
- [ ] `make format` and `make test` pass

### US-009: Heartbeat service -- TaskIQ registration
**Description:** As a developer, I need the heartbeat service to register/unregister with TaskIQ Scheduler for periodic execution.

**Acceptance Criteria:**
- [ ] `register()` method calls `run_heartbeat_tick.schedule_by_interval(redis_source, seconds=config.every_seconds, user_id=self.user_id)`, stores `schedule_id` in config
- [ ] `unregister()` method calls `redis_source.delete_schedule(config.schedule_id)`, clears `schedule_id` from config
- [ ] Returns `None` / `False` gracefully when no config or no schedule_id
- [ ] `make format` and `make test` pass

### US-010: TaskIQ worker task and scheduler setup
**Description:** As a developer, I need the TaskIQ task for heartbeat execution and the scheduler process configuration.

**Acceptance Criteria:**
- [ ] New file `backend/src/workers/heartbeat.py` with `run_heartbeat_tick` task: `@broker.task(task_name="run_heartbeat_tick")`, accepts `user_id: str`, creates `HeartbeatService` with `get_store()`, calls `tick()`, returns `result.model_dump(mode="json")`
- [ ] New file `backend/src/workers/scheduler.py` with `redis_source = ListRedisScheduleSource(REDIS_URL)` and `scheduler = TaskiqScheduler(broker="src.workers.broker:broker", sources=[redis_source])`
- [ ] No new dependencies needed (`taskiq` and `taskiq-redis` already in `pyproject.toml`)
- [ ] `make format` and `make test` pass

### US-011: Wire HeartbeatService into ServiceContext
**Description:** As a developer, I need HeartbeatService accessible from ServiceContext like other services.

**Acceptance Criteria:**
- [ ] Import `HeartbeatService` added to `backend/src/contexts/service.py`
- [ ] `self.heartbeat_service = HeartbeatService(user_id=self.user_id, store=store)` added after `schedule_service` line (~38) in `ServiceContext.__init__`
- [ ] `make format` and `make test` pass

### US-012: Docker scheduler service
**Description:** As a developer, I need the TaskIQ Scheduler running as a Docker service alongside the worker.

**Acceptance Criteria:**
- [ ] New `scheduler` service in `docker-compose.dev.yml`
- [ ] Builds from `./backend` with `Dockerfile.dev`
- [ ] Uses env_file `${BACKEND_ENV_FILE:-./backend/.env.docker.dev}`
- [ ] Sets `REDIS_URL: redis://redis:6379/0`
- [ ] Command: `bash -c "uv sync && taskiq scheduler src.workers.scheduler:scheduler"`
- [ ] Depends on `backend` (service_healthy) and `redis` (service_started)
- [ ] Connected to `storage` and `services` networks
- [ ] Volume mount: `./backend/src:/app/src` for hot-reload
- [ ] Memory limit: 256M via `deploy.resources.limits`
- [ ] `make dev.docker.up` starts the scheduler service without errors

### US-013: Heartbeat service unit tests
**Description:** As a developer, I need comprehensive unit tests for the heartbeat service.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/services/test_heartbeat_service.py`
- [ ] `TestHeartbeatOkDetection`: detects OK at start, detects OK at end, rejects content beyond ack_max_chars, rejects missing token, handles whitespace padding
- [ ] `TestActiveHours`: within window returns True, outside window returns False, midnight wrapping (22:00-06:00) works correctly
- [ ] `TestTick`: skips when disabled, skips outside hours, returns "ok" on HEARTBEAT_OK, returns "escalated" without token, creates new chat thread on escalation, updates state correctly, appends to history, resets `consecutive_ok_count` on escalation
- [ ] `TestRegistration`: register creates schedule and stores schedule_id, unregister removes schedule and clears schedule_id
- [ ] All tests mock agent invocation and TaskIQ scheduler
- [ ] `make test` passes

---

### US-014: Heartbeat REST API endpoints
**Description:** As a user, I want REST endpoints to configure and monitor heartbeat from the frontend.

**Acceptance Criteria:**
- [ ] New file `backend/src/routes/v0/heartbeat.py` with `router = APIRouter(tags=["Heartbeat"])`
- [ ] Request schema `HeartbeatConfigRequest(BaseModel)` with fields: `assistant_id`, `enabled`, `checklist`, `every_seconds` (ge=300, le=86400), `active_hours`, `isolated_session`, `light_context`, `ack_max_chars`, `prompt`
- [ ] `GET /api/heartbeat` -- returns current config (empty dict `{}` if none), tags `["mcp"]`, uses `verify_credentials`
- [ ] `PUT /api/heartbeat` -- creates/updates config, calls `register()` when enabled / `unregister()` when disabled, tags `["mcp"]`
- [ ] `DELETE /api/heartbeat` -- removes config + unregisters, returns 204, tags `["mcp"]`
- [ ] `GET /api/heartbeat/state` -- returns runtime state dict, tags `["mcp"]`
- [ ] `POST /api/heartbeat/tick` -- manually triggers tick, returns result dict, tags `["mcp"]`
- [ ] `GET /api/heartbeat/history?limit=20` -- returns list of tick result dicts, tags `["mcp"]`
- [ ] Router registered in `backend/src/routes/v0/__init__.py` after schedule router
- [ ] `make format` and `make test` pass

### US-015: Heartbeat REST API unit tests
**Description:** As a developer, I need unit tests for all heartbeat REST endpoints.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/routes/test_heartbeat_routes.py`
- [ ] Tests: GET returns empty when no config, GET returns saved config, PUT creates config, PUT registers schedule on enable, PUT unregisters on disable, PUT validates every_seconds range (rejects <300 and >86400), DELETE removes config, DELETE returns 204, POST tick triggers and returns result, GET history returns results, GET history respects limit param
- [ ] All tests mock `HeartbeatService`
- [ ] `make test` passes

### US-016: Heartbeat chat tools
**Description:** As a user, I want to configure heartbeat from chat by saying "set up a heartbeat to check my inbox every hour between 9am and 6pm."

**Acceptance Criteria:**
- [ ] New file `backend/src/tools/heartbeat.py` following `@tool` + `RunnableConfig` pattern
- [ ] `configure_heartbeat(checklist: str, every_hours: float, active_hours_start: str, active_hours_end: str, config: RunnableConfig)` -- saves config with `every_seconds = int(every_hours * 3600)`, calls `unregister()` then `register()`, returns confirmation with interval, hours, checklist, schedule_id
- [ ] `get_heartbeat_status(config: RunnableConfig)` -- returns formatted config + state + last 5 history entries, or "No heartbeat configured" message
- [ ] `disable_heartbeat(config: RunnableConfig)` -- deletes config, returns confirmation, or "nothing to disable" message
- [ ] `HEARTBEAT_TOOLS = [configure_heartbeat, get_heartbeat_status, disable_heartbeat]` exported
- [ ] `HEARTBEAT_TOOLS` added to `default_tools()` in `backend/src/tools/__init__.py`
- [ ] `make format` and `make test` pass

### US-017: Heartbeat chat tools unit tests
**Description:** As a developer, I need unit tests for all heartbeat chat tools.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/tools/test_heartbeat_tools.py`
- [ ] Tests: configure creates config + registers + returns confirmation, status returns formatted output with history, status returns "no config" message, disable removes config + returns confirmation, disable returns "nothing to disable" message
- [ ] All tests mock `HeartbeatService`
- [ ] `make test` passes

---

### US-018: Frontend heartbeat TypeScript interfaces
**Description:** As a developer, I need TypeScript types matching the backend heartbeat schemas.

**Acceptance Criteria:**
- [ ] New file `frontend/src/lib/entities/heartbeat.ts`
- [ ] `ActiveHours` interface: `start: string`, `end: string`, `timezone: string`
- [ ] `HeartbeatConfig` interface matching all backend `HeartbeatConfig` fields
- [ ] `HeartbeatState` interface matching all backend `HeartbeatState` fields
- [ ] `HeartbeatTickResult` interface: `action: "ok" | "escalated" | "skipped"`, `reason`, `response`, `tokens_used`, `duration_ms`, `timestamp`
- [ ] `HeartbeatInterval` type union for preset intervals (300, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400)
- [ ] `HEARTBEAT_INTERVALS` constant array: `{ value: HeartbeatInterval; label: string }[]` with human-readable labels
- [ ] `npx tsc --noEmit` passes from `frontend/`

### US-019: Frontend heartbeat API service
**Description:** As a developer, I need an API service to communicate with the heartbeat REST endpoints.

**Acceptance Criteria:**
- [ ] New file `frontend/src/lib/services/heartbeatService.ts`
- [ ] Static class `HeartbeatService` following `scheduleService.ts` pattern with `apiClient`
- [ ] `getConfig()` -- GET /heartbeat, returns `{ config: HeartbeatConfig | null }` (null if empty object)
- [ ] `upsertConfig(config)` -- PUT /heartbeat
- [ ] `deleteConfig()` -- DELETE /heartbeat
- [ ] `getState()` -- GET /heartbeat/state
- [ ] `triggerTick()` -- POST /heartbeat/tick
- [ ] `getHistory(limit: number = 20)` -- GET /heartbeat/history?limit=
- [ ] `npx tsc --noEmit` passes from `frontend/`

### US-020: Frontend heartbeat React hook
**Description:** As a developer, I need a React hook that manages heartbeat state with auto-refresh.

**Acceptance Criteria:**
- [ ] New file `frontend/src/hooks/useHeartbeat.ts` following `useSchedules.ts` pattern
- [ ] `useHeartbeat(autoRefreshMs: number = 30000)` returns: `config`, `state`, `history`, `loading`, `error`, `fetchConfig`, `fetchState`, `fetchHistory`, `saveConfig`, `deleteConfig`, `triggerTick`
- [ ] Initial load fetches config + state + history on mount via `useEffect`
- [ ] Auto-refreshes state + history every `autoRefreshMs` when heartbeat is enabled; clears interval on unmount/disable
- [ ] Mutations show success/error toasts via `sonner`
- [ ] `npx tsc --noEmit` passes from `frontend/`

### US-021: Heartbeat dashboard section on Schedules page
**Description:** As a user, I want to see a heartbeat configuration and monitoring section on the Schedules page.

**Acceptance Criteria:**
- [ ] New file `frontend/src/components/heartbeat/HeartbeatSection.tsx`
- [ ] Collapsible `Card` with `Heart` icon (lucide-react) and "Heartbeat Monitor" title
- [ ] Shows green "Active" `Badge` when heartbeat is enabled
- [ ] Enable/disable `Switch` toggle (`data-testid="heartbeat-toggle"`)
- [ ] Agent selector `Select` dropdown populated from available agents
- [ ] Markdown checklist `Textarea` editor (`data-testid="heartbeat-checklist"`, `font-mono text-sm`)
- [ ] Interval `Select` with options from `HEARTBEAT_INTERVALS` constant
- [ ] Active hours start/end `Input[type=time]` (`data-testid="active-hours-start"`, `data-testid="active-hours-end"`)
- [ ] Save `Button` calls `onSave` with form data
- [ ] "Test Tick" `Button` (outline variant, with `Play` icon) triggers `onTriggerTick` -- only visible when enabled
- [ ] "Disable" `Button` (destructive variant) calls `onDelete` -- only visible when enabled
- [ ] Status card (`Card` with `bg-muted/50`) showing 2x2 / 4-col responsive grid: Last Run (relative via `formatDistanceToNow`), Next Due (relative), Consecutive OKs (count), Total ticks/escalations -- only visible when enabled
- [ ] Activity timeline: last 10 ticks with color-coded icons (`CheckCircle2` green=ok, `AlertTriangle` yellow=escalated, `SkipForward` gray=skipped), timestamp, reason, duration_ms
- [ ] `HeartbeatSection` integrated into `frontend/src/pages/schedules/index.tsx` using `useHeartbeat` hook, placed before existing schedule content (after stats cards)
- [ ] All controls accessible on 375px mobile viewport
- [ ] `npx tsc --noEmit` passes from `frontend/`
- [ ] Verify in browser using agent-browser skill

### US-022: Heartbeat badge and collapse in chat messages
**Description:** As a user, I want to see a "Heartbeat" badge on chat messages triggered by heartbeat ticks, and HEARTBEAT_OK messages should be collapsed.

**Acceptance Criteria:**
- [ ] Messages with `metadata.source === "heartbeat"` show a red-themed `Badge` with `Heart` icon: `"text-red-500 border-red-500/30 text-xs"`
- [ ] Messages containing `HEARTBEAT_OK` in content are collapsed by default inside a `Collapsible` with "Show heartbeat activity" `Button` trigger
- [ ] Escalated heartbeat messages (no HEARTBEAT_OK) display at full size
- [ ] `npx tsc --noEmit` passes from `frontend/`
- [ ] Verify in browser using agent-browser skill

### US-023: Frontend heartbeat component tests
**Description:** As a developer, I need unit tests for the HeartbeatSection component.

**Acceptance Criteria:**
- [ ] New file `frontend/src/tests/heartbeat/HeartbeatSection.test.tsx`
- [ ] Tests: renders collapsed when no config, shows "Active" badge when enabled, calls `onSave` with form data on Save click, calls `onTriggerTick` on Test Tick click, displays status card metrics from state, renders activity timeline entries from history
- [ ] `npm run test` passes from `frontend/`

---

### US-024: APScheduler to TaskIQ migration spec
**Description:** As a developer, I want a documented migration plan for moving existing cron schedules from APScheduler to TaskIQ Scheduler.

**Acceptance Criteria:**
- [ ] `specs/005-scheduler-migration.md` documents 4-phase migration: Phase 1 dual-mode (no work), Phase 2 TaskIQ cron support, Phase 3 data migration script with `--dry-run`, Phase 4 cleanup (remove APScheduler)
- [ ] Includes `ScheduleRepo(BaseRepo)` design for moving schedule metadata to LangGraph store
- [ ] Includes `run_scheduled_invoke` TaskIQ task design
- [ ] Documents API compatibility table (external REST contract unchanged)
- [ ] Documents rollback plan: dual-read fallback, feature flag, reverse migration script
- [ ] Documents risk assessment with mitigations (5 risks)
- [ ] **No implementation** -- spec only (already complete in `specs/005-scheduler-migration.md`)

### US-025: E2E validation -- full feature flow
**Description:** As a developer, I need end-to-end validation of the complete feature across chat, API, and UI.

**Acceptance Criteria:**
- [ ] **Schedule tools (chat)**: Log in, create schedule via chat, verify on `/schedules` page, list schedules via chat, delete schedule via chat, verify removal
- [ ] **Heartbeat API**: PUT config with enabled=true, GET state shows initial state, POST tick returns result, GET history includes escalation ticks only, DELETE config succeeds
- [ ] **Heartbeat chat**: Configure heartbeat via chat, check status via chat, disable via chat
- [ ] **Heartbeat dashboard**: Navigate to `/schedules`, toggle heartbeat on, configure all fields, save, verify status card, trigger test tick, verify activity timeline updates
- [ ] **Chat messages**: Heartbeat messages show badge, HEARTBEAT_OK collapsed, escalated expanded
- [ ] **Escalation threading**: Escalated tick creates a new thread visible in chat thread list, highlighted/pinned
- [ ] **Rate limiting**: Second escalation within 15 minutes does not create a duplicate thread
- [ ] **Docker**: `make dev.docker.ps` shows scheduler service running
- [ ] **Scheduler health**: Health check endpoint or log confirms scheduler process status
- [ ] All screenshots captured in `specs/screenshots/`
- [ ] Verify in browser using agent-browser skill

### US-026: Push changes and submit draft PR
**Description:** As a developer, I want changes pushed to the remote branch with a draft PR opened against `development`, including manual review steps in the PR description.

**Acceptance Criteria:**
- [ ] All changes committed to `feat/866-heartbeat` branch with signed commits (`git commit -s`)
- [ ] Branch pushed to remote: `git push -u origin feat/866-heartbeat`
- [ ] Draft PR opened against `development` via `gh pr create --draft`
- [ ] PR title: concise, under 70 characters
- [ ] PR description includes:
  - Summary of all changes (schedule tools, heartbeat engine, API, frontend, docker)
  - Link to PRD: `tasks/prd-heartbeat-scheduler.md`
  - Link to specs: `specs/001-005`
  - Manual E2E review steps for the human reviewer (prerequisites, schedule tool flow, heartbeat API flow, heartbeat chat flow, dashboard flow, chat badge flow, docker verification, automated tests)
- [ ] PR URL returned to user

## Functional Requirements

- FR-1: `create_schedule` tool must accept title, cron_expression, and message; build `LLMRequest` and call `ScheduleService.create_job()`
- FR-2: `list_schedules` tool must return all schedules for the authenticated user with ID, title, trigger expression, and next run time
- FR-3: `delete_schedule` tool must validate ownership via `user_id` before deletion
- FR-4: The heartbeat engine must support configurable check intervals from 5 minutes (300s) to 24 hours (86400s)
- FR-5: The heartbeat engine must skip ticks outside configured active hours with timezone support and midnight wrapping
- FR-6: The heartbeat engine must detect `HEARTBEAT_OK` token at start or end of agent response and suppress the response if remaining content <= `ack_max_chars` (default 300)
- FR-7: On escalation (no HEARTBEAT_OK or content > ack_max_chars), the system must create a new chat thread with the escalated response tagged with `source: "heartbeat"` metadata
- FR-8: `HeartbeatState` must track: `last_run_at`, `last_result`, `consecutive_ok_count` (resets to 0 on escalation), `next_due_at`, `total_ticks`, `total_escalations`
- FR-9: `HeartbeatHistory` must store only escalation results (last 100) with FIFO trimming. OK and skipped ticks are reflected in `HeartbeatState` counters only
- FR-10: TaskIQ Scheduler must manage heartbeat intervals via `ListRedisScheduleSource` with dynamic `register()` / `unregister()`
- FR-11: All 6 REST endpoints must enforce authentication via `Depends(verify_credentials)` and tag `["mcp"]`
- FR-12: `PUT /api/heartbeat` must call `register()` when enabled and `unregister()` when disabled
- FR-13: Chat tools must allow users to configure, check status, and disable heartbeat conversationally
- FR-14: The Schedules page must include a collapsible "Heartbeat Monitor" section with: toggle, agent selector, checklist editor, interval selector, active hours, save/test/disable buttons, status card, activity timeline
- FR-15: Chat messages from heartbeat ticks must show a "Heartbeat" badge and collapse HEARTBEAT_OK responses by default
- FR-16: One heartbeat configuration per user; user selects which agent runs it
- FR-17: Heartbeat agent invocation must use the cheapest available model (Haiku) with `isolated_session` and `light_context` for cost efficiency
- FR-18: Escalation rate limiting -- no more than 1 escalation per 15 minutes per user. If the agent escalates within the cooldown window, the escalation is stored in history but no new thread is created
- FR-19: Escalated heartbeat threads must be highlighted in the thread list using the best available approach (e.g., pinning, badge, or sort priority) so the user notices them
- FR-20: The FastAPI process must detect if the TaskIQ Scheduler process is unhealthy and surface an alert (e.g., health check endpoint or log warning)
- FR-21: Only escalation tick results are stored in `HeartbeatHistory`. HEARTBEAT_OK and skipped ticks update `HeartbeatState` counters but are not appended to history (reduces storage noise)

## Non-Goals

- No multiple heartbeats per user (one config per user; select which agent runs it)
- No email, SMS, Slack, or push notifications for escalations -- only new chat thread creation
- No migration of existing APScheduler cron jobs (Spec 005 is documented but not implemented)
- No heartbeat-specific permissions or RBAC beyond existing `verify_credentials`
- No custom prompt template editor in the UI (advanced users set via API `prompt` field)
- No real-time WebSocket updates for heartbeat status (polling via auto-refresh hook at 30s)
- No heartbeat analytics dashboard, cost tracking, or token usage reporting
- No dynamic checklist content (no external API pulls) -- static markdown only for v1 stability
- No heartbeat chaining (one heartbeat triggering another)

## Design Considerations

- Heartbeat section reuses existing shadcn components: `Card`, `Switch`, `Select`, `Textarea`, `Input`, `Badge`, `Collapsible`, `Button`
- Icons from `lucide-react`: `Heart`, `ChevronDown`, `Play`, `CheckCircle2`, `AlertTriangle`, `SkipForward`
- Date formatting via `date-fns` `formatDistanceToNow` for relative timestamps
- Activity timeline color scheme: green checkmark (ok), yellow warning triangle (escalated), gray skip arrow (skipped)
- Status card uses 2-col (mobile) / 4-col (desktop) responsive grid
- Heartbeat badge in chat uses red color scheme (`text-red-500 border-red-500/30`) to distinguish from other message metadata
- Collapsed HEARTBEAT_OK messages use a `Collapsible` with ghost button trigger for minimal visual noise

## Technical Considerations

- **No new dependencies**: `taskiq`, `taskiq-redis`, `date-fns`, `lucide-react`, and all shadcn components already in the project
- **LangGraph store for persistence**: Heartbeat config/state/history stored in LangGraph store via `BaseRepo` pattern with namespaces `(user_id, "heartbeat_config")`, `(user_id, "heartbeat_state")`, `(user_id, "heartbeat_history")` -- no Alembic migration needed
- **TaskIQ Scheduler process**: New Docker service (`scheduler`) runs `taskiq scheduler src.workers.scheduler:scheduler` -- lightweight, 256M memory limit, hot-reload via volume mount
- **Agent invocation**: Heartbeat ticks use cheapest model (Haiku) with `source: "heartbeat"` metadata. Isolated session (fresh thread) + light context (checklist only) reduces cost from ~100K to ~2-5K tokens per tick
- **Escalation threading**: On escalation, `scheduled_llm_invoke()` creates a new thread. The thread is tagged with `source: "heartbeat"` in metadata so the frontend can display the heartbeat badge
- **User isolation**: All repos namespaced by `user_id`. All API endpoints extract user from `verify_credentials`. All tools extract user from `RunnableConfig`
- **Coexistence**: APScheduler continues to handle existing cron schedules in the FastAPI process. TaskIQ Scheduler handles heartbeat in a separate process. Both coexist until Spec 005 migration
- **Redis persistence tradeoff**: `ListRedisScheduleSource` stores schedules in Redis (less durable than PostgreSQL). Acceptable for heartbeat because schedules are recreated on config save. Existing cron schedules remain in PostgreSQL via APScheduler

## Success Metrics

- Users can create a schedule from chat in a single conversational turn
- Heartbeat tick with HEARTBEAT_OK completes in < 5 seconds and < 5K tokens (vs ~100K for full invocation)
- Escalated heartbeat responses appear as new threads in the user's chat list within 10 seconds of tick completion
- Heartbeat dashboard loads config and state in < 1 second
- All existing schedule CRUD functionality continues to work unchanged (zero regression)

## Resolved Decisions

1. **Escalated thread highlighting** -- Use the best available approach (pinning, badge, or sort priority) to ensure escalated heartbeat threads are visible in the thread list. Implementation should rationalize the best UX pattern given existing thread list capabilities. *(FR-19)*

2. **Escalation rate limiting** -- Yes. Max 1 escalation per 15 minutes per user. If the agent escalates within the cooldown window, the result is stored in state/history but no new thread is created. Tracked via `HeartbeatState.last_escalation_at`. *(FR-18)*

3. **Checklist content** -- Static markdown only for v1. No dynamic content or external API pulls. Optimizes for stability and UX simplicity. Dynamic checklists deferred to a future iteration. *(Non-goal)*

4. **History storage** -- Escalations only. HEARTBEAT_OK and skipped ticks update `HeartbeatState` counters (`total_ticks`, `consecutive_ok_count`) but are **not** appended to `HeartbeatHistory`. Reduces storage noise while maintaining debugging visibility via state counters. *(FR-21)*

5. **Scheduler health monitoring** -- Yes. The FastAPI process must detect if the TaskIQ Scheduler is unhealthy and surface an alert via health check endpoint or log warning. *(FR-20)*

6. **Draft PR submission** -- Yes. The final step (US-026) pushes changes to `feat/866-heartbeat`, opens a draft PR against `development`, and includes manual E2E review steps in the PR description.