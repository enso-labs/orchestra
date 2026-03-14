# Plan: Remove EPICS & TASKs Functionality

## Context
The EPICS/TASKs project management feature was added but has proven not useful as-is. This plan covers a full removal of all related code from both backend and frontend.

## Files to Delete

### Backend
- `backend/src/repos/epic_repo.py` — Epic repository
- `backend/src/repos/task_repo.py` — Task repository
- `backend/src/services/epic.py` — Epic service
- `backend/src/tools/epic.py` — LangGraph tools (EPIC_TOOLS)
- `backend/src/routes/v0/epic/__init__.py` — API routes (entire `epic/` directory)

### Frontend
- `frontend/src/lib/entities/epic.ts` — Type definitions
- `frontend/src/lib/services/epicService.ts` — API service
- `frontend/src/context/EpicContext.tsx` — React context/provider
- `frontend/src/hooks/useEpic.ts` — Custom hook
- `frontend/src/pages/epics/index.tsx` — Epics listing page (entire `epics/` directory)
- `frontend/src/pages/epics/EpicDetailPage.tsx` — Epic detail page
- `frontend/src/components/modals/CreateEpicModal.tsx` — Create epic modal
- `frontend/src/components/modals/CreateTaskModal.tsx` — Create task modal

## Files to Edit

### Backend
1. **`backend/src/tools/__init__.py`** — Remove `EPIC_TOOLS` import and `*EPIC_TOOLS` from tools list
2. **`backend/src/routes/v0/__init__.py`** — Remove epic/task router imports and `app.include_router(epic, ...)` registration
3. **`backend/src/contexts/service.py`** — Remove `EpicService` import and `self.epic_service` initialization
4. **`backend/src/repos/base_repo.py`** — Check if Epic/Task entity format validation can be removed (may be shared with other entities)
5. **`backend/src/schemas/entities/store.py`** — Remove `Epic`, `EpicUpdate`, `Task`, `TaskUpdate` models

### Frontend
6. **`frontend/src/main.tsx`** — Remove `EpicProvider` import and wrapper from provider chain
7. **`frontend/src/routes/AppRoutes.tsx`** — Remove `/epics` and `/epics/:id` route definitions and imports
8. **`frontend/src/components/drawers/app-sidebar.tsx`** — Remove Epics navigation link

## Execution Order
1. Delete all backend files listed above
2. Edit backend registration files (tools/__init__, routes/v0/__init__, contexts/service, schemas)
3. Delete all frontend files listed above
4. Edit frontend registration files (main.tsx, AppRoutes, app-sidebar)
5. Run `make format` in backend
6. Run frontend build/lint check

## Verification
- `cd backend && make format && make lint` — no import errors
- `cd backend && make test` — all tests pass (no epic tests exist)
- `cd frontend && npm run build` — no broken imports
- `cd frontend && npm run test` — all tests pass (no epic tests exist)
- Manual check: sidebar no longer shows Epics link, `/epics` route no longer exists
