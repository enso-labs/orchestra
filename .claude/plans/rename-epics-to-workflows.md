# Plan: Rename "Epics" to "Workflows"

## Context

The `feat/812-task-epic-toolkit` branch implemented a full Epic/Task CRUD system across backend and frontend (12 user stories, all passing). The user feels "workflows" is a better naming convention than "epics" for this feature. This is a mechanical rename across ~22 source files with no logic changes. Since this is a pre-release feature branch, there is no production data to migrate and breaking API changes are acceptable.

## Scope

**What changes:** Every reference to "epic/epics/Epic" becomes "workflow/workflows/Workflow" in class names, file names, directory names, variable names, function names, API paths, UI text, and tool names. The `Task` model's `epic_id` field becomes `workflow_id`.

**What stays the same:** All Task-related naming (Task, TaskUpdate, TaskRepo, task tools) remains unchanged. All business logic is identical.

---

## User Stories

### US-001: Backend Schema Rename
**File:** `backend/src/schemas/entities/store.py`

**Changes:**
- `class Epic` -> `class Workflow` (line 52)
- `class EpicUpdate` -> `class WorkflowUpdate` (line 58), update docstring
- `Task.epic_id: str` -> `Task.workflow_id: str` (line 67)

**AC:** `Workflow`, `WorkflowUpdate` importable; `Task` has `workflow_id` field; no `Epic` references remain.

---

### US-002: Backend Repositories Rename
**Files:**
- `backend/src/repos/epic_repo.py` -> **rename to** `workflow_repo.py`
- `backend/src/repos/task_repo.py` (modify)
- `backend/src/repos/base_repo.py` (modify)

**Changes in `workflow_repo.py`:**
- `EpicRepo` -> `WorkflowRepo`, `entity_type="workflows"`, all `epic` params/vars -> `workflow`, `Epic` -> `Workflow`

**Changes in `task_repo.py`:**
- `list_by_epic()` -> `list_by_workflow()`, param `epic_id` -> `workflow_id`
- Metadata key: `{"epic_id": task.epic_id}` -> `{"workflow_id": task.workflow_id}`
- Filter: `{"epic_id": epic_id}` -> `{"workflow_id": workflow_id}`

**Changes in `base_repo.py`:**
- Import `Workflow` instead of `Epic`
- `_format()`: `"epics"` case -> `"workflows"`, `Epic.model_validate` -> `Workflow.model_validate`

**AC:** `WorkflowRepo` importable; `TaskRepo.list_by_workflow()` exists; `_format()` handles `"workflows"`.

---

### US-003: Backend Service Rename
**File:** `backend/src/services/epic.py` -> **rename to** `workflow.py`

**Changes:**
- `EpicService` -> `WorkflowService`
- `self.epic_repo = EpicRepo(...)` -> `self.workflow_repo = WorkflowRepo(...)`
- Methods: `create_epic` -> `create_workflow`, `get_epic` -> `get_workflow`, `search_epics` -> `search_workflows`, `update_epic` -> `update_workflow`, `delete_epic` -> `delete_workflow`
- Internal calls: `list_by_epic` -> `list_by_workflow`
- Imports from `workflow_repo` and `Workflow` model

**AC:** `WorkflowService` importable with all renamed methods.

---

### US-004: Backend Tools Rename
**File:** `backend/src/tools/epic.py` -> **rename to** `workflow.py`

**Changes:**
- `_get_epic_service()` -> `_get_workflow_service()`, returns `WorkflowService`
- Tool renames: `create_epic` -> `create_workflow`, `list_epics` -> `list_workflows`, `update_epic` -> `update_workflow`, `delete_epic` -> `delete_workflow`, `start_epic_execution` -> `start_workflow_execution`
- Task tools (unchanged names): update `epic_id` params -> `workflow_id`, `_get_epic_service` -> `_get_workflow_service`
- `search_tasks` return dict: `"epic_id"` key -> `"workflow_id"`
- `EPIC_TOOLS` -> `WORKFLOW_TOOLS`
- All docstrings: "epic" -> "workflow", "Toolkit: Epic Management" -> "Toolkit: Workflow Management"

**AC:** `WORKFLOW_TOOLS` list with 11 tools exported; all tool names and docstrings updated.

---

### US-005: Backend Routes Rename
**Directory:** `backend/src/routes/v0/epic/` -> **rename to** `workflow/`

**Changes in `workflow/__init__.py`:**
- Router prefix: `/epics` -> `/workflows`, tag: `"Epic"` -> `"Workflow"`
- All endpoint functions: `search_epics` -> `search_workflows`, `create_epic` -> `create_workflow`, etc.
- Operation IDs: `ruska_search_epics` -> `ruska_search_workflows`, etc.
- Path params: `epic_id` -> `workflow_id`
- Request bodies: `epic: Epic` -> `workflow: Workflow`, `epic: EpicUpdate` -> `workflow: WorkflowUpdate`
- Response keys: `{"epics": ...}` -> `{"workflows": ...}`, `{"epic": ...}` -> `{"workflow": ...}`, `{"epic_id": ...}` -> `{"workflow_id": ...}`
- Service access: `service_context.epic_service` -> `service_context.workflow_service`
- Task endpoints: `/{epic_id}/tasks` -> `/{workflow_id}/tasks`
- Task search response: `"epic_id"` -> `"workflow_id"`

**AC:** API prefix is `/workflows`; all operation IDs use "workflow".

---

### US-006: Backend Registration & Wiring
**Files:**
- `backend/src/tools/__init__.py` - import `WORKFLOW_TOOLS` from `src.tools.workflow`
- `backend/src/utils/tools.py` - import `WORKFLOW_TOOLS`, tag `"workflow"` instead of `"epic"`
- `backend/src/contexts/service.py` - import `WorkflowService`, property `workflow_service`
- `backend/src/routes/v0/__init__.py` - import from `.workflow`, variable `workflow` instead of `epic`

**AC:** `make format` and `make lint` pass; backend starts without import errors.

---

### US-007: Frontend Entities & Services Rename
**Files:**
- `frontend/src/lib/entities/epic.ts` -> **rename to** `workflow.ts`
- `frontend/src/lib/services/epicService.ts` -> **rename to** `workflowService.ts`

**Changes in `workflow.ts`:**
- `interface Epic` -> `interface Workflow`
- `Task.epic_id` -> `Task.workflow_id`
- `TaskSearchResult.epic_id` -> `TaskSearchResult.workflow_id`

**Changes in `workflowService.ts`:**
- `EpicService` -> `WorkflowService`, `BASE_URL = "/workflows"`
- All `epicId` params -> `workflowId`
- Export: `workflowService` singleton

**AC:** `Workflow` interface and `WorkflowService` class exported.

---

### US-008: Frontend Hooks & Context Rename
**Files:**
- `frontend/src/hooks/useEpic.ts` -> **rename to** `useWorkflow.ts`
- `frontend/src/context/EpicContext.tsx` -> **rename to** `WorkflowContext.tsx`

**Changes in `useWorkflow.ts`:**
- `useEpic()` -> `useWorkflow()`, `EpicState` -> `WorkflowState`
- State: `epics`/`selectedEpic` -> `workflows`/`selectedWorkflow`
- Handlers: `handleGetEpics` -> `handleGetWorkflows`, `handleCreateEpic` -> `handleCreateWorkflow`, etc.
- All `EpicService` -> `WorkflowService` calls
- Response keys: `.data.epics` -> `.data.workflows`, `.data.epic` -> `.data.workflow`

**Changes in `WorkflowContext.tsx`:**
- `EpicContext` -> `WorkflowContext`, `EpicProvider` -> `WorkflowProvider`, `useEpicContext` -> `useWorkflowContext`

**AC:** `useWorkflow`, `WorkflowProvider`, `useWorkflowContext` exported.

---

### US-009: Frontend Pages Rename
**Directory:** `frontend/src/pages/epics/` -> **rename to** `workflows/`

**Changes in `workflows/index.tsx`:**
- `EpicIndexPage` -> `WorkflowIndexPage`
- All `useEpicContext()` -> `useWorkflowContext()`
- UI text: "Epics" -> "Workflows", "epic" -> "workflow" everywhere
- Navigation: `/epics/...` -> `/workflows/...`
- `CreateEpicModal` -> `CreateWorkflowModal`

**Changes in `workflows/WorkflowDetailPage.tsx` (renamed from `EpicDetailPage.tsx`):**
- `EpicDetailPage` -> `WorkflowDetailPage`
- All service calls, state vars, UI text, navigation updated

**AC:** All UI text shows "Workflows"; navigation targets `/workflows`.

---

### US-010: Frontend Components & Routing Rename
**Files:**
- `frontend/src/components/modals/CreateEpicModal.tsx` -> **rename to** `CreateWorkflowModal.tsx`
- `frontend/src/components/modals/CreateTaskModal.tsx` (modify: `epicId` prop -> `workflowId`)
- `frontend/src/components/drawers/app-sidebar.tsx` (label "Workflows", link `/workflows`)
- `frontend/src/routes/AppRoutes.tsx` (imports + paths `/workflows`, `/workflows/:id`)
- `frontend/src/main.tsx` (`WorkflowProvider` import + usage)

**AC:** Sidebar shows "Workflows"; routes `/workflows` and `/workflows/:id` work; app builds.

---

### US-011: Verification & Cleanup

**Steps:**
1. `cd backend && make format && make lint` - Python formatting/lint
2. `cd frontend && npx tsc --noEmit` - TypeScript typecheck
3. `make test` - Backend tests pass (no epic-specific tests exist)
4. Clean stale `__pycache__` under old `epic/` directories
5. Verify `git status` shows proper renames via `git mv`
6. Commit all changes

**AC:** All checks pass; no references to "epic" remain in source files (excluding `.ralph/` history).

---

## Execution Strategy

- Use `git mv` for all file/directory renames to preserve git history
- Execute sequentially: schemas -> repos -> service -> tools -> routes -> wiring -> frontend entities -> hooks -> pages -> components -> verify
- Each story depends on the prior one compiling cleanly

## Verification

1. **Backend:** `make format`, `make lint`, `make test`
2. **Frontend:** `npx tsc --noEmit`
3. **Runtime:** Start backend (`make dev`), confirm `/api/workflows` in Swagger; start frontend, confirm sidebar "Workflows" link and page navigation
