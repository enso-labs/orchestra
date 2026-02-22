# Plan: Task/Epic CRUD Toolkit with Subagent Assignment

**Issue:** #812 — `feat: Task/Epic CRUD toolkit with subagent assignment and parallel execution`
**Branch:** `feat/812-task-epic-toolkit`
**PR:** `feat/812-task-epic-toolkit → development`

---

## Strategy

Build a full task/epic management system following the existing Project/Memory patterns exactly. The implementation layers in dependency order:

### Phase 1: Data Layer (Schema + Repos)
- Add `Epic` and `Task` Pydantic models to `backend/src/schemas/entities/store.py`
- Create `EpicRepo` in `backend/src/repos/epic_repo.py` (follows `ProjectRepo` pattern, extends `BaseRepo`)
- Create `TaskRepo` in `backend/src/repos/task_repo.py` (extends `BaseRepo`, tasks stored in `(user_id, "tasks")` namespace with `epic_id` in metadata for filtering)

### Phase 2: Service Layer
- Create `EpicService` in `backend/src/services/epic.py` — business logic for CRUD + task assignment
- Register `EpicService` in `ServiceContext` (`backend/src/contexts/service.py`)

### Phase 3: Agent Tools
- Create `backend/src/tools/epic.py` with tools: `create_epic`, `list_epics`, `update_epic`, `delete_epic`, `create_task`, `list_tasks`, `update_task`, `delete_task`, `assign_task`, `start_epic_execution`
- Create `backend/src/tools/task_search.py` with `search_tasks` tool (semantic search, mirrors `search_threads`)
- Register tools in `backend/src/tools/__init__.py` (`EPIC_TOOLS`, `TASK_SEARCH_TOOLS` added to `default_tools()`)

### Phase 4: REST API
- Create `backend/src/routes/v0/epic/__init__.py` with routes:
  - `POST /epics` — create epic
  - `POST /epics/search` — search/list epics
  - `GET /epics/{epic_id}` — get epic with tasks
  - `PUT /epics/{epic_id}` — update epic
  - `DELETE /epics/{epic_id}` — delete epic (cascades to tasks)
  - `POST /epics/{epic_id}/tasks` — create task
  - `GET /epics/{epic_id}/tasks` — list tasks for epic
  - `PUT /epics/{epic_id}/tasks/{task_id}` — update task
  - `DELETE /epics/{epic_id}/tasks/{task_id}` — delete task
  - `POST /tasks/search` — semantic search across all tasks
- Register router in `backend/src/routes/v0/__init__.py`

### Phase 5: Frontend UI
- Create epic service (`frontend/src/lib/services/epicService.ts`)
- Create epic context (`frontend/src/context/EpicContext.tsx`)
- Create pages:
  - `frontend/src/pages/epics/index.tsx` — Epic list view
  - `frontend/src/pages/epics/EpicDetailPage.tsx` — Epic detail with task list (Kanban/list toggle)
- Create components:
  - Task cards with status badge, assignee, blockers
  - Status change controls (todo → in_progress → done, blocked toggle)
- Add "Epics" entry to sidebar (`frontend/src/components/drawers/app-sidebar.tsx`)
- Add routes in `frontend/src/routes/AppRoutes.tsx`

### Phase 6: Subagent Execution
- Implement `assign_task` tool — sets task assignee (user or subagent ID)
- Implement `start_epic_execution` tool — dispatches assigned tasks to subagents using `deepagents.SubAgent`
- Each subagent receives task context and uses `update_task` to set status on completion
- Validation: 3 tasks per subagent, status transitions enforced

---

## Key Design Decisions

1. **Namespace strategy:** Epics in `(user_id, "epics")`, Tasks in `(user_id, "tasks")` with `epic_id` in metadata — enables both epic-scoped queries and cross-epic task search
2. **Task statuses:** `todo`, `in_progress`, `done`, `blocked` — simple and sufficient for MVP
3. **Subagent integration:** Uses existing `deepagents` infrastructure, subagents get tools injected automatically
4. **Search:** Semantic search on task title + description, matching `search_threads` pattern exactly

## Files Changed (Expected)

| File | Action |
|------|--------|
| `backend/src/schemas/entities/store.py` | Modify — add Epic, Task, EpicUpdate, TaskUpdate models |
| `backend/src/repos/epic_repo.py` | New |
| `backend/src/repos/task_repo.py` | New |
| `backend/src/services/epic.py` | New |
| `backend/src/contexts/service.py` | Modify — add EpicService |
| `backend/src/tools/epic.py` | New |
| `backend/src/tools/task_search.py` | New (or extend existing) |
| `backend/src/tools/__init__.py` | Modify — register epic/task tools |
| `backend/src/routes/v0/epic/__init__.py` | New |
| `backend/src/routes/v0/__init__.py` | Modify — register epic router |
| `frontend/src/lib/services/epicService.ts` | New |
| `frontend/src/context/EpicContext.tsx` | New |
| `frontend/src/pages/epics/index.tsx` | New |
| `frontend/src/pages/epics/EpicDetailPage.tsx` | New |
| `frontend/src/components/drawers/app-sidebar.tsx` | Modify — add Epics nav |
| `frontend/src/routes/AppRoutes.tsx` | Modify — add epic routes |
