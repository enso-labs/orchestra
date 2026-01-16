# Implementation Proposal: Edit Project Information (Settings)

**GitHub Issue:** #664
**Agent:** THE CRAFTSMAN (Clean Code & SOLID Principles Expert)
**Date:** 2026-01-16

---

## 1. Executive Summary

This proposal outlines a clean, maintainable approach to implement project settings editing functionality that mirrors the existing agent configuration edit pattern. The implementation will introduce a new `PUT /projects/{project_id}` endpoint on the backend and a reusable `ProjectSettingsModal` component on the frontend, following established patterns in the codebase while adhering to SOLID principles and clean code practices.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Backend Current State
- **Project Entity** (`backend/src/schemas/entities/store.py`):
  ```python
  class Project(BaseEntity):
      name: str
      description: Optional[str] = None
      sources: Optional[list[Source]] = None
  ```
- **Project Routes** (`backend/src/routes/v0/project/__init__.py`):
  - `POST /projects/search` - Search projects
  - `POST /projects` - Create project
  - `GET /projects/{project_id}` - Get project
  - `DELETE /projects/{project_id}` - Delete project
  - Source management endpoints exist
  - **MISSING:** `PUT /projects/{project_id}` - Update project

- **ProjectRepo** (`backend/src/repos/project_repo.py`):
  - Has `create()` method but no `update()` method
  - Uses `BaseRepo._set()` which can handle updates

- **ProjectService** (`backend/src/services/project.py`):
  - Has `create()`, `get()`, `delete()`, `search()` methods
  - **MISSING:** `update()` method

#### Frontend Current State
- **Project Entity** (`frontend/src/lib/entities/project.ts`):
  ```typescript
  interface Project {
      id?: string;
      name: string;
      description?: string;
      sources?: Source[];
      created_at?: string;
      updated_at?: string;
  }
  ```
- **ProjectService** (`frontend/src/lib/services/projectService.ts`):
  - Has `create()`, `get()`, `delete()`, `search()`, source methods
  - **MISSING:** `update()` method

- **ProjectPage** (`frontend/src/pages/projects/ProjectPage.tsx`):
  - Displays project info via `ProjectSection` component
  - No settings/edit button exists

- **ProjectSection** (`frontend/src/components/sections/project-section.tsx`):
  - Simple display component showing project name and description
  - No edit functionality

- **CreateProjectModal** (`frontend/src/components/modals/CreateProjectModal.tsx`):
  - Exists as a reference pattern for project forms
  - Uses Dialog, Input, Textarea, Label from shadcn/ui

### 2.2 Reference Pattern: Agent Configuration Edit

The `AgentCreateForm` component (`frontend/src/components/forms/agents/agent-create-form.tsx`) demonstrates the established pattern:

1. **Edit/View Mode Toggle**: `isEditing` state controls form interactivity
2. **Form Structure**: Uses react-hook-form with zod validation
3. **UI Components**: Form fields use shadcn/ui components
4. **Action Buttons**: Edit (Pencil), Save (Save), Cancel (Ban), Delete (Trash2)
5. **Disabled State Styling**: `!isEditing ? "opacity-60 bg-muted/50 cursor-not-allowed" : ""`
6. **Form Validation**: Zod schema with minimum length requirements

### 2.3 Proposed Changes

#### Backend Changes
1. Add `update()` method to `ProjectRepo`
2. Add `update()` method to `ProjectService`
3. Add `PUT /projects/{project_id}` route

#### Frontend Changes
1. Add `update()` method to `ProjectService`
2. Create `ProjectSettingsModal` component (or `EditProjectModal`)
3. Add settings button to `ProjectSection` or `ProjectPage`
4. Add `handleUpdateProject()` to `useProject` hook

### 2.4 Integration Points and Dependencies

```
Frontend                           Backend
---------                          -------
ProjectPage                        PUT /projects/{project_id}
    |                                     |
    v                                     v
ProjectSettingsModal               project/__init__.py
    |                                     |
    v                                     v
ProjectService.update() ---------> ProjectService.update()
                                          |
                                          v
                                   ProjectRepo.update()
                                          |
                                          v
                                   BaseRepo._set()
```

**Context Dependencies:**
- `useProjectContext()` - For state management
- `useChatContext()` - May need for UI coordination
- Existing project fetch mechanism in `ProjectPage`

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Backend Implementation (Estimated: 1-2 hours)

**Step 1.1: Add update method to ProjectRepo**
```python
# backend/src/repos/project_repo.py

async def update(self, project_id: str, project_data: dict) -> Project:
    """Update an existing project."""
    try:
        # Get existing project
        existing = await self._get(project_id)
        if not existing:
            raise ValueError(f"Project {project_id} not found")

        # Merge with existing data
        current_project = Project.model_validate(existing.value)
        updated_data = {
            **current_project.model_dump(exclude_none=True),
            **project_data,
            "id": project_id,
            "updated_at": datetime.now(),
        }

        updated_project = Project.model_validate(updated_data)
        await self._set(key=project_id, value=updated_project)
        return updated_project
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        raise e
```

**Step 1.2: Add update method to ProjectService**
```python
# backend/src/services/project.py

async def update(self, project_id: str, project_data: dict) -> Project:
    """Update project name and/or description."""
    return await self.project_repo.update(project_id, project_data)
```

**Step 1.3: Add PUT route**
```python
# backend/src/routes/v0/project/__init__.py

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
    """Update project name and description."""
    service_context = ServiceContext(user_id=user.id, store=store)
    try:
        updated_project = await service_context.project_service.update(
            project_id,
            {"name": project.name, "description": project.description}
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

#### Phase 2: Frontend Service Layer (Estimated: 30 minutes)

**Step 2.1: Add update method to ProjectService**
```typescript
// frontend/src/lib/services/projectService.ts

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

**Step 2.2: Add handleUpdateProject to useProject hook**
```typescript
// frontend/src/hooks/useProject.ts

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

        // Update selected project if it's the one being edited
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
```

#### Phase 3: Frontend UI Components (Estimated: 2-3 hours)

**Step 3.1: Create ProjectSettingsModal component**

File: `frontend/src/components/modals/ProjectSettingsModal.tsx`

```typescript
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
import { Settings, Save, Trash2 } from "lucide-react";
import { useProjectContext } from "@/context/ProjectContext";
import { Project } from "@/lib/entities/project";

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onProjectUpdated?: (project: Project) => void;
    onProjectDeleted?: () => void;
}

export function ProjectSettingsModal({
    isOpen,
    onClose,
    project,
    onProjectUpdated,
    onProjectDeleted,
}: ProjectSettingsModalProps) {
    const { handleUpdateProject, handleDeleteProject, loading } = useProjectContext();
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || "");
    const [error, setError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Reset form when project changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setName(project.name);
            setDescription(project.description || "");
            setError(null);
            setHasChanges(false);
        }
    }, [isOpen, project]);

    // Track changes
    useEffect(() => {
        const nameChanged = name !== project.name;
        const descChanged = description !== (project.description || "");
        setHasChanges(nameChanged || descChanged);
    }, [name, description, project]);

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
            onClose();
        } else {
            setError("Failed to update project");
        }
    };

    const handleDelete = async () => {
        const confirmed = confirm(
            "Are you sure you want to delete this project? This action cannot be undone."
        );
        if (!confirmed) return;

        const success = await handleDeleteProject(project.id!);
        if (success) {
            onProjectDeleted?.();
            onClose();
        } else {
            setError("Failed to delete project");
        }
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Project Settings
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

                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || !name.trim() || !hasChanges}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
```

**Step 3.2: Update ProjectSection to include settings button**

File: `frontend/src/components/sections/project-section.tsx`

```typescript
import ChatInput from "@/components/inputs/ChatInput";
import { Project } from "@/lib/entities/project";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useState } from "react";
import { ProjectSettingsModal } from "@/components/modals/ProjectSettingsModal";

interface ProjectSectionProps {
    project: Project;
    showAgentMenu?: boolean;
    onProjectUpdated?: (project: Project) => void;
    onProjectDeleted?: () => void;
}

export function ProjectSection({
    project,
    showAgentMenu = false,
    onProjectUpdated,
    onProjectDeleted,
}: ProjectSectionProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
                    className="absolute top-0 right-0 md:right-[-48px]"
                    onClick={() => setIsSettingsOpen(true)}
                    title="Project Settings"
                >
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
            <h1 className="text-4xl font-bold mt-2">{project.name}</h1>
            <p className="text-lg mb-2">{project.description || "No description"}</p>
            <div className="flex flex-col w-full lg:w-[600px]">
                <ChatInput showAgentMenu={showAgentMenu} />
            </div>

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onProjectUpdated={onProjectUpdated}
                onProjectDeleted={onProjectDeleted}
            />
        </>
    );
}

export default ProjectSection;
```

**Step 3.3: Update ProjectPage to handle project updates/deletes**

```typescript
// In ProjectPage.tsx - update the ProjectSection usage

// Add local project state update handler
const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
};

const handleProjectDeleted = () => {
    navigate("/chat");
};

// Update ProjectSection usage
<ProjectSection
    project={project}
    showAgentMenu={true}
    onProjectUpdated={handleProjectUpdated}
    onProjectDeleted={handleProjectDeleted}
/>
```

### 3.2 File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/repos/project_repo.py` | Modify | Add `update()` method |
| `backend/src/services/project.py` | Modify | Add `update()` method |
| `backend/src/routes/v0/project/__init__.py` | Modify | Add PUT route |
| `frontend/src/lib/services/projectService.ts` | Modify | Add `update()` method |
| `frontend/src/hooks/useProject.ts` | Modify | Add `handleUpdateProject()` |
| `frontend/src/components/modals/ProjectSettingsModal.tsx` | **New** | Create settings modal |
| `frontend/src/components/sections/project-section.tsx` | Modify | Add settings button |
| `frontend/src/pages/projects/ProjectPage.tsx` | Modify | Handle update/delete callbacks |

### 3.3 Key Code Patterns to Follow

1. **Form Validation**: Use Zod schema for frontend validation (optional but recommended)
2. **Error Handling**: Follow existing try-catch patterns with user feedback
3. **Loading States**: Use `loading` state from context to disable inputs
4. **Confirmation Dialogs**: Use `confirm()` for destructive actions (like delete)
5. **State Management**: Update both local and context state after mutations
6. **Responsive Design**: Use Tailwind responsive classes (sm:, md:, lg:)

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Modal-based editing | Inline editing in ProjectSection | Modal provides clear separation of concerns, matches CreateProjectModal pattern, better mobile UX |
| Settings button on ProjectSection | Dedicated settings page | Simpler UX, fewer navigation steps, matches the "click button from project page" requirement |
| Single modal for edit + delete | Separate modals | Reduces component proliferation, common pattern in the codebase |
| PUT endpoint (full replacement) | PATCH endpoint (partial update) | Simpler implementation, only 2 editable fields currently, matches assistant update pattern |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Inline Editing**
- Rejected because: Would require significant changes to ProjectSection layout, harder to implement validation feedback, doesn't match existing patterns

**Alternative 2: Dedicated Settings Page**
- Rejected because: Over-engineered for only 2 fields, adds navigation complexity, requirement explicitly states "click button from project page"

**Alternative 3: Sheet/Drawer Instead of Dialog**
- Considered but rejected: Dialog provides better focus for simple forms, Sheet is better for complex multi-step flows (like tool selection)

### 4.3 Alignment with Existing Codebase Patterns

1. **Modal Pattern**: Follows `CreateProjectModal` structure exactly
2. **Service Layer**: Mirrors `agentService.update()` pattern
3. **Hook Pattern**: Follows `handleCreateProject` pattern in `useProject`
4. **Route Pattern**: Follows `update_assistant` route structure
5. **Styling**: Uses established Tailwind classes and shadcn/ui components

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Mitigation |
|------|------------|
| Cache invalidation after update | FastAPI cache decorator has 30s expiry; consider clearing cache on update |
| Concurrent edit conflicts | Low risk for single-user projects; add `updated_at` check if needed later |
| Mobile layout issues | Use responsive classes, test on mobile viewport |
| Context state out of sync | Update both local component state and context state after mutations |

### 5.2 Edge Cases to Handle

1. **Empty project name**: Validate on both frontend and backend
2. **Project not found (deleted by another session)**: Handle 404 response gracefully
3. **Network failure during save**: Show error message, keep form data intact
4. **User navigates away with unsaved changes**: Consider adding unsaved changes warning (optional enhancement)
5. **Very long project names/descriptions**: Consider character limits

### 5.3 Testing Considerations

**Backend Tests:**
```python
# backend/tests/unit/routes/test_project.py

async def test_update_project_success():
    """Test successful project update."""
    pass

async def test_update_project_not_found():
    """Test 404 when project doesn't exist."""
    pass

async def test_update_project_invalid_name():
    """Test validation for empty name."""
    pass
```

**Frontend Tests:**
```typescript
// frontend/src/tests/components/ProjectSettingsModal.test.tsx

describe("ProjectSettingsModal", () => {
    it("should render with current project values");
    it("should disable save button when no changes");
    it("should call handleUpdateProject on save");
    it("should show error on failed update");
    it("should call handleDeleteProject on delete confirmation");
});
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Scope** | **Medium** | Involves both backend and frontend changes, but follows existing patterns closely |
| Backend Changes | Small | 3 files, straightforward additions |
| Frontend Changes | Medium | New modal component, hook updates, page updates |
| Testing | Small | Standard CRUD operation tests |

### 6.2 Risk Level

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Risk** | **Low** | Well-established patterns, no architectural changes |
| Breaking Changes | Very Low | New endpoints only, no existing API changes |
| Regression Risk | Low | Isolated feature, minimal impact on existing flows |

### 6.3 Suggested Priority Order for Implementation

1. **Backend** (Foundation)
   - 1.1 ProjectRepo.update()
   - 1.2 ProjectService.update()
   - 1.3 PUT route
   - 1.4 Backend tests

2. **Frontend Service Layer** (API Integration)
   - 2.1 ProjectService.update()
   - 2.2 useProject.handleUpdateProject()

3. **Frontend UI** (User-facing)
   - 3.1 ProjectSettingsModal component
   - 3.2 Update ProjectSection with settings button
   - 3.3 Update ProjectPage with callbacks
   - 3.4 Frontend tests

4. **Manual Testing & Polish**
   - 4.1 Desktop testing
   - 4.2 Mobile responsive testing
   - 4.3 Error handling verification

---

## 7. Appendix: Quick Reference

### API Endpoint Specification

```yaml
PUT /api/projects/{project_id}
Request:
  Headers:
    Authorization: Bearer <token>
    Content-Type: application/json
  Body:
    name: string (required)
    description: string (optional)
Response:
  200 OK:
    project:
      id: string
      name: string
      description: string
      created_at: string
      updated_at: string
  404 Not Found:
    detail: "Project {project_id} not found"
  400 Bad Request:
    detail: "Validation error message"
```

### Component Props Reference

```typescript
// ProjectSettingsModal
interface ProjectSettingsModalProps {
    isOpen: boolean;           // Controls modal visibility
    onClose: () => void;       // Called when modal should close
    project: Project;          // Project data to edit
    onProjectUpdated?: (project: Project) => void;  // Called after successful update
    onProjectDeleted?: () => void;  // Called after successful delete
}

// ProjectSection (updated)
interface ProjectSectionProps {
    project: Project;
    showAgentMenu?: boolean;
    onProjectUpdated?: (project: Project) => void;
    onProjectDeleted?: () => void;
}
```

---

*This proposal was prepared by THE CRAFTSMAN agent, focusing on clean code, maintainability, and SOLID principles.*
