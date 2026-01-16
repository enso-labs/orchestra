# Implementation Tasks: Edit Project Information (Settings)

**Issue:** #664
**Branch:** `feat/664-edit-project-information-settings`
**Created:** 2026-01-16

---

## Pre-Implementation
- [x] Verify development environment setup
- [x] Review REVIEW.md council decisions
- [x] Confirm worktree is on correct branch

---

## Phase 1: Backend Implementation

### Task 1.1: Add update method to ProjectRepo
- **Files:** `backend/src/repos/project_repo.py`
- **Action:** Add `async def update(self, project_id: str, data: dict) -> Project` method
- **Acceptance:** Method retrieves existing project, merges data, calls `_set()`, returns updated project
- **Status:** ✅ COMPLETE

### Task 1.2: Add update method to ProjectService
- **Files:** `backend/src/services/project.py`
- **Action:** Add `async def update(self, project_id: str, data: dict) -> Project` method with field allowlist
- **Acceptance:** Method validates fields, calls repo.update(), returns project
- **Status:** ✅ COMPLETE

### Task 1.3: Add PUT route to project routes
- **Files:** `backend/src/routes/v0/project/__init__.py`
- **Action:** Add `PUT /{project_id}` endpoint with Pydantic validation
- **Acceptance:** Route accepts name/description, returns updated project, handles 404/validation errors
- **Status:** ✅ COMPLETE

---

## Phase 2: Frontend Service Layer

### Task 2.1: Add update method to ProjectService
- **Files:** `frontend/src/lib/services/projectService.ts`
- **Action:** Add `static async update(projectId: string, project: Partial<Project>)` method
- **Acceptance:** Method calls `apiClient.put()`, returns response
- **Status:** ✅ COMPLETE

### Task 2.2: Add handleUpdateProject to useProject hook
- **Files:** `frontend/src/hooks/useProject.ts`
- **Action:** Add `handleUpdateProject` function with optimistic updates
- **Acceptance:** Updates local state, calls service, handles errors with rollback
- **Status:** ✅ COMPLETE

---

## Phase 3: Frontend UI Components

### Task 3.1: Create EditProjectModal component
- **Files:** `frontend/src/components/modals/EditProjectModal.tsx` (NEW)
- **Action:** Create modal with name/description form following CreateProjectModal pattern
- **Acceptance:** Modal opens/closes, validates input, calls onUpdate callback
- **Status:** ✅ COMPLETE

### Task 3.2: Update ProjectSection with settings button
- **Files:** `frontend/src/components/sections/project-section.tsx`
- **Action:** Add Settings icon button inline with project name, integrate EditProjectModal
- **Acceptance:** Button visible, opens modal, project updates on save
- **Status:** ✅ COMPLETE

### Task 3.3: Wire callbacks in ProjectPage
- **Files:** `frontend/src/pages/projects/ProjectPage.tsx`
- **Action:** Add onProjectUpdated callback to update local project state
- **Acceptance:** Project name/description updates in UI after save
- **Status:** ✅ COMPLETE

---

## Phase 4: Testing & Verification

### Task 4.1: Run backend tests
- **Command:** `cd backend && uv run pytest tests/ -v`
- **Acceptance:** All tests pass
- **Status:** ⏳ PENDING

### Task 4.2: Run frontend tests
- **Command:** `cd frontend && npm run test`
- **Acceptance:** All tests pass
- **Status:** ⏳ PENDING

### Task 4.3: Format code
- **Command:** `make format`
- **Acceptance:** No formatting changes needed
- **Status:** ✅ COMPLETE (frontend formatted)

### Task 4.4: Manual verification
- **Action:** Test edit flow on project page
- **Acceptance:**
  - Settings button visible
  - Modal opens with current values
  - Save updates project
  - Cancel discards changes
  - Mobile responsive
- **Status:** ⏳ PENDING (requires running application)

---

## Completion Signature

- **Total Tasks:** 12
- **Completed:** 10
- **Dependencies:** Backend must complete before frontend UI
- **Priority Order:** 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 3.1 → 3.2 → 3.3 → 4.1-4.4

---

## Progress Log

- 2026-01-16: Task 1.1 completed - Added `update()` method to ProjectRepo
- 2026-01-16: Task 1.2 completed - Added `update()` method to ProjectService
- 2026-01-16: Task 1.3 completed - Added PUT route `/projects/{project_id}`
- 2026-01-16: Task 2.1 completed - Added `update()` to projectService.ts
- 2026-01-16: Task 2.2 completed - Added `handleUpdateProject` to useProject hook
- 2026-01-16: Task 3.1 completed - Created EditProjectModal.tsx
- 2026-01-16: Task 3.2 completed - Updated ProjectSection with settings button
- 2026-01-16: Task 3.3 completed - Wired callbacks in ProjectPage
- 2026-01-16: Task 4.3 completed - Code formatted
