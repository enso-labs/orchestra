# Plan: Sidebar Redesign - Consolidate Threads Under Projects

## Context

The current Orchestra sidebar separates projects and threads into two independent collapsible sections. Threads associated with a project are hidden from the sidebar entirely and only visible on the project page (`/p/:projectId`). This forces users to navigate away from the sidebar to see what threads exist within a project.

t3code (running at localhost:3773) uses a **project-centric tree** where threads are nested directly under their parent project in the sidebar, with per-project pagination ("Show more"/"Show less"), inline "Create new thread" buttons, and orphan threads collected in a separate bottom section. This is a more intuitive hierarchy that shows the thread-project relationship at a glance.

**Goal:** Redesign the Orchestra sidebar to match t3code's consolidated tree pattern.

## t3code Design Reference (from browser research)

```
Sidebar
  "Projects" header + "Add project" button
  Project "orchestra" (collapsible) + [+ New thread]
    Thread "Implement Agent-Browser..." [Plan Ready] 20d ago
    Thread "BUG: Starting New Chat..." [Plan Ready] 20d ago
    "Show more" / "Show less"
  Project "ryaneggz" (collapsible) + [+ New thread]
    Thread "New thread" 10d ago
  Project "deep-factor-agent" (collapsible) + [+ New thread]
    Thread "Load the prd skill..." 22d ago
  ---separator---
  "New thread" section (orphan threads)
  Settings
```

Key patterns: nested threads under projects, status badges, per-project lazy pagination, "Create new thread" per project, orphan threads at bottom.

## New User Flow (Empty State)

When a user has **no projects and no threads**, the sidebar shows:

```
Assistants
Memories

v Projects              [+]
  ┌─────────────────────┐
  │  No projects yet.   │
  │  [+ Create Project] │
  └─────────────────────┘

> Threads (0)
─────────────────────
Settings
```

- Projects section is **expanded by default** with an empty state message and prominent "Create Project" CTA
- Orphan "Threads" section remains at the bottom (collapsed, shows count)
- New threads created without a project go to the orphan "Threads" section
- This nudges users toward project-first organization from day one

---

## User Flow Diagram

```
                         +------------------+
                         |   User opens app |
                         +--------+---------+
                                  |
                         +--------v---------+
                         | Sidebar renders  |
                         | with Projects    |
                         | expanded         |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |                           |
           +--------v---------+       +--------v---------+
           | Has projects?    |       | Has orphan       |
           | NO               |       | threads? YES     |
           +--------+---------+       +--------+---------+
                    |                           |
           +--------v---------+       +--------v---------+
           | Show empty state |       | Show collapsed   |
           | "No projects yet"|       | "Threads (N)"    |
           | [+ Create Project|       | section at bottom|
           +--------+---------+       +--------+---------+
                    |
           +--------v---------+
           | User clicks      |
           | "Create Project" |
           +--------+---------+
                    |
           +--------v---------+
           | Project appears  |
           | in sidebar tree  |
           | (expanded, empty)|
           +--------+---------+
                    |
        +-----------+-----------+
        |                       |
+-------v--------+    +--------v---------+
| User clicks    |    | User clicks      |
| [+ New thread] |    | project chevron  |
| on project     |    | to collapse      |
+-------+--------+    +--------+---------+
        |                       |
+-------v--------+    +--------v---------+
| Navigate to    |    | Threads hidden   |
| /p/:id with    |    | State saved to   |
| project_id set |    | localStorage     |
| in metadata    |    +------------------+
+-------+--------+
        |
+-------v--------+
| User sends     |
| first message  |
+-------+--------+
        |
+-------v-----------------------+
| Thread appears nested under   |
| project in sidebar            |
| (compact: title + timestamp)  |
+-------+-----------------------+
        |
+-------v-----------------------+
| More threads accumulate...    |
| After 5 threads:              |
| [Show more] button appears    |
+-------+-----------------------+
        |
+-------v-----------------------+
| User clicks "Show more"      |
| Next 5 threads lazy-loaded   |
| via searchThreadsByProject()  |
+-------------------------------+


THREAD MOVE FLOW:
=================

+---------------------------+       +---------------------------+
| Thread in orphan section  |       | Thread under Project A    |
| User clicks [...] menu    |       | User clicks [...] menu    |
+------------+--------------+       +------------+--------------+
             |                                   |
+------------v--------------+       +------------v--------------+
| "Move to Project" submenu |       | "Move to Project" submenu |
| shows all projects        |       | shows all projects        |
+------------+--------------+       +------------+--------------+
             |                                   |
+------------v--------------+       +------------v--------------+
| User selects Project B    |       | User selects Project C    |
+------------+--------------+       +------------+--------------+
             |                                   |
+------------v--------------+       +------------v--------------+
| updateThreadProject() API |       | updateThreadProject() API |
+------------+--------------+       +------------+--------------+
             |                                   |
+------------v---------------------------------v-+
| Sync both states simultaneously:              |
|  - Remove from source (orphan or Project A)   |
|  - Add to destination (Project B or C)        |
|  - No flicker, no duplication                 |
+-----------------------------------------------+


SIDEBAR STATE TRANSITIONS:
==========================

  New User              First Project          Active User
  (empty)               Created                (multiple projects)
+---------------+   +------------------+   +------------------------+
| v Projects [+]|   | v Projects    [+]|   | v Projects          [+]|
|   No projects |   |   v MyProj  [+t] |   |   v Proj-A     [+t]   |
|   yet.        |   |     (no threads) |   |     Thread 1    2m ago |
|   [+ Create]  |   |                  |   |     Thread 2    1h ago |
|               |   | > Threads (3)    |   |     [Show more]        |
| > Threads (0) |   |                  |   |   > Proj-B     [+t]   |
|               |   | Settings         |   |     Thread 3    3h ago |
| Settings      |   +------------------+   |   > Proj-C     [+t]   |
+---------------+                          |                        |
                                           | > Threads (2)          |
                                           |                        |
                                           | Settings               |
                                           +------------------------+
```

---

## Implementation Plan

### 1. Create `useProjectThreads` hook

**New file:** `frontend/src/hooks/useProjectThreads.ts`

- Manages a `Map<projectId, { threads, loading, hasMore, loaded }>` state
- `fetchProjectThreads(projectId)` - lazy-loads on first project expand using existing `searchThreadsByProject()` from `threadService.ts:291`
- `loadMoreProjectThreads(projectId)` - pagination (5 threads per page)
- `addThreadToProject(thread, projectId)` / `removeThreadFromProject(threadKey, projectId)` - local state mutations for cross-section sync
- Stores expanded project IDs in `localStorage` for persistence across reloads

### 2. Create `ProjectTreeGroup` component

**New file:** `frontend/src/components/sidebar/ProjectTreeGroup.tsx`

Replaces `ProjectsCollapsibleGroup` (currently at `app-sidebar.tsx:494-554`).

```
ProjectTreeGroup
  "Create Project" button
  for each project:
    ProjectTreeItem (collapsible)
      Trigger: project name + chevron + [+ New thread] button
      Content:
        ThreadItem (compact variant) for each thread
        "Show more" button (if hasMore)
        Loading spinner (if fetching)
```

- Uses `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` from `sidebar.tsx:701-752` (already exported but unused) for nested thread rendering
- Each `ProjectTreeItem` triggers `fetchProjectThreads(projectId)` on expand
- "Create new thread" button sets `metadata.project_id` and navigates to `/p/:projectId`

### 3. Modify `ThreadItem` for compact variant

**File:** `frontend/src/components/drawers/app-sidebar.tsx` (lines 146-362)

Add props:
- `compact?: boolean` - tighter styling, single-line layout, less padding
- `parentProjectId?: string` - changes click navigation to `/p/:projectId/t/:threadId`

No new component needed - reuses existing dropdown menu, delete, and move-to-project logic.

### 4. Update `AppSidebar` composition

**File:** `frontend/src/components/drawers/app-sidebar.tsx` (lines 837-920)

Changes:
- Replace `ProjectsCollapsibleGroup` (line 904) with `ProjectTreeGroup`
- Set Projects section `defaultOpen={true}` (was `false`)
- Set Threads section `defaultOpen={false}` (was `true`) - orphan threads become secondary
- Wire `useProjectThreads` hook
- Update `handleAddToProject` to sync both orphan threads list and project threads map

### 5. State synchronization

When a thread is moved between projects (via `ThreadItem` dropdown):
- Remove from source (orphan list or source project's thread list)
- Add to destination (target project's thread list or orphan list)
- Both updates happen synchronously in the same handler to prevent duplication

---

## Critical Files

| File | Role |
|------|------|
| `frontend/src/components/drawers/app-sidebar.tsx` | Main sidebar - modify `ProjectsCollapsibleGroup`, `ThreadItem`, `AppSidebar` |
| `frontend/src/components/ui/sidebar.tsx` | Reuse `SidebarMenuSub*` primitives (lines 701-752) |
| `frontend/src/lib/services/threadService.ts` | Existing `searchThreadsByProject()` (line 291) - no changes needed |
| `frontend/src/hooks/useProjectThreads.ts` | **New** - per-project thread fetching hook |
| `frontend/src/components/sidebar/ProjectTreeGroup.tsx` | **New** - project tree with nested threads |
| `frontend/src/context/ProjectContext.tsx` | May need thread mutation callbacks |
| `frontend/src/components/lists/ListProjectThreads.tsx` | Reference for `searchThreadsByProject` usage pattern |

## What NOT to change

- No backend/API changes needed
- No routing changes needed (existing `/p/:projectId/t/:threadId` route works)
- No virtual scrolling for project trees (paginated at 5 items, manageable count)
- Keep virtual scrolling for orphan threads section (can grow large)

---

## Deliverable: GitHub Issue

Create a GitHub issue using `gh issue create` with the feature_request template, populated with the research findings above. The issue content is drafted below.

**Title:** `feat: Redesign sidebar to consolidate threads under projects (t3code pattern)`

**Labels:** `enhancement`

### Issue Body

#### User Stories

- As a **user with multiple projects**, I want **threads nested under their parent project in the sidebar** so that **I can see all project activity without navigating to a separate page**.
- As a **user managing threads**, I want **inline "Create new thread" buttons per project** so that **I can start a new conversation in the correct project context immediately**.
- As a **user with many threads**, I want **per-project "Show more"/"Show less" pagination** so that **the sidebar stays manageable without hiding my work**.

#### Summary

Redesign the sidebar to consolidate threads under their parent projects in a collapsible tree, matching the t3code pattern observed at localhost:3773. Currently, projects and threads are separate sidebar sections -- project threads are only visible on the project page. The new design nests threads directly under each project with lazy-loaded pagination, inline thread creation, and orphan threads in a separate bottom section.

##### Visual Reference

- t3code sidebar screenshots captured during research (project tree with nested threads, status badges, "Show more"/"Show less" per project)
- Current Orchestra sidebar: flat `Projects` (collapsed) + `Threads` (expanded, orphans only)

#### Key Integration Points

| File | Function(s) | Role |
|------|-------------|------|
| `frontend/src/components/drawers/app-sidebar.tsx` | `ProjectsCollapsibleGroup` (L494-554), `ThreadItem` (L146-362), `AppSidebar` (L837-920) | Main sidebar composition - replace ProjectsCollapsibleGroup, add compact variant to ThreadItem |
| `frontend/src/lib/services/threadService.ts` | `searchThreadsByProject()` (L291) | Existing API for fetching threads by project - no changes needed |
| `frontend/src/components/ui/sidebar.tsx` | `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` (L701-752) | Existing unused primitives for nested menu items - reuse for thread nesting |
| `frontend/src/context/ProjectContext.tsx` | `ProjectProvider` | May need thread mutation callbacks for cross-section sync |
| `frontend/src/components/lists/ListProjectThreads.tsx` | `searchThreadsByProject` usage | Reference pattern for project thread fetching |

#### UI Integration Points

| Component / Route | Change Type | Description |
|-------------------|-------------|-------------|
| `ProjectsCollapsibleGroup` (`app-sidebar.tsx`) | Replace | New `ProjectTreeGroup` with nested threads per project |
| `ThreadItem` (`app-sidebar.tsx`) | Modify | Add `compact` and `parentProjectId` props for nested display |
| `CollapsibleGroup` threads section (`app-sidebar.tsx`) | Modify | Change to `defaultOpen={false}`, now secondary for orphan threads |
| `ProjectTreeGroup` (new) | New component | Collapsible project tree with nested thread items |
| `useProjectThreads` (new hook) | New hook | Per-project lazy thread fetching with pagination |

#### Storage

- **Persistence layer**: No new storage -- threads already have `project_id` in LangGraph Store
- **Namespace / table**: Existing thread metadata `{ project_id }` relationship
- **Local state**: `useProjectThreads` hook manages `Map<projectId, ThreadsState>` in React state; expanded project IDs persisted in `localStorage`

#### Architectural Decisions

- **No virtual scrolling for project trees**: Per-project pagination caps at 5 items per page, keeping rendered DOM manageable. Virtual scrolling remains for the orphan threads section.
- **Lazy fetching**: Project threads only fetched when user expands that project in the sidebar (not on mount), using existing `searchThreadsByProject()` API.
- **State sync**: When a thread is moved between projects, both the orphan threads list (`ChatContext`) and the project threads map (`useProjectThreads`) are updated synchronously to prevent duplication.
- **Reuse existing primitives**: `SidebarMenuSub*` components from `sidebar.tsx` (currently unused) provide the nested indentation and left-border styling.

#### Documentation

- t3code reference implementation at localhost:3773
- Existing `SidebarMenuSub` components in `sidebar.tsx` (L701-752) designed for exactly this nested pattern

#### Development Setup

| Service | Address | Notes |
|---------|---------|-------|
| Frontend dev | `localhost:5173` or `localhost:8030` | `npm run dev` or `npm run dev:claude` |
| Backend API | `localhost:8000` | Required for thread/project APIs |

#### Design Principles

- Simplicity is beauty, complexity is pain.
- ALWAYS look at the current codebase first -- achieve the goal in the least amount of changes.
- Reuse `ThreadItem` with a compact variant rather than creating a duplicate component.
- Reuse existing `SidebarMenuSub*` primitives rather than custom nesting CSS.

#### Validation Tools

- [ ] Load `agent-browser` skill with screenshots to validate E2E sidebar tree rendering

#### Acceptance Criteria

- [ ] Implementation plan is thoroughly documented
- [ ] Projects section is expanded by default with threads nested under each project
- [ ] Clicking a project chevron expands/collapses its thread list (lazy fetch on first expand)
- [ ] "Show more"/"Show less" paginates threads within a project (5 per page)
- [ ] Inline "Create new thread" button per project navigates to `/p/:projectId` with correct metadata
- [ ] Moving a thread between projects updates both sidebar sections without duplication or flicker
- [ ] Orphan threads (no `project_id`) still appear in bottom "Threads" section (collapsed by default)
- [ ] Mobile sidebar (Sheet) works correctly with nested project tree
- [ ] Expanded project state persists across page reloads via localStorage
- [ ] New user (no projects) sees empty state with "No projects yet" message and "Create Project" CTA
- [ ] All previous & new tests pass, validated using `agent-browser` CLI
- [ ] New code follows existing repo/service/route patterns
- [ ] No new dependencies added beyond what's already in the project
