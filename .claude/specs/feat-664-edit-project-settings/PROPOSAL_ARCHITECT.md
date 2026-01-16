# PROPOSAL_ARCHITECT.md
## Feature: GitHub Issue #664 - FEAT: Edit Project Information (Settings)

**Author:** AGENT_1: THE ARCHITECT
**Date:** 2026-01-16
**Status:** Draft

---

## 1. Executive Summary

This proposal outlines the implementation of a project settings/edit feature that allows users to modify project attributes (name and description) directly from the project page. The recommended approach follows the established modal pattern used by `CreateProjectModal`, with an edit button accessible from the project header section. This design ensures consistency with the existing codebase while providing a clean, responsive UX for both desktop and mobile users.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Frontend Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProjectPage.tsx` | `/frontend/src/pages/projects/ProjectPage.tsx` | Main project page displaying project info, threads, and chat |
| `ProjectSection.tsx` | `/frontend/src/components/sections/project-section.tsx` | Displays project name, description, and chat input |
| `CreateProjectModal.tsx` | `/frontend/src/components/modals/CreateProjectModal.tsx` | Modal for creating new projects |
| `useProject.ts` | `/frontend/src/hooks/useProject.ts` | Project state management hook |
| `ProjectContext.tsx` | `/frontend/src/context/ProjectContext.tsx` | React context for project state |
| `projectService.ts` | `/frontend/src/lib/services/projectService.ts` | API service for project operations |
| `project.ts` (entity) | `/frontend/src/lib/entities/project.ts` | TypeScript interfaces for Project and Source |

#### Backend Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| Project Routes | `/backend/src/routes/v0/project/__init__.py` | REST endpoints for project CRUD |
| ProjectService | `/backend/src/services/project.py` | Business logic for projects |
| ProjectRepo | `/backend/src/repos/project_repo.py` | Data access layer for projects |
| Project Schema | `/backend/src/schemas/entities/store.py` | Pydantic model for Project entity |

#### Current API Endpoints

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/projects/search` | Search/list projects | Exists |
| POST | `/projects` | Create project | Exists |
| GET | `/projects/{project_id}` | Get project by ID | Exists |
| DELETE | `/projects/{project_id}` | Delete project | Exists |
| PUT/PATCH | `/projects/{project_id}` | Update project | **MISSING** |

#### Gap Analysis

1. **Backend:** No update endpoint exists for projects
2. **Frontend Service:** No `update()` method in `ProjectService`
3. **Frontend Hook:** No `handleUpdateProject()` method in `useProject`
4. **Frontend Component:** No edit modal or settings panel for projects

### 2.2 Proposed Changes

#### Backend Changes

1. **Add PUT endpoint** `/projects/{project_id}` in `/backend/src/routes/v0/project/__init__.py`
2. **Add update method** in `ProjectService` (`/backend/src/services/project.py`)
3. **Add update method** in `ProjectRepo` (`/backend/src/repos/project_repo.py`)

#### Frontend Changes

1. **Create `EditProjectModal.tsx`** - New modal component for editing projects
2. **Update `ProjectSection.tsx`** - Add settings/edit button to the project header
3. **Update `projectService.ts`** - Add `update()` method
4. **Update `useProject.ts`** - Add `handleUpdateProject()` method
5. **Optional: Create Zod validation schema** for project form

### 2.3 Integration Points and Dependencies

```
                              +------------------+
                              |   ProjectPage    |
                              +--------+---------+
                                       |
                              +--------v---------+
                              | ProjectSection   |
                              | (+ Edit Button)  |
                              +--------+---------+
                                       |
                              +--------v---------+
                              | EditProjectModal |
                              +--------+---------+
                                       |
                    +------------------+------------------+
                    |                                     |
           +--------v---------+                  +--------v---------+
           |  useProject Hook |                  |  ProjectContext  |
           +--------+---------+                  +------------------+
                    |
           +--------v---------+
           |  ProjectService  |
           +--------+---------+
                    |
           +--------v---------+
           |   Backend API    |
           +--------+---------+
                    |
     +--------------+--------------+
     |              |              |
+----v----+   +----v----+   +----v----+
| Routes  |   | Service |   |  Repo   |
+---------+   +---------+   +---------+
```

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Backend - Add Update Endpoint

**Step 1.1:** Add `update` method to `ProjectRepo`

```python
# /backend/src/repos/project_repo.py
async def update(self, project_id: str, project: Project) -> Project:
    try:
        existing = await self._get(project_id)
        if not existing:
            raise ValueError(f"Project {project_id} not found")

        project.id = project_id
        project.updated_at = datetime.now()
        # Preserve created_at from existing
        project.created_at = existing.value.get("created_at")

        updated = await self._set(key=project_id, value=project)
        if updated:
            return project
        else:
            raise Exception("Failed to update project")
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        raise e
```

**Step 1.2:** Add `update` method to `ProjectService`

```python
# /backend/src/services/project.py
async def update(self, project_id: str, project: Project) -> Project:
    return await self.project_repo.update(project_id, project)
```

**Step 1.3:** Add PUT endpoint to project routes

```python
# /backend/src/routes/v0/project/__init__.py
@router.put(
    "/{project_id}",
    name="Update Project",
    operation_id="ruska_update_project",
    tags=["mcp"],
)
async def update_project(
    project_id: str,
    project: Project = Body(openapi_examples=Examples.PROJECT_EXAMPLES),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    try:
        updated_project: Project = await service_context.project_service.update(
            project_id, project
        )
        return {"project": updated_project.model_dump(exclude_none=True)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error updating project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
```

#### Phase 2: Frontend Service Layer

**Step 2.1:** Add `update` method to `projectService.ts`

```typescript
// /frontend/src/lib/services/projectService.ts
static async update(projectId: string, project: Partial<Project>) {
  try {
    const response = await apiClient.put(`${this.BASE_URL}/${projectId}`, project);
    return response;
  } catch (error) {
    console.error("Failed to update project:", error);
    throw error;
  }
}
```

#### Phase 3: Frontend State Management

**Step 3.1:** Add `handleUpdateProject` to `useProject.ts`

```typescript
// /frontend/src/hooks/useProject.ts
const handleUpdateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<Project | null> => {
  setLoading(true);
  setError(null);
  try {
    const response = await ProjectService.update(projectId, updates);
    const updatedProject = response.data.project;

    // Update local state
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, ...updatedProject } : p))
    );

    // Update selectedProject if it was the one being edited
    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...selectedProject, ...updatedProject });
    }

    return updatedProject;
  } catch (err: any) {
    setError(err.message || "Failed to update project");
    console.error("Failed to update project:", err);
    return null;
  } finally {
    setLoading(false);
  }
};

// Add to return object
return {
  // ... existing returns
  handleUpdateProject,
};
```

#### Phase 4: Frontend UI Components

**Step 4.1:** Create `EditProjectModal.tsx`

```typescript
// /frontend/src/components/modals/EditProjectModal.tsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { useProjectContext } from "@/context/ProjectContext";
import { Project } from "@/lib/entities/project";

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onProjectUpdated?: (project: Project) => void;
}

export function EditProjectModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: EditProjectModalProps) {
  const { handleUpdateProject, loading } = useProjectContext();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [error, setError] = useState<string | null>(null);

  // Reset form when project changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description || "");
      setError(null);
    }
  }, [isOpen, project]);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    const updatedProject = await handleUpdateProject(project.id!, {
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (updatedProject) {
      onProjectUpdated?.(updatedProject);
      handleClose();
    } else {
      setError("Failed to update project");
    }
  };

  const handleClose = () => {
    setName(project.name);
    setDescription(project.description || "");
    setError(null);
    onClose();
  };

  const hasChanges =
    name.trim() !== project.name ||
    (description.trim() || "") !== (project.description || "");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Edit Project Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder="Enter project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Enter project description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !hasChanges}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4.2:** Update `ProjectSection.tsx` to add settings button

```typescript
// /frontend/src/components/sections/project-section.tsx
import { useState } from "react";
import ChatInput from "@/components/inputs/ChatInput";
import { Project } from "@/lib/entities/project";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { EditProjectModal } from "@/components/modals/EditProjectModal";

interface ProjectSectionProps {
  project: Project;
  showAgentMenu?: boolean;
  onProjectUpdated?: (project: Project) => void;
}

export function ProjectSection({
  project,
  showAgentMenu = false,
  onProjectUpdated,
}: ProjectSectionProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <img
          src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
          alt="Project Logo"
          className="w-32 h-32 mx-auto rounded-full"
        />
        <Button
          variant="outline"
          size="icon"
          className="absolute top-0 right-0 md:right-[-50px]"
          onClick={() => setIsEditModalOpen(true)}
          aria-label="Edit project settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      <h1 className="text-4xl font-bold mt-2">{project.name}</h1>
      <p className="text-lg mb-2">{project.description || "No description"}</p>
      <div className="flex flex-col w-full lg:w-[600px]">
        <ChatInput showAgentMenu={showAgentMenu} />
      </div>

      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        onProjectUpdated={onProjectUpdated}
      />
    </>
  );
}

export default ProjectSection;
```

**Step 4.3:** Update `ProjectPage.tsx` to handle project updates

```typescript
// In ProjectPage.tsx, update the ProjectSection usage:
const handleProjectUpdated = (updatedProject: Project) => {
  setProject(updatedProject);
  selectProject(updatedProject);
};

// In the JSX:
<ProjectSection
  project={project}
  showAgentMenu={true}
  onProjectUpdated={handleProjectUpdated}
/>
```

### 3.2 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `/backend/src/routes/v0/project/__init__.py` | Modify | Add PUT endpoint |
| `/backend/src/services/project.py` | Modify | Add update method |
| `/backend/src/repos/project_repo.py` | Modify | Add update method |
| `/frontend/src/lib/services/projectService.ts` | Modify | Add update method |
| `/frontend/src/hooks/useProject.ts` | Modify | Add handleUpdateProject |
| `/frontend/src/components/modals/EditProjectModal.tsx` | **New** | Create edit modal |
| `/frontend/src/components/sections/project-section.tsx` | Modify | Add settings button |
| `/frontend/src/pages/projects/ProjectPage.tsx` | Modify | Handle project updates |

### 3.3 Key Code Patterns to Follow

1. **Modal Pattern:** Follow `CreateProjectModal.tsx` structure
   - Dialog from shadcn/ui
   - Form state with useState
   - Error handling with error state
   - Loading states from context

2. **Service Pattern:** Follow existing methods in `projectService.ts`
   - Static async methods
   - Error logging
   - Return response object

3. **Hook Pattern:** Follow existing methods in `useProject.ts`
   - Loading/error state management
   - Optimistic state updates
   - Return null on error

4. **Backend Pattern:** Follow existing routes structure
   - Dependency injection for auth and store
   - ServiceContext pattern
   - HTTPException for errors

---

## 4. Design Decisions

### 4.1 Modal vs. Inline Edit vs. Separate Page

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Modal** | Consistent with Create; Quick access; Non-disruptive | Limited space for complex forms | **Selected** |
| Inline Edit | Immediate feedback; No navigation | Complex state management; Less discoverable | Rejected |
| Separate Page | Full control; Expandable | Requires navigation; More files | Rejected |

**Rationale:** The modal approach is selected because:
1. It mirrors the existing `CreateProjectModal` pattern
2. Project has only two editable fields (name, description), which fit well in a modal
3. Users can quickly edit without leaving the project context
4. Matches the agent edit config dialog pattern referenced in acceptance criteria

### 4.2 Settings Button Placement

**Option A:** Next to project name in header
**Option B:** In a dropdown menu
**Option C:** As a floating action button

**Selected: Option A** - A settings icon button positioned near the project avatar/header area. This provides:
- Direct visibility without extra clicks
- Consistent with how the agent edit pages show their edit buttons
- Works well on both desktop and mobile

### 4.3 API Design: PUT vs. PATCH

| Method | Use Case |
|--------|----------|
| PUT | Full resource replacement |
| PATCH | Partial updates |

**Selected: PUT** - Following the existing codebase patterns where full objects are sent. The `Project` model is simple enough that partial updates add unnecessary complexity.

### 4.4 Validation Strategy

**Frontend:** Basic validation in component (required name)
**Backend:** Pydantic model validation

**Rationale:** Keep it simple. The existing modals don't use Zod schemas, and the Project model has minimal validation needs. This can be enhanced later if requirements grow.

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| State sync issues | Medium | Use callback to update parent state; Clear context selection |
| Concurrent updates | Low | Last-write-wins is acceptable for this use case |
| Mobile UX | Medium | Test modal responsiveness; Use `max-w-md` for consistent sizing |
| Cache invalidation | Low | Frontend cache cleared on update; Backend `@cache` has 30s TTL |

### 5.2 Edge Cases to Handle

1. **Empty description:** Allow null/undefined, display "No description"
2. **Whitespace-only name:** Trim and validate non-empty
3. **Network failure:** Show error message, keep form open
4. **Concurrent tab updates:** Refresh on navigation (existing behavior)
5. **Very long names/descriptions:** Let database constraints handle (or add max-length validation)

### 5.3 Testing Considerations

#### Backend Tests

```python
# /backend/tests/routes/test_project_routes.py
async def test_update_project_success():
    # Create project, then update name/description
    pass

async def test_update_project_not_found():
    # Try to update non-existent project
    pass

async def test_update_project_unauthorized():
    # Try to update another user's project
    pass
```

#### Frontend Tests

```typescript
// /frontend/src/tests/components/EditProjectModal.test.tsx
describe("EditProjectModal", () => {
  it("should display current project values");
  it("should disable save when no changes made");
  it("should call handleUpdateProject on submit");
  it("should show error when name is empty");
  it("should close modal on successful update");
});
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Dimension | Assessment |
|-----------|------------|
| **Scope** | **Medium** |
| Files to modify | 8 files (3 backend, 5 frontend) |
| New files | 1 file (EditProjectModal.tsx) |
| API changes | 1 new endpoint |
| UI changes | 1 new button, 1 new modal |

### 6.2 Risk Level

| Dimension | Assessment |
|-----------|------------|
| **Risk Level** | **Low** |
| Pattern following | High - matches existing patterns |
| Scope creep potential | Low - well-defined requirements |
| Integration complexity | Low - uses existing context/services |

### 6.3 Suggested Priority Order

1. **Backend: Add update method to repo** (foundation)
2. **Backend: Add update method to service** (business logic)
3. **Backend: Add PUT route** (API surface)
4. **Frontend: Add update to service** (API integration)
5. **Frontend: Add handler to hook** (state management)
6. **Frontend: Create EditProjectModal** (UI component)
7. **Frontend: Update ProjectSection** (button + modal integration)
8. **Frontend: Update ProjectPage** (callback wiring)

### 6.4 Estimated Effort

| Phase | Effort |
|-------|--------|
| Backend implementation | 1-2 hours |
| Frontend implementation | 2-3 hours |
| Testing | 1-2 hours |
| **Total** | **4-7 hours** |

---

## 7. Alternative Approaches Considered

### 7.1 Drawer/Side Panel Instead of Modal

A slide-in drawer (like `app-sidebar.tsx`) could provide more space for future settings expansion. However, this was rejected because:
- Overkill for two simple fields
- Would require new patterns not currently used for similar forms
- Modal is more consistent with `CreateProjectModal`

### 7.2 Settings Page Route

A dedicated `/p/:projectId/settings` page was considered but rejected because:
- Adds routing complexity
- Requires navigation away from project context
- Overkill for current requirements
- Can be added later if settings grow significantly

### 7.3 Inline Editing with Double-Click

Double-click to edit name/description inline was considered but rejected because:
- Less discoverable for users
- More complex state management
- Inconsistent with other edit patterns in the app

---

## 8. Future Considerations

1. **Project Image/Avatar:** Current hardcoded avatar could become editable
2. **Project Visibility (Public/Private):** Similar to agent visibility toggle
3. **Project Deletion from Settings:** Currently only possible via sidebar
4. **Project Members/Sharing:** Multi-user collaboration features
5. **Project Tags/Categories:** Organization features

These can be added to the settings modal or warrant a dedicated settings page if requirements expand significantly.

---

## 9. Appendix

### A. Related Files Reference

```
/backend/src/
  routes/v0/project/__init__.py    # Project routes
  services/project.py              # Project service
  repos/project_repo.py            # Project repository
  schemas/entities/store.py        # Project Pydantic model

/frontend/src/
  pages/projects/ProjectPage.tsx   # Main project page
  components/
    sections/project-section.tsx   # Project header section
    modals/CreateProjectModal.tsx  # Reference for edit modal
  hooks/useProject.ts              # Project state hook
  context/ProjectContext.tsx       # Project context
  lib/
    services/projectService.ts     # Project API service
    entities/project.ts            # Project TypeScript interface
```

### B. API Contract

**PUT /api/projects/{project_id}**

Request:
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

Response (200 OK):
```json
{
  "project": {
    "id": "uuid-string",
    "name": "Updated Project Name",
    "description": "Updated description",
    "created_at": "2026-01-16T12:00:00Z",
    "updated_at": "2026-01-16T14:30:00Z"
  }
}
```

Error Response (404 Not Found):
```json
{
  "detail": "Project {project_id} not found"
}
```

---

**End of Proposal**
