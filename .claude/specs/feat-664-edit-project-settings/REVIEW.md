# REVIEW.md - Council Synthesis

## Feature Under Review: GitHub Issue #664 - Edit Project Information (Settings)

**Date:** 2026-01-16
**Council Members:** The Architect, The Craftsman, The Guardian
**Status:** APPROVED

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Architecture** | Modal pattern, follows CreateProjectModal | Modal pattern, matches agent config flow | Modal pattern with security layers | **Modal pattern confirmed** |
| **Backend Approach** | PUT endpoint, simple update | PUT endpoint, partial merge | PUT endpoint with validation schema | **PUT with ProjectUpdate schema** |
| **Frontend State** | useProject hook update | useProject with optimistic updates | Optimistic updates with rollback | **Optimistic updates with rollback** |
| **Validation** | Basic frontend + Pydantic | Zod frontend + Pydantic | 3-layer: Zod + Pydantic + Allowlist | **3-layer validation** |
| **Button Placement** | Near project avatar | Next to project name | Next to project name (with icon) | **Next to project name** |
| **Maintainability** | High - follows patterns | High - clean code focus | High - documented security | **High overall** |
| **Risk Level** | Low | Low | Low-Medium | **Low** |

---

## 2. Consensus Points

All three proposals agree on:

1. **Modal-based editing** - Follow `CreateProjectModal` pattern for consistency
2. **PUT endpoint** at `/projects/{project_id}` - Match existing codebase conventions
3. **File changes required**:
   - Backend: 3 files (repo, service, routes)
   - Frontend: 5 files (service, hook, modal, section, page)
4. **New modal component** named `EditProjectModal` or `ProjectSettingsModal`
5. **Settings button** visible on the project page for quick access
6. **Namespace-based authorization** - Existing security pattern is sufficient
7. **Scope: Medium, Risk: Low** - Well-defined requirements, established patterns

---

## 3. Divergence Analysis

### 3.1 Modal Naming
- ARCHITECT: `EditProjectModal`
- CRAFTSMAN: `ProjectSettingsModal`
- GUARDIAN: `EditProjectModal`

**Council Decision:** Use `EditProjectModal.tsx` - more explicit about the action being performed, consistent with naming pattern of other modals.

### 3.2 Validation Schema
- ARCHITECT: Inline validation in component, no Zod
- CRAFTSMAN: Zod schema in modal component
- GUARDIAN: Dedicated `ProjectUpdate` Pydantic model + Zod frontend + service-layer allowlist

**Council Decision:** Adopt Guardian's 3-layer approach:
1. Frontend Zod for UX
2. Backend Pydantic `ProjectUpdate` for API validation
3. Service-layer field allowlist for defense-in-depth

However, skip the separate `project_update.py` file - use inline validation in the route since there are only 2 fields.

### 3.3 Delete Functionality
- ARCHITECT: Not included in scope
- CRAFTSMAN: Included in modal with confirmation
- GUARDIAN: Not included in scope

**Council Decision:** **Exclude delete** from this modal. Delete already exists in sidebar. Keep scope focused on edit functionality per issue requirements.

### 3.4 Button Placement
- ARCHITECT: Absolute positioned near avatar
- CRAFTSMAN: Next to project name in header
- GUARDIAN: Next to project name (inline flex)

**Council Decision:** **Inline with project name** using flex layout - cleaner, more accessible, better mobile support.

### 3.5 Character Counter
- ARCHITECT: Not included
- CRAFTSMAN: Not included
- GUARDIAN: Character counter for description (2000 limit)

**Council Decision:** **Skip character counter** initially - adds complexity for minimal value. Can be added later if users hit limits.

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
Frontend                           Backend
─────────────────────────────────  ────────────────────────────────
ProjectPage.tsx                    PUT /projects/{project_id}
    │                                  │
    ▼                                  ▼
ProjectSection.tsx                 project/__init__.py (route)
    │ [Settings Button]                │
    ▼                                  ▼
EditProjectModal.tsx              ProjectService.update()
    │                                  │
    ▼                                  ▼
useProjectContext()               ProjectRepo.update()
    │                                  │
    ▼                                  ▼
ProjectService.update()           BaseRepo._set()
```

### 4.2 Implementation Sequence

**Phase 1: Backend (1-2 hours)**
1. Add `update()` method to `ProjectRepo`
2. Add `update()` method to `ProjectService`
3. Add `PUT /{project_id}` route with validation

**Phase 2: Frontend Service Layer (30 min)**
4. Add `update()` method to `projectService.ts`
5. Add `handleUpdateProject()` to `useProject` hook

**Phase 3: Frontend UI (2-3 hours)**
6. Create `EditProjectModal.tsx` component
7. Update `ProjectSection.tsx` with settings button
8. Update `ProjectPage.tsx` with callback wiring

**Phase 4: Testing (1-2 hours)**
9. Backend integration tests
10. Frontend component tests

### 4.3 Critical Path Items

1. **Backend update endpoint** - Foundation for all frontend work
2. **Namespace scoping** - Security relies on ServiceContext user_id binding
3. **State sync** - Must update both local and context state after update
4. **Mobile responsiveness** - Modal must work on all viewports

### 4.4 Non-Negotiable Requirements

1. ✅ Settings button accessible from project page
2. ✅ Modal pattern matching agent config flow
3. ✅ Clean UI/UX for desktop and mobile
4. ✅ Input validation (frontend and backend)
5. ✅ Namespace-scoped authorization (implicit via ServiceContext)

---

## 5. Risk Consolidation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **IDOR vulnerability** | Low | High | Namespace-scoped queries; get-before-update |
| **State sync issues** | Medium | Medium | Optimistic updates with rollback; update both local and context |
| **Cache stale data** | Low | Low | 30s cache expiry acceptable; update triggers fresh data |
| **Mobile layout breaks** | Medium | Medium | Use `max-w-md` dialog; test on mobile viewport |
| **Empty name submission** | Medium | Low | Zod + Pydantic validation; disable button when empty |
| **Network failure** | Low | Low | Error message in modal; keep form data intact |

**Risk Mitigation Strategies:**
1. Follow existing patterns exactly - no innovation needed
2. Test on mobile before PR
3. Validate both frontend and backend
4. Keep scope focused - no feature creep

---

## 6. Final Verdict

### Decision: ✅ GO

**Confidence Level:** HIGH

**Rationale:**
- All three agents converge on the same core architecture
- Well-established patterns exist in the codebase
- Scope is clearly defined with minimal ambiguity
- Risk is low with proper validation and authorization
- No database schema changes required
- Implementation can be completed in 4-7 hours

### Summary of Approved Approach

| Aspect | Decision |
|--------|----------|
| Component | `EditProjectModal.tsx` (new) |
| Trigger | Settings icon button inline with project name |
| Backend | `PUT /projects/{project_id}` |
| Validation | Zod (FE) + Pydantic (BE) + field allowlist |
| State | Optimistic updates with rollback |
| Delete | Not included (existing sidebar functionality) |
| Scope | Medium |
| Risk | Low |

---

## 7. Files Summary

### New Files (1)
- `frontend/src/components/modals/EditProjectModal.tsx`

### Modified Files (7)
| File | Changes |
|------|---------|
| `backend/src/repos/project_repo.py` | Add `update()` method |
| `backend/src/services/project.py` | Add `update()` method |
| `backend/src/routes/v0/project/__init__.py` | Add PUT route |
| `frontend/src/lib/services/projectService.ts` | Add `update()` method |
| `frontend/src/hooks/useProject.ts` | Add `handleUpdateProject()` |
| `frontend/src/components/sections/project-section.tsx` | Add settings button + modal |
| `frontend/src/pages/projects/ProjectPage.tsx` | Add update callback |

---

*Council Review completed on 2026-01-16*
*Document synthesized from PROPOSAL_ARCHITECT.md, PROPOSAL_CRAFTSMAN.md, PROPOSAL_GUARDIAN.md*
