# Plan: Rename Epics → Workflows, Tasks → Steps

## Context

The `feat/812-task-epic-toolkit` branch delivered a complete Epic/Task CRUD system (12 user stories, all passing). The user wants to standardize on better naming:

- **Epics → Workflows** (the parent container)
- **Tasks → Steps** (the children within a workflow)

This is a mechanical rename across ~22 source files with no logic changes. Since this is a pre-release feature branch, breaking API changes and data namespace changes are acceptable.

### Critical Safety Note

There is a **separate A2A Task system** in `backend/src/common/types.py` and `backend/src/common/server/task_manager.py` that uses `Task`, `TaskStatus`, `TaskManager` etc. for agent-to-agent communication. These must **NOT** be renamed — they are completely separate from the Epic/Task feature.

Similarly, the frontend `schedule.ts` has a `.task` property for scheduled execution config — also unrelated.

---

## User Stories

### US-001: Backend Schema Rename
**File:** `backend/src/schemas/entities/store.py`

| Line | Old | New |
|------|-----|-----|
| 52 | `class Epic(BaseEntity)` | `class Workflow(BaseEntity)` |
| 58 | `class EpicUpdate(BaseModel)` | `class WorkflowUpdate(BaseModel)` |
| 59 | docstring "epic updates" | "workflow updates" |
| 66 | `class Task(BaseEntity)` | `class Step(BaseEntity)` |
| 67 | `epic_id: str` | `workflow_id: str` |
| 75 | `class TaskUpdate(BaseModel)` | `class StepUpdate(BaseModel)` |
| 76 | docstring "task updates" | "step updates" |

**AC:** `Workflow`, `WorkflowUpdate`, `Step`, `StepUpdate` importable from `store.py`; no `Epic`/`Task` (feature) refs remain.

---

### US-002: Backend Repositories Rename
**Files:**
- `backend/src/repos/epic_repo.py` → **git mv** to `workflow_repo.py`
- `backend/src/repos/task_repo.py` → **git mv** to `step_repo.py`
- `backend/src/repos/base_repo.py` (modify)

**workflow_repo.py:** `EpicRepo` → `WorkflowRepo`, entity_type `"workflows"`, all `epic` vars → `workflow`, `Epic` → `Workflow`

**step_repo.py:** `TaskRepo` → `StepRepo`, entity_type `"steps"`, `list_by_epic()` → `list_by_workflow()`, param `epic_id` → `workflow_id`, metadata key `{"epic_id": ...}` → `{"workflow_id": ...}`, `Task` → `Step`

**base_repo.py:**
- Import `Workflow` instead of `Epic`, `Step` instead of `Task`
- `_format()`: `"epics"` → `"workflows"` with `Workflow.model_validate`, `"tasks"` → `"steps"` with `Step.model_validate`

**AC:** `WorkflowRepo`, `StepRepo` importable; entity types are `"workflows"` and `"steps"`.

---

### US-003: Backend Service Rename
**File:** `backend/src/services/epic.py` → **git mv** to `workflow.py`

- `EpicService` → `WorkflowService`
- `self.epic_repo` → `self.workflow_repo` (`WorkflowRepo`)
- `self.task_repo` → `self.step_repo` (`StepRepo`)
- Methods: `create_epic` → `create_workflow`, `get_epic` → `get_workflow`, `search_epics` → `search_workflows`, `update_epic` → `update_workflow`, `delete_epic` → `delete_workflow`
- Task methods: `create_task` → `create_step`, `list_tasks` → `list_steps`, `update_task` → `update_step`, `delete_task` → `delete_step`
- Internal call: `list_by_epic` → `list_by_workflow`
- Comments: `# Epic Methods` → `# Workflow Methods`, `# Task Methods` → `# Step Methods`

**AC:** `WorkflowService` importable with all renamed methods.

---

### US-004: Backend Tools Rename
**File:** `backend/src/tools/epic.py` → **git mv** to `workflow.py`

- `_get_epic_service()` → `_get_workflow_service()` returning `WorkflowService`
- Tool renames:

| Old | New |
|-----|-----|
| `create_epic` | `create_workflow` |
| `list_epics` | `list_workflows` |
| `update_epic` | `update_workflow` |
| `delete_epic` | `delete_workflow` |
| `create_task` | `create_step` |
| `list_tasks` | `list_steps` |
| `update_task` | `update_step` |
| `delete_task` | `delete_step` |
| `assign_task` | `assign_step` |
| `search_tasks` | `search_steps` |
| `start_epic_execution` | `start_workflow_execution` |

- `EPIC_TOOLS` → `WORKFLOW_TOOLS`
- All docstrings: "epic" → "workflow", "task" → "step", "Toolkit: Epic Management" → "Toolkit: Workflow Management"
- All params: `epic_id` → `workflow_id`, `task_id` → `step_id`

**AC:** `WORKFLOW_TOOLS` list with 11 tools exported; all tool names and docstrings updated.

---

### US-005: Backend Routes Rename
**Directory:** `backend/src/routes/v0/epic/` → **git mv** to `workflow/`

- Router prefix: `/epics` → `/workflows`, tag `"Workflow"`
- `task_router` → `step_router`, prefix `/tasks` → `/steps`, tag `"Step"`
- Endpoint function renames: `search_epics` → `search_workflows`, `create_epic` → `create_workflow`, etc.
- Task endpoints: `create_task` → `create_step`, `list_tasks` → `list_steps`, etc.
- Operation IDs: `ruska_search_epics` → `ruska_search_workflows`, `ruska_create_task` → `ruska_create_step`, etc.
- Path params: `epic_id` → `workflow_id`, `task_id` → `step_id`
- Request bodies: `Epic`/`EpicUpdate` → `Workflow`/`WorkflowUpdate`, `Task`/`TaskUpdate` → `Step`/`StepUpdate`
- Response keys: `{"epics": ...}` → `{"workflows": ...}`, `{"tasks": ...}` → `{"steps": ...}`
- Service: `service_context.epic_service` → `service_context.workflow_service`

**API paths after rename:**
- `POST /api/workflows/search` — search workflows
- `POST /api/workflows` — create workflow
- `GET /api/workflows/{workflow_id}` — get workflow
- `PUT /api/workflows/{workflow_id}` — update workflow
- `DELETE /api/workflows/{workflow_id}` — delete workflow
- `POST /api/workflows/{workflow_id}/steps` — create step
- `GET /api/workflows/{workflow_id}/steps` — list steps
- `PUT /api/workflows/{workflow_id}/steps/{step_id}` — update step
- `DELETE /api/workflows/{workflow_id}/steps/{step_id}` — delete step
- `POST /api/steps/search` — search steps

**AC:** API prefix is `/workflows` and `/steps`; all operation IDs updated.

---

### US-006: Backend Registration & Wiring
**Files:**
- `backend/src/tools/__init__.py` — import `WORKFLOW_TOOLS` from `src.tools.workflow`
- `backend/src/utils/tools.py` — import `WORKFLOW_TOOLS`, tag `"workflow"` instead of `"epic"`
- `backend/src/contexts/service.py` — import `WorkflowService`, property `workflow_service`
- `backend/src/routes/v0/__init__.py` — import from `.workflow`, rename vars: `epic` → `workflow`, `task` → `step`

**AC:** `make format` and `make lint` pass; backend starts without import errors.

---

### US-007: Frontend Entities & Services Rename
**Files:**
- `frontend/src/lib/entities/epic.ts` → **rename** to `workflow.ts`
- `frontend/src/lib/services/epicService.ts` → **rename** to `workflowService.ts`

**workflow.ts:** `Epic` → `Workflow`, `Task` → `Step`, `TaskSearchResult` → `StepSearchResult`, `epic_id` → `workflow_id`

**workflowService.ts:** `EpicService` → `WorkflowService`, `BASE_URL = "/workflows"`, all `epicId` → `workflowId`, all `task`/`Task` → `step`/`Step`, response keys updated, export `workflowService` singleton

**AC:** `Workflow`, `Step`, `WorkflowService` exported correctly.

---

### US-008: Frontend Hooks & Context Rename
**Files:**
- `frontend/src/hooks/useEpic.ts` → **rename** to `useWorkflow.ts`
- `frontend/src/context/EpicContext.tsx` → **rename** to `WorkflowContext.tsx`

**useWorkflow.ts:**
- `useEpic()` → `useWorkflow()`, `EpicState` → `WorkflowState`
- State: `epics`/`selectedEpic`/`tasks` → `workflows`/`selectedWorkflow`/`steps`
- Handlers: `handleGetEpics` → `handleGetWorkflows`, `handleCreateEpic` → `handleCreateWorkflow`, `handleGetTasks` → `handleGetSteps`, `handleCreateTask` → `handleCreateStep`, etc.
- All `EpicService` → `WorkflowService` calls, response keys updated

**WorkflowContext.tsx:** `EpicContext` → `WorkflowContext`, `EpicProvider` → `WorkflowProvider`, `useEpicContext` → `useWorkflowContext`

**AC:** `useWorkflow`, `WorkflowProvider`, `useWorkflowContext` exported.

---

### US-009: Frontend Pages Rename
**Directory:** `frontend/src/pages/epics/` → **rename** to `workflows/`

**workflows/index.tsx:** `EpicIndexPage` → `WorkflowIndexPage`, all UI text "Epics"→"Workflows", "Tasks"→"Steps", navigation `/workflows/...`

**workflows/WorkflowDetailPage.tsx** (from `EpicDetailPage.tsx`): `EpicDetailPage` → `WorkflowDetailPage`, all "epic"→"workflow", "task"→"step" in state/service/UI text, `CreateTaskModal` → `CreateStepModal`

**AC:** All UI text shows "Workflows" and "Steps"; navigation targets `/workflows`.

---

### US-010: Frontend Components & Routing Rename
**Files:**
- `frontend/src/components/modals/CreateEpicModal.tsx` → **rename** to `CreateWorkflowModal.tsx`
- `frontend/src/components/modals/CreateTaskModal.tsx` → **rename** to `CreateStepModal.tsx`
- `frontend/src/components/drawers/app-sidebar.tsx` — label "Workflows", link `/workflows`
- `frontend/src/routes/AppRoutes.tsx` — imports + paths `/workflows`, `/workflows/:id`
- `frontend/src/main.tsx` — `WorkflowProvider` import + usage

**AC:** Sidebar shows "Workflows"; routes `/workflows` and `/workflows/:id` work; app builds.

---

### US-011: Verification & Cleanup

1. `cd backend && make format && make lint` — Python formatting/lint
2. `cd frontend && npx tsc --noEmit` — TypeScript typecheck
3. `make test` — Backend tests pass
4. Clean stale `__pycache__` under old `epic/` directories
5. Verify `git status` shows proper renames
6. Grep for any remaining "epic" or "task" (feature-related) references

**AC:** All checks pass; no feature-related "epic"/"task" references remain in source (excluding `.ralph/` history and A2A system).

---

## DO NOT RENAME (Safety Boundaries)

| File | Reason |
|------|--------|
| `backend/src/common/types.py` (Task, TaskStatus, etc.) | A2A communication protocol |
| `backend/src/common/server/task_manager.py` | A2A task management |
| `frontend/src/lib/entities/schedule.ts` (.task property) | Schedule execution config |
| `frontend/src/components/forms/AgentScheduleForm.tsx` | Schedule task config |
| `frontend/src/components/cards/AgentScheduleCard.tsx` | Schedule task display |
| `frontend/src/components/lists/TodoList.tsx` | Generic progress tracker |
| `backend/tests/unit/workers/test_tasks.py` | Worker queue tests |

---

## Execution Order

```
US-001 (schemas) → US-002 (repos) → US-003 (service) → US-004 (tools)
→ US-005 (routes) → US-006 (wiring) → US-007 (frontend entities)
→ US-008 (hooks/context) → US-009 (pages) → US-010 (components/routing)
→ US-011 (verification)
```

Each story depends on the prior one compiling cleanly. Use `git mv` for all file/directory renames to preserve history.

## Verification

1. **Backend:** `make format`, `make lint`, `make test`
2. **Frontend:** `npx tsc --noEmit`
3. **Runtime:** Start backend → confirm `/api/workflows` and `/api/steps` in Swagger; start frontend → confirm sidebar "Workflows", page navigation, step management
