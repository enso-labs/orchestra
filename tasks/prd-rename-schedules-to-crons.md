# PRD: Rename Schedules to Crons

## Introduction

The codebase currently uses "schedule/schedules" terminology for the cron job feature. This should be renamed to "cron/crons" for clarity and consistency. This is a pure naming convention change with no functional behavior changes.

## Goals

- Rename all occurrences of schedule/Schedule/schedules/Schedules to cron/Cron/crons/Crons
- Maintain full functionality — zero behavioral changes
- Update database table name via migration

## User Stories

### US-001: Rename backend schema and entities
**Description:** As a developer, I want the backend data models to use "cron" naming so the terminology is consistent.

**Acceptance Criteria:**
- [ ] `backend/src/schemas/entities/schedule.py` renamed to `cron.py`
- [ ] All classes renamed: `Schedule*` → `Cron*`
- [ ] `__init__.py` imports updated in `backend/src/schemas/entities/`
- [ ] Typecheck passes

### US-002: Rename backend service
**Description:** As a developer, I want the service layer to use "cron" naming.

**Acceptance Criteria:**
- [ ] `backend/src/services/schedule.py` renamed to `cron.py`
- [ ] `schedule_service` → `cron_service` everywhere
- [ ] All method names updated: `*_schedule*` → `*_cron*`
- [ ] `backend/src/contexts/service.py` updated: `schedule_service` field → `cron_service`
- [ ] Typecheck passes

### US-003: Rename backend routes and API endpoints
**Description:** As a developer, I want the API endpoints to use `/crons` instead of `/schedules`.

**Acceptance Criteria:**
- [ ] `backend/src/routes/v0/schedule.py` renamed to `cron.py`
- [ ] All endpoint paths changed: `/schedules` → `/crons`, `/schedule` → `/cron`
- [ ] `backend/src/routes/v0/__init__.py` updated: import + router registration
- [ ] Typecheck passes

### US-004: Update remaining backend references
**Description:** As a developer, I want all other backend files referencing "schedule" updated.

**Acceptance Criteria:**
- [ ] `backend/src/workers/tasks.py` — schedule references updated
- [ ] `backend/src/controllers/llm.py` — schedule references updated
- [ ] `backend/src/constants/examples/__init__.py` — schedule references updated
- [ ] `backend/src/services/checkpoint_resilient.py` — schedule references updated
- [ ] No remaining "schedule" references in backend/src/ (grep confirms)
- [ ] Typecheck passes

### US-005: Create database migration
**Description:** As a developer, I need the database table renamed from `schedules` to `crons`.

**Acceptance Criteria:**
- [ ] Migration created to rename table `schedules` → `crons`
- [ ] Migration is reversible
- [ ] Migration runs without error

### US-006: Rename frontend entities, services, and utils
**Description:** As a developer, I want the frontend data layer to use "cron" naming.

**Acceptance Criteria:**
- [ ] `frontend/src/lib/entities/schedule.ts` renamed to `cron.ts`, types renamed
- [ ] `frontend/src/lib/services/scheduleService.ts` renamed to `cronService.ts`, API paths updated to `/crons`
- [ ] `frontend/src/lib/utils/schedule.ts` renamed to `cron.ts`
- [ ] All imports updated across consuming files
- [ ] Typecheck passes

### US-007: Rename frontend hooks
**Description:** As a developer, I want the React hooks to use "cron" naming.

**Acceptance Criteria:**
- [ ] `useSchedules.ts` → `useCrons.ts`
- [ ] `useAgentSchedules.ts` → `useAgentCrons.ts`
- [ ] `useScheduleExecutions.ts` → `useCronExecutions.ts`
- [ ] React Query keys updated from "schedule" to "cron"
- [ ] All imports updated across consuming files
- [ ] Typecheck passes

### US-008: Rename frontend components
**Description:** As a developer, I want the UI components to use "cron" naming.

**Acceptance Criteria:**
- [ ] `ScheduleCalendar.tsx` → `CronCalendar.tsx`
- [ ] `ScheduleTable.tsx` → `CronTable.tsx`
- [ ] `AgentScheduleCard.tsx` → `AgentCronCard.tsx`
- [ ] `AgentScheduleList.tsx` → `AgentCronList.tsx`
- [ ] `ScheduleSidebarItem.tsx` → `CronSidebarItem.tsx`
- [ ] `AgentSchedulesPanel.tsx` → `AgentCronsPanel.tsx`
- [ ] `AgentScheduleForm.tsx` → `AgentCronForm.tsx`
- [ ] All internal references and exports renamed
- [ ] Typecheck passes

### US-009: Rename frontend pages and routes
**Description:** As a developer, I want the page routes to use `/crons` instead of `/schedules`.

**Acceptance Criteria:**
- [ ] `frontend/src/pages/schedules/` directory renamed to `crons/`
- [ ] `AppRoutes.tsx` updated: `/schedules` → `/crons`
- [ ] `app-sidebar.tsx` updated: sidebar label + import
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-010: Update tests and final validation
**Description:** As a developer, I want all tests passing and no remaining "schedule" references.

**Acceptance Criteria:**
- [ ] `frontend/src/lib/utils/calendar.test.ts` — schedule references updated
- [ ] Any other test files referencing "schedule" updated
- [ ] `grep -r "schedule" frontend/src/ backend/src/` returns no hits (excluding CronBuilder internals and third-party cron expression handling)
- [ ] All tests pass: `npm test` in frontend
- [ ] Verify in browser using agent-browser skill

### US-011: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] `git status` shows clean workspace (no uncommitted changes)
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
