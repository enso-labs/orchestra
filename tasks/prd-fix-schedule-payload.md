# PRD: Fix Schedule Create/Update Payload to Match Backend Schema

## Introduction

The frontend schedule creation and update flows send a payload structure that does not match the backend's `LLMRequest` Pydantic model, resulting in a **422 Unprocessable Entity** error. The backend expects `task.input.messages` (messages nested inside an `input` object) but the frontend sends `task.messages` directly. Additionally, field name mismatches (`system` vs `system_prompt`) and metadata structure differences need to be resolved.

**Root Cause:** PR #721 simplified the backend schedule route to use the standard `LLMRequest` schema, which requires a nested `input: LLMInput` field containing `messages`. The frontend was never updated to match.

## Goals

- Eliminate the 422 error when creating or updating schedules
- Align the frontend `ScheduleCreate` TypeScript interface with the backend `LLMRequest` Pydantic model
- Fix field name mismatches (`system` → `system_prompt`)
- Align metadata fields with the backend `Config` schema (`assistant_id`, `user_id`, `thread_id`, etc.)
- Maintain backward compatibility with existing schedule display/read flows

## User Stories

### US-001: Update ScheduleCreate TypeScript Interface
**Description:** As a developer, I need the `ScheduleCreate` interface to match the backend `LLMRequest` schema so TypeScript catches payload mismatches at compile time.

**Acceptance Criteria:**
- [ ] `ScheduleCreate.task` has a required `input` field of type `{ messages: Array<{ role: string; content: string }>; files?: Record<string, any> }`
- [ ] `ScheduleCreate.task` uses `system_prompt` instead of `system`
- [ ] `ScheduleCreate.task.metadata` typed with known `Config` fields: `user_id`, `thread_id`, `checkpoint_id`, `assistant_id`, `project_id`, `graph_id` (all optional) plus `[key: string]: any` for extra fields
- [ ] `Schedule` read interface updated to also reflect `task.input` nesting
- [ ] Typecheck passes (`npx tsc --noEmit` from frontend directory)

### US-002: Update AgentScheduleForm Payload Construction
**Description:** As a user, I want schedule creation to succeed so I can automate agent tasks on a cron schedule.

**Acceptance Criteria:**
- [ ] `handleFormSubmit` in `AgentScheduleForm.tsx` wraps `messages` inside `task.input: { messages: [...] }`
- [ ] `system` field renamed to `system_prompt` in the constructed payload
- [ ] `metadata` includes `assistant_id` mapped from `agent.id` (or `agent.metadata.assistant_id` if available)
- [ ] Custom metadata keys (`schedule_description`, `inherited_from_agent`, `enabled`, `agent_id`) preserved as extra fields
- [ ] Typecheck passes

### US-003: Update Schedule Page Create/Edit Handlers
**Description:** As a developer, I need the schedule page handlers to pass the correctly structured payload through to the service layer.

**Acceptance Criteria:**
- [ ] `handleCreateSchedule` in `schedules/index.tsx` adds `agent_id` into metadata correctly with the new structure
- [ ] `handleEditSchedule` (if it reconstructs the payload) uses the same `task.input` nesting
- [ ] Edit form pre-population reads `messages` from `task.input.messages` (not `task.messages`)
- [ ] Typecheck passes

### US-004: Verify End-to-End Schedule CRUD
**Description:** As a user, I want to create, view, and edit schedules without errors.

**Acceptance Criteria:**
- [ ] POST `/api/schedules` returns 201 (not 422) with the new payload structure
- [ ] Created schedule appears in the schedule list
- [ ] Edit schedule dialog pre-populates correctly from the stored schedule
- [ ] PUT `/api/schedules/{id}` succeeds without 422
- [ ] Typecheck and lint pass
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- FR-1: `ScheduleCreate.task.input` must be an object containing `messages` array (required) and optional `files` dict
- FR-2: `ScheduleCreate.task.system_prompt` replaces the current `system` field
- FR-3: `ScheduleCreate.task.metadata` must include backend `Config` known fields (`user_id`, `thread_id`, `checkpoint_id`, `assistant_id`, `project_id`, `graph_id`) as optional properties
- FR-4: The `AgentScheduleForm` must construct the payload with `task.input.messages` nesting
- FR-5: The schedule page edit flow must read `task.input.messages` when pre-populating the form
- FR-6: All existing schedule display components (sidebar, table, calendar) must handle the updated `Schedule` interface

## Non-Goals

- No backend changes — the backend schema is correct as-is
- No changes to the schedule trigger/cron logic
- No changes to the `useScheduleExecutions` hook or execution-related features
- No new UI components or visual changes

## Technical Considerations

- **Backend schema reference:** `backend/src/schemas/entities/llm.py` — `LLMRequest` (line 201), `LLMInput` (line 48), `Config` (line 25)
- **Backend example:** `backend/src/constants/examples/__init__.py` — `SCHEDULE_CREATE_ASSISTANT_EXAMPLE` (line 457) shows the correct payload shape
- **Frontend files to modify:**
  - `frontend/src/lib/entities/schedule.ts` — interfaces
  - `frontend/src/components/forms/AgentScheduleForm.tsx` — payload construction (lines 93-123)
  - `frontend/src/pages/schedules/index.tsx` — create/edit handlers and form pre-population
- **Backend `Config` model uses `extra="allow"`**, so custom frontend metadata keys (`schedule_description`, `inherited_from_agent`, `enabled`, `agent_id`) will pass validation
- **Backend `LLMInput` model uses `extra="allow"`**, so the `input` object can carry additional fields if needed

## Success Metrics

- Schedule creation returns 201 instead of 422
- Schedule editing succeeds without validation errors
- Zero TypeScript compilation errors related to schedule types

## Open Questions

- Should the `Schedule` read interface match the backend response exactly, or should we add a frontend adapter/mapper to flatten `task.input.messages` back to `task.messages` for display convenience?
