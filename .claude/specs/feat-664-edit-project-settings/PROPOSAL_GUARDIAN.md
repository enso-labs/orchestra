# PROPOSAL_GUARDIAN.md
# GitHub Issue #664: FEAT: Edit Project Information (Settings)
## The Guardian Perspective - Security, Error Handling, and Testing

---

## 1. Executive Summary

This proposal outlines a secure implementation strategy for adding project edit functionality to the Orchestra application, with emphasis on authorization controls, input validation, graceful error handling, and comprehensive test coverage. The recommended approach extends the existing project infrastructure by adding a PATCH/PUT endpoint on the backend and an edit modal on the frontend, following the established patterns from the agent create/edit flow while applying defense-in-depth security principles.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment (Security Focus)

#### Backend Security Architecture

**Authorization Model:**
- Projects use namespace-based isolation via `BaseRepo._get_namespace()` returning `(user_id, entity_type)`
- The `ServiceContext` class enforces user-scoped access by binding `user_id` to all service instances
- Authentication is handled via `verify_credentials` dependency which:
  - Validates JWT tokens with expiration checks
  - Supports API key authentication with hash verification
  - Returns `ProtectedUser` with sanitized user data

**Current Project Routes Security:**
```
POST   /projects               - verify_credentials (create)
GET    /projects/{project_id}  - verify_credentials (read)
DELETE /projects/{project_id}  - verify_credentials (delete)
POST   /projects/search        - verify_credentials (search)
```

**Key Observation:** No explicit ownership verification exists in the project service layer - security relies entirely on namespace isolation. A user can only access projects within their own namespace because `ServiceContext(user_id=user.id, ...)` scopes all operations.

**Current Project Schema:**
```python
class Project(BaseEntity):
    name: str               # Required, mutable
    description: Optional[str] = None  # Optional, mutable
    sources: Optional[list[Source]] = None  # Managed separately
```

**Identified Security Gap:** No update endpoint exists, meaning there's no validation pattern for project modifications. The assistant service provides a reference pattern:
```python
async def update(self, assistant_id: str, data: dict):
    await self.store.aput(
        namespace=self._get_namespace(), key=assistant_id, value=data
    )
```

#### Frontend Security Architecture

**Authentication Flow:**
- `apiClient.ts` interceptor attaches Bearer token to all requests
- 401 responses trigger automatic logout and redirect
- Token stored in localStorage (standard pattern, acceptable for this use case)

**Current Project Service:**
- Missing `update` method
- All methods use authenticated `apiClient`

### 2.2 Proposed Changes and Rationale

#### Backend Changes

1. **New Update Endpoint** (`PUT /projects/{project_id}` or `PATCH /projects/{project_id}`)
   - Rationale: Follow REST conventions; PUT for full replacement, PATCH for partial updates
   - Recommendation: Use `PUT` for consistency with assistant endpoint pattern

2. **Project Update Service Method**
   - Add `update(project_id: str, data: dict)` to `ProjectService`
   - Implement get-before-update pattern for ownership verification

3. **Input Validation Schema**
   - Create `ProjectUpdate` Pydantic model for partial updates
   - Validate string lengths, sanitize inputs

#### Frontend Changes

1. **Edit Project Modal Component**
   - Reusable modal following `CreateProjectModal` pattern
   - Pre-populated with current project data
   - Form validation using Zod

2. **Project Service Update Method**
   - Add `update(projectId: string, project: Partial<Project>)` method

3. **Hook Enhancement**
   - Add `handleUpdateProject` to `useProject` hook
   - Manage optimistic updates with rollback on failure

### 2.3 Integration Points and Dependencies

```
Frontend                      Backend
---------                     -------
ProjectPage.tsx          -->  PUT /projects/{project_id}
  |                             |
  v                             v
EditProjectModal.tsx     <--  ProjectService.update()
  |                             |
  v                             v
useProject.ts                 ProjectRepo._set()
  |                             |
  v                             v
projectService.ts             AsyncPostgresStore.aput()
```

---

## 3. Implementation Strategy

### 3.1 Backend Implementation (Security Checkpoints)

#### Step 1: Define Update Schema with Validation

**File:** `backend/src/schemas/entities/project_update.py` (new)

```python
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

class ProjectUpdate(BaseModel):
    """Schema for project update requests with validation."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            # Strip whitespace
            v = v.strip()
            if len(v) < 1:
                raise ValueError('Name cannot be empty or whitespace only')
            # Prevent XSS in name (basic sanitization)
            if re.search(r'[<>]', v):
                raise ValueError('Name contains invalid characters')
        return v

    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v is not None:
            v = v.strip()
            # Allow empty description (to clear it)
        return v
```

**Security Checkpoint 1:** Input validation at schema level prevents malformed data from reaching business logic.

#### Step 2: Add Update Method to ProjectService

**File:** `backend/src/services/project.py`

```python
from datetime import datetime

async def update(self, project_id: str, data: dict) -> Project:
    """
    Update project with ownership verification.

    Security: Uses get() first to verify project exists in user's namespace.
    This prevents IDOR attacks since get() is namespace-scoped.
    """
    # Verify project exists and user has access (get is namespace-scoped)
    existing = await self.get(project_id)
    if not existing:
        raise ValueError(f"Project {project_id} not found")

    # Merge updates with existing data (preserve immutable fields)
    updated_data = existing.model_dump()

    # Only allow specific fields to be updated
    ALLOWED_FIELDS = {'name', 'description'}
    for key, value in data.items():
        if key in ALLOWED_FIELDS and value is not None:
            updated_data[key] = value

    # Update timestamp
    updated_data['updated_at'] = datetime.now().isoformat()

    # Persist
    await self.project_repo._set(key=project_id, value=Project(**updated_data))

    return await self.get(project_id)
```

**Security Checkpoint 2:** Get-before-update pattern ensures user can only modify projects in their namespace.

#### Step 3: Add Update Route

**File:** `backend/src/routes/v0/project/__init__.py`

```python
from src.schemas.entities.project_update import ProjectUpdate

@router.put(
    "/{project_id}",
    name="Update Project",
    operation_id="ruska_update_project",
    tags=["mcp"],
)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Update project name and/or description.

    Security:
    - Requires authentication (verify_credentials)
    - Namespace-scoped access (ServiceContext user_id binding)
    - Input validation (ProjectUpdate schema)
    - Explicit field allowlist in service layer
    """
    try:
        # Validate at least one field is being updated
        update_data = project_update.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        service_context = ServiceContext(user_id=user.id, store=store)
        updated_project = await service_context.project_service.update(
            project_id, update_data
        )
        return {"project": updated_project.model_dump(exclude_none=True)}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project"
        )
```

**Security Checkpoint 3:** Route-level error handling prevents information leakage.

### 3.2 Frontend Implementation (Error Handling Focus)

#### Step 4: Add Update Method to Project Service

**File:** `frontend/src/lib/services/projectService.ts`

```typescript
static async update(projectId: string, project: Partial<Project>) {
    try {
        const response = await apiClient.put(
            `${this.BASE_URL}/${projectId}`,
            project
        );
        return response;
    } catch (error) {
        console.error("Failed to update project:", error);
        throw error;
    }
}
```

#### Step 5: Add Update Handler to useProject Hook

**File:** `frontend/src/hooks/useProject.ts`

```typescript
const handleUpdateProject = async (
    projectId: string,
    updates: Partial<Project>
): Promise<Project | null> => {
    setLoading(true);
    setError(null);

    // Store original for rollback
    const originalProjects = [...projects];
    const originalSelected = selectedProject;

    try {
        // Optimistic update
        setProjects((prev) =>
            prev.map((p) =>
                p.id === projectId ? { ...p, ...updates } : p
            )
        );

        if (selectedProject?.id === projectId) {
            setSelectedProject({ ...selectedProject, ...updates });
        }

        const response = await ProjectService.update(projectId, updates);
        const updatedProject = response.data.project;

        // Confirm update with server response
        setProjects((prev) =>
            prev.map((p) =>
                p.id === projectId ? updatedProject : p
            )
        );

        if (selectedProject?.id === projectId) {
            setSelectedProject(updatedProject);
        }

        return updatedProject;
    } catch (err: any) {
        // Rollback on failure
        setProjects(originalProjects);
        setSelectedProject(originalSelected);

        const errorMessage = err.response?.data?.detail
            || err.message
            || "Failed to update project";
        setError(errorMessage);
        console.error("Failed to update project:", err);
        return null;
    } finally {
        setLoading(false);
    }
};
```

**Error Handling Pattern:** Optimistic updates with rollback provide responsive UX while maintaining data integrity.

#### Step 6: Create Edit Project Modal

**File:** `frontend/src/components/modals/EditProjectModal.tsx` (new)

```typescript
import { useState, useEffect } from "react";
import { z } from "zod";
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
import { Project } from "@/lib/entities/project";

// Validation schema
const projectSchema = z.object({
    name: z.string()
        .min(1, "Project name is required")
        .max(255, "Name must be 255 characters or less")
        .regex(/^[^<>]*$/, "Name contains invalid characters"),
    description: z.string()
        .max(2000, "Description must be 2000 characters or less")
        .optional(),
});

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (projectId: string, updates: Partial<Project>) => Promise<Project | null>;
}

export function EditProjectModal({
    isOpen,
    onClose,
    project,
    onUpdate,
}: EditProjectModalProps) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || "");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

    // Reset form when project changes
    useEffect(() => {
        setName(project.name);
        setDescription(project.description || "");
        setErrors({});
    }, [project]);

    const validate = (): boolean => {
        try {
            projectSchema.parse({ name, description: description || undefined });
            setErrors({});
            return true;
        } catch (e) {
            if (e instanceof z.ZodError) {
                const fieldErrors: { name?: string; description?: string } = {};
                e.errors.forEach((err) => {
                    if (err.path[0] === "name") {
                        fieldErrors.name = err.message;
                    } else if (err.path[0] === "description") {
                        fieldErrors.description = err.message;
                    }
                });
                setErrors(fieldErrors);
            }
            return false;
        }
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setLoading(true);

        // Only send changed fields
        const updates: Partial<Project> = {};
        if (name.trim() !== project.name) {
            updates.name = name.trim();
        }
        if ((description?.trim() || "") !== (project.description || "")) {
            updates.description = description.trim() || undefined;
        }

        if (Object.keys(updates).length === 0) {
            handleClose();
            return;
        }

        const result = await onUpdate(project.id!, updates);
        setLoading(false);

        if (result) {
            handleClose();
        }
    };

    const handleClose = () => {
        setName(project.name);
        setDescription(project.description || "");
        setErrors({});
        onClose();
    };

    const hasChanges =
        name.trim() !== project.name ||
        (description?.trim() || "") !== (project.description || "");

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
                            aria-invalid={!!errors.name}
                            aria-describedby={errors.name ? "name-error" : undefined}
                        />
                        {errors.name && (
                            <p id="name-error" className="text-sm text-red-500">
                                {errors.name}
                            </p>
                        )}
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
                            aria-invalid={!!errors.description}
                            aria-describedby={errors.description ? "desc-error" : undefined}
                        />
                        {errors.description && (
                            <p id="desc-error" className="text-sm text-red-500">
                                {errors.description}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {description.length}/2000 characters
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                    >
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

#### Step 7: Add Edit Button to Project Section

**File:** `frontend/src/components/sections/project-section.tsx`

```typescript
import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditProjectModal } from "@/components/modals/EditProjectModal";
import ChatInput from "@/components/inputs/ChatInput";
import { Project } from "@/lib/entities/project";
import { useProjectContext } from "@/context/ProjectContext";

interface ProjectSectionProps {
    project: Project;
    showAgentMenu?: boolean;
}

export function ProjectSection({
    project,
    showAgentMenu = false,
}: ProjectSectionProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const { handleUpdateProject } = useProjectContext();

    return (
        <>
            <img
                src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
                alt="Project Logo"
                className="w-32 h-32 mx-auto rounded-full"
            />
            <div className="flex items-center gap-2 mt-2">
                <h1 className="text-4xl font-bold">{project.name}</h1>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditModalOpen(true)}
                    aria-label="Edit project settings"
                    title="Edit project settings"
                >
                    <Settings className="h-5 w-5" />
                </Button>
            </div>
            <p className="text-lg mb-2">{project.description || "No description"}</p>
            <div className="flex flex-col w-full lg:w-[600px]">
                <ChatInput showAgentMenu={showAgentMenu} />
            </div>

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                project={project}
                onUpdate={handleUpdateProject}
            />
        </>
    );
}

export default ProjectSection;
```

---

## 4. Design Decisions

### 4.1 Security Trade-offs Considered

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Namespace-based authorization vs explicit ownership check | Simplicity vs explicitness | Namespace isolation is already proven pattern in codebase; adding explicit checks would be redundant |
| PUT vs PATCH endpoint | Full vs partial updates | PUT chosen for consistency with agent endpoint; service layer handles partial updates internally |
| Client-side validation | UX vs security | Not a replacement for server validation; provides immediate feedback |
| Optimistic updates | UX vs consistency | Acceptable for non-critical UI updates; rollback handles failures |

### 4.2 Authorization Model

```
Request Flow:
1. Client sends PUT /projects/{project_id} with Bearer token
2. verify_credentials extracts user.id from JWT
3. ServiceContext binds user.id to all services
4. ProjectService.update() calls get() first
5. get() queries store with namespace=(user_id, "projects")
6. If project not in user's namespace -> ValueError -> 404
7. If found -> proceed with update
```

**Key Security Property:** A user CANNOT modify another user's project because the namespace query will never return projects from a different user's namespace.

### 4.3 Input Validation Strategy

**Three-Layer Validation:**

1. **Frontend (Zod Schema)**
   - Immediate user feedback
   - Prevents obviously invalid requests
   - NOT a security boundary

2. **Backend Route (Pydantic Model)**
   - Type validation
   - Length constraints
   - Required field enforcement
   - Returns 422 for invalid input

3. **Service Layer (Business Logic)**
   - Allowlist of mutable fields
   - Ownership verification
   - Timestamp management

---

## 5. Risk Assessment

### 5.1 Security Vulnerabilities to Prevent

| Vulnerability | Mitigation | Priority |
|--------------|------------|----------|
| **IDOR (Insecure Direct Object Reference)** | Namespace-scoped queries; get-before-update pattern | Critical |
| **Mass Assignment** | Explicit field allowlist in service layer | High |
| **XSS via Project Name** | Regex validation; React's automatic escaping | High |
| **CSRF** | Token-based authentication (already in place) | Medium |
| **Injection** | Pydantic validation; parameterized store operations | High |
| **Information Disclosure** | Generic error messages; no stack traces in responses | Medium |

### 5.2 Edge Cases to Handle

| Edge Case | Expected Behavior | Test Required |
|-----------|-------------------|---------------|
| Update non-existent project | 404 Not Found | Yes |
| Update another user's project | 404 Not Found (not 403) | Yes |
| Empty update payload | 400 Bad Request | Yes |
| Name with only whitespace | 400 validation error | Yes |
| Name with XSS attempt | 400 validation error | Yes |
| Description exceeds 2000 chars | 400 validation error | Yes |
| Concurrent updates | Last write wins (acceptable) | No |
| Update while deleted | 404 Not Found | Yes |
| Network failure mid-update | Rollback on frontend | Yes |
| Session expires during edit | 401 + redirect to login | Existing |

### 5.3 Testing Requirements

#### Backend Tests

**File:** `backend/tests/integration/test_project_routes.py`

```python
import pytest
from uuid import uuid4

@pytest.mark.asyncio
async def test_update_project_success(async_client, auth_headers):
    """Test successful project update."""
    # Create project
    project_data = {"name": "Original Name", "description": "Original desc"}
    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Update project
    update_data = {"name": "Updated Name", "description": "Updated desc"}
    response = await async_client.put(
        f"/api/projects/{project_id}", json=update_data, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["project"]["name"] == "Updated Name"
    assert response.json()["project"]["description"] == "Updated desc"


@pytest.mark.asyncio
async def test_update_project_partial(async_client, auth_headers):
    """Test partial project update (only name)."""
    project_data = {"name": "Original", "description": "Keep this"}
    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    update_data = {"name": "New Name"}
    response = await async_client.put(
        f"/api/projects/{project_id}", json=update_data, headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["project"]["name"] == "New Name"
    assert response.json()["project"]["description"] == "Keep this"


@pytest.mark.asyncio
async def test_update_project_not_found(async_client, auth_headers):
    """Test updating non-existent project."""
    fake_id = str(uuid4())
    update_data = {"name": "Won't Work"}

    response = await async_client.put(
        f"/api/projects/{fake_id}", json=update_data, headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_project_empty_payload(async_client, auth_headers):
    """Test update with empty payload."""
    project_data = {"name": "Test"}
    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    response = await async_client.put(
        f"/api/projects/{project_id}", json={}, headers=auth_headers
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_project_invalid_name(async_client, auth_headers):
    """Test update with invalid name (XSS attempt)."""
    project_data = {"name": "Test"}
    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    update_data = {"name": "<script>alert('xss')</script>"}
    response = await async_client.put(
        f"/api/projects/{project_id}", json=update_data, headers=auth_headers
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_project_unauthorized(async_client):
    """Test update without authentication."""
    update_data = {"name": "Hacked"}

    response = await async_client.put(
        "/api/projects/some-id", json=update_data
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_other_users_project(async_client, auth_headers, other_user_auth_headers):
    """Test that user cannot update another user's project."""
    # Create project as first user
    project_data = {"name": "User 1 Project"}
    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Try to update as second user
    update_data = {"name": "Hijacked"}
    response = await async_client.put(
        f"/api/projects/{project_id}",
        json=update_data,
        headers=other_user_auth_headers
    )

    # Should get 404 (not 403) to prevent enumeration
    assert response.status_code == 404
```

#### Frontend Tests

**File:** `frontend/src/tests/services/projectService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProjectService from "@/lib/services/projectService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

describe("ProjectService.update", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should update project successfully", async () => {
        const mockResponse = {
            data: {
                project: {
                    id: "123",
                    name: "Updated Name",
                    description: "Updated desc",
                },
            },
        };
        (apiClient.put as any).mockResolvedValue(mockResponse);

        const result = await ProjectService.update("123", {
            name: "Updated Name",
            description: "Updated desc",
        });

        expect(apiClient.put).toHaveBeenCalledWith("/projects/123", {
            name: "Updated Name",
            description: "Updated desc",
        });
        expect(result.data.project.name).toBe("Updated Name");
    });

    it("should propagate 404 errors", async () => {
        const mockError = {
            response: {
                status: 404,
                data: { detail: "Project not found" },
            },
        };
        (apiClient.put as any).mockRejectedValue(mockError);

        await expect(
            ProjectService.update("nonexistent", { name: "Test" })
        ).rejects.toEqual(mockError);
    });

    it("should propagate validation errors", async () => {
        const mockError = {
            response: {
                status: 422,
                data: { detail: "Invalid name" },
            },
        };
        (apiClient.put as any).mockRejectedValue(mockError);

        await expect(
            ProjectService.update("123", { name: "" })
        ).rejects.toEqual(mockError);
    });
});
```

**File:** `frontend/src/tests/components/EditProjectModal.test.tsx`

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProjectModal } from "@/components/modals/EditProjectModal";

describe("EditProjectModal", () => {
    const mockProject = {
        id: "123",
        name: "Test Project",
        description: "Test description",
    };
    const mockOnClose = vi.fn();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with project data", () => {
        render(
            <EditProjectModal
                isOpen={true}
                onClose={mockOnClose}
                project={mockProject}
                onUpdate={mockOnUpdate}
            />
        );

        expect(screen.getByDisplayValue("Test Project")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
    });

    it("should show validation error for empty name", async () => {
        render(
            <EditProjectModal
                isOpen={true}
                onClose={mockOnClose}
                project={mockProject}
                onUpdate={mockOnUpdate}
            />
        );

        const nameInput = screen.getByPlaceholderText("Enter project name");
        await userEvent.clear(nameInput);

        const saveButton = screen.getByText("Save Changes");
        expect(saveButton).toBeDisabled();
    });

    it("should disable save when no changes made", () => {
        render(
            <EditProjectModal
                isOpen={true}
                onClose={mockOnClose}
                project={mockProject}
                onUpdate={mockOnUpdate}
            />
        );

        const saveButton = screen.getByText("Save Changes");
        expect(saveButton).toBeDisabled();
    });

    it("should call onUpdate with only changed fields", async () => {
        mockOnUpdate.mockResolvedValue({ id: "123", name: "New Name" });

        render(
            <EditProjectModal
                isOpen={true}
                onClose={mockOnClose}
                project={mockProject}
                onUpdate={mockOnUpdate}
            />
        );

        const nameInput = screen.getByPlaceholderText("Enter project name");
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, "New Name");

        const saveButton = screen.getByText("Save Changes");
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(mockOnUpdate).toHaveBeenCalledWith("123", {
                name: "New Name",
            });
        });
    });
});
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Complexity | Effort |
|-----------|------------|--------|
| Backend schema | Low | 1 hour |
| Backend service method | Low | 1 hour |
| Backend route | Low | 1 hour |
| Backend tests | Medium | 2 hours |
| Frontend service | Low | 30 min |
| Frontend hook | Medium | 1 hour |
| Frontend modal | Medium | 2 hours |
| Frontend section update | Low | 30 min |
| Frontend tests | Medium | 2 hours |

**Total Estimated Effort:** 11-12 hours

**Scope:** Medium

### 6.2 Risk Level Assessment

**Risk Level:** Low-Medium

**Justification:**
- Follows established patterns from agent edit flow
- Namespace-based security is already proven
- No database schema changes required
- Limited blast radius (project metadata only)

**Risk Factors:**
- Cache invalidation (30-second cache on GET /projects/{id})
- Concurrent update edge cases
- Mobile responsiveness testing needed

### 6.3 Suggested Implementation Priority

1. **Phase 1 - Backend Core (Priority: High)**
   - Add ProjectUpdate schema
   - Add ProjectService.update method
   - Add PUT route
   - Add security tests

2. **Phase 2 - Frontend Core (Priority: High)**
   - Add ProjectService.update
   - Add handleUpdateProject hook
   - Create EditProjectModal
   - Update ProjectSection

3. **Phase 3 - Testing & Polish (Priority: Medium)**
   - Frontend component tests
   - E2E test for edit flow
   - Mobile responsiveness
   - Cache invalidation handling

4. **Phase 4 - Documentation (Priority: Low)**
   - Update API documentation
   - Add to user wiki if applicable

---

## 7. Files Changed Summary

### New Files
- `backend/src/schemas/entities/project_update.py`
- `frontend/src/components/modals/EditProjectModal.tsx`
- `frontend/src/tests/components/EditProjectModal.test.tsx`

### Modified Files
- `backend/src/services/project.py` - Add update method
- `backend/src/routes/v0/project/__init__.py` - Add PUT route
- `backend/tests/integration/test_project_routes.py` - Enable and extend tests
- `frontend/src/lib/services/projectService.ts` - Add update method
- `frontend/src/hooks/useProject.ts` - Add handleUpdateProject
- `frontend/src/components/sections/project-section.tsx` - Add edit button
- `frontend/src/tests/services/projectService.test.ts` - Add update tests

---

## 8. Appendix: API Contract

### PUT /api/projects/{project_id}

**Request:**
```http
PUT /api/projects/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
    "name": "Updated Project Name",
    "description": "Updated description"
}
```

**Success Response (200):**
```json
{
    "project": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Updated Project Name",
        "description": "Updated description",
        "sources": [],
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-16T14:22:00Z"
    }
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{"detail": "No fields to update"}` | Empty payload |
| 401 | `{"detail": "No credentials provided"}` | Missing/invalid token |
| 404 | `{"detail": "Project <id> not found"}` | Project doesn't exist or belongs to another user |
| 422 | `{"detail": [...]}` | Validation errors |
| 500 | `{"detail": "Failed to update project"}` | Unexpected error |

---

*Document prepared by The Guardian - Security, Error Handling, and Testing Specialist*
*Version: 1.0*
*Date: 2026-01-16*
