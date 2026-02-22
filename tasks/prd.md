# PRD: Task/Epic CRUD Toolkit with Subagent Assignment

**Issue:** #812
**PR:** #813
**Branch:** `feat/812-task-epic-toolkit`

---

## User Stories

### US-001: Epic and Task Pydantic Models
**Priority:** 1
**Description:** As a developer, I need data models for Epics and Tasks so they can be persisted in BaseStore.

**Acceptance Criteria:**
- Add `Epic` model to `store.py` with fields: id, name, description, status, metadata, created_at, updated_at
- Add `Task` model to `store.py` with fields: id, epic_id, title, description, status (todo/in_progress/done/blocked), assignee, blockers (list[str]), metadata, created_at, updated_at
- Add `EpicUpdate` and `TaskUpdate` partial update schemas
- Typecheck passes

---

### US-002: Epic Repository
**Priority:** 2
**Description:** As a developer, I need a repository for Epic CRUD operations using BaseStore.

**Acceptance Criteria:**
- Create `backend/src/repos/epic_repo.py` extending `BaseRepo` with entity_type `"epics"`
- Implement `create`, `update`, `search`, `delete` methods following `ProjectRepo` pattern
- Namespace: `(user_id, "epics")`
- Typecheck passes

---

### US-003: Task Repository
**Priority:** 3
**Description:** As a developer, I need a repository for Task CRUD with epic-scoped filtering.

**Acceptance Criteria:**
- Create `backend/src/repos/task_repo.py` extending `BaseRepo` with entity_type `"tasks"`
- Tasks stored with `epic_id` in metadata for filtering
- `list_by_epic(epic_id)` method filters tasks by epic_id
- `create`, `update`, `delete` methods following existing patterns
- Typecheck passes

---

### US-004: Epic Service
**Priority:** 4
**Description:** As a developer, I need a service layer for epic/task business logic.

**Acceptance Criteria:**
- Create `backend/src/services/epic.py` with `EpicService` class
- Methods: `create_epic`, `get_epic`, `search_epics`, `update_epic`, `delete_epic` (cascade deletes tasks)
- Methods: `create_task`, `get_task`, `list_tasks`, `update_task`, `delete_task`
- Register `EpicService` in `ServiceContext` (`backend/src/contexts/service.py`)
- Typecheck passes

---

### US-005: Epic/Task Agent Tools
**Priority:** 5
**Description:** As an agent user, I want tools to manage epics and tasks from chat.

**Acceptance Criteria:**
- Create `backend/src/tools/epic.py` with LangChain `@tool` decorated functions
- Tools: `create_epic`, `list_epics`, `update_epic`, `delete_epic`
- Tools: `create_task`, `list_tasks`, `update_task`, `delete_task`
- Tool: `assign_task` — set assignee on a task
- All tools use `ToolRuntime` for user context (follows `search_threads` pattern)
- Export `EPIC_TOOLS` list
- Register in `backend/src/tools/__init__.py` → `default_tools()`
- Typecheck passes

---

### US-006: Task Semantic Search Tool
**Priority:** 6
**Description:** As an agent user, I want to search tasks by semantic similarity.

**Acceptance Criteria:**
- Create `search_tasks` tool in `backend/src/tools/task_search.py` (or add to epic.py)
- Searches across all user tasks by title+description semantic similarity
- Returns task_id, title, status, epic_id, score
- Follows `search_threads` pattern exactly
- Register in `default_tools()`
- Typecheck passes

---

### US-007: Epic REST API Endpoints
**Priority:** 7
**Description:** As a frontend developer, I need REST endpoints for epic/task management.

**Acceptance Criteria:**
- Create `backend/src/routes/v0/epic/__init__.py` with router prefix `/epics`
- Endpoints: POST `/epics` (create), POST `/epics/search` (list/search), GET `/epics/{id}` (get with tasks), PUT `/epics/{id}` (update), DELETE `/epics/{id}` (delete)
- Endpoints: POST `/epics/{id}/tasks` (create task), GET `/epics/{id}/tasks` (list tasks), PUT `/epics/{id}/tasks/{task_id}` (update task), DELETE `/epics/{id}/tasks/{task_id}` (delete task)
- Endpoint: POST `/tasks/search` (semantic search)
- Register router in `backend/src/routes/v0/__init__.py`
- All endpoints require auth via `verify_credentials`
- Typecheck passes

---

### US-008: Frontend Epic Service and Context
**Priority:** 8
**Description:** As a frontend developer, I need API client and React context for epics/tasks.

**Acceptance Criteria:**
- Create `frontend/src/lib/services/epicService.ts` with API client functions for all epic/task endpoints
- Create `frontend/src/context/EpicContext.tsx` with provider, state management, and hooks
- Types: `Epic`, `Task` TypeScript interfaces matching backend models
- Typecheck passes

---

### US-009: Epic List Page
**Priority:** 9
**Description:** As a user, I want to view and manage my epics from a dedicated page.

**Acceptance Criteria:**
- Create `frontend/src/pages/epics/index.tsx` — epic list view
- Shows epic name, description, task count, status summary
- Create epic button/modal
- Delete epic with confirmation
- Add "Epics" entry to app sidebar (`app-sidebar.tsx`) with `FolderKanban` icon
- Add route `/epics` in `AppRoutes.tsx`
- Typecheck passes
- Verify in browser using agent-browser skill

---

### US-010: Epic Detail Page with Task Management
**Priority:** 10
**Description:** As a user, I want to view and manage tasks within an epic.

**Acceptance Criteria:**
- Create `frontend/src/pages/epics/EpicDetailPage.tsx`
- Shows task cards with: title, status badge (color-coded), assignee, blockers
- Create task form/modal
- Update task status via dropdown or click
- Delete task with confirmation
- Add route `/epics/:id` in `AppRoutes.tsx`
- Typecheck passes
- Verify in browser using agent-browser skill

---

### US-011: Subagent Task Assignment and Execution
**Priority:** 11
**Description:** As a user, I want to assign tasks to subagents and execute them in parallel.

**Acceptance Criteria:**
- `assign_task` tool sets assignee field to a subagent ID
- Create `start_epic_execution` tool that dispatches assigned tasks to subagents
- Uses existing `deepagents.SubAgent` infrastructure from `agents/__init__.py`
- Each subagent receives its assigned task context
- Subagents can call `update_task` to set status to `done`
- Validation: 3 tasks per subagent, status updated on completion
- Typecheck passes

---

### US-012: Final Verification and Cleanup
**Priority:** 12
**Description:** As a developer, I need to ensure all changes are committed and the PR is up to date.

**Acceptance Criteria:**
- All files committed to branch
- Run `git status` — working tree clean
- Push to branch so changes appear in PR #813
- Typecheck passes
