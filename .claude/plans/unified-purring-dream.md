# Plan: VS Code-Style Activity Bar Sidebar Redesign

## Context

The current sidebar uses a traditional text-label + collapsible-section layout (~307px wide) that consumes significant horizontal space. The goal is to replicate the VS Code activity bar pattern: a narrow icon strip (~48px) on the far left, with a content panel that opens/closes beside it. This saves space when the panel is collapsed while keeping all navigation one click away.

**Screenshots studied:**
- `current.png` — Current text-row sidebar with Assistants, Memories, Projects, Schedules, Threads
- `vscode-example.png` — VS Code activity bar with icon tabs (search, files, git, extensions, testing)

## Recommended Approach

**Build new components inside the existing `<Sidebar>` primitive** rather than replacing `sidebar.tsx`. The existing infrastructure (SidebarProvider context, mobile Sheet, Ctrl+B shortcut, cookie persistence, CSS variable widths) is consumed by 16+ files and is too expensive to replace.

**Key insight:** The existing `collapsible="icon"` mode already shrinks the sidebar to `SIDEBAR_WIDTH_ICON = "3rem"` (48px) — exactly the width of a VS Code activity bar. We restructure the sidebar's internal layout from a single column to a two-column flex-row: activity bar (always visible) + content panel (hidden when collapsed).

### Architecture

```
┌──────────────────────────────────────────────────────┐
│ <Sidebar collapsible="icon">                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ <div className="flex flex-row h-full w-full">   │ │
│  │  ┌──────────┐  ┌────────────────────────────┐   │ │
│  │  │ Activity │  │ SidePanel                  │   │ │
│  │  │ Bar      │  │ (hidden when collapsed)    │   │ │
│  │  │ (48px)   │  │ (~259px)                   │   │ │
│  │  │          │  │                            │   │ │
│  │  │ [Logo]   │  │ Panel header + content:    │   │ │
│  │  │ [Bot]    │  │ - ThreadsPanel             │   │ │
│  │  │ [Brain]  │  │ - ProjectsPanel            │   │ │
│  │  │ [Folder] │  │ - SchedulesPanel           │   │ │
│  │  │ [Cal]    │  │ (Assistants/Memories are   │   │ │
│  │  │ [Msg]    │  │  route-only, no panel)     │   │ │
│  │  │          │  │                            │   │ │
│  │  │ [Gear]   │  │                            │   │ │
│  │  └──────────┘  └────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────┘ │
│  <SidebarRail /> (absolute, unchanged)               │
└──────────────────────────────────────────────────────┘
```

### State Management

Single `useState<PanelId>` inside `AppSidebar` — no new context needed:

```typescript
type PanelId = "assistants" | "memories" | "projects" | "schedules" | "threads" | null;
```

- Clicking **active** icon: `setActivePanel(null)` + `setOpen(false)` (collapses to icon-only)
- Clicking **inactive** icon: `setActivePanel(id)` + `setOpen(true)` (expands panel)
- Assistants/Memories: navigate via React Router AND set `activePanel` for visual highlight
- Projects/Schedules/Threads: toggle their content panel (no route change)
- `Ctrl+B`: existing `toggleSidebar()` toggles `open` state, activity bar stays visible in both states
- `useLocation()` auto-highlights Assistants/Memories icons based on current route

### Width Constants (unchanged in sidebar.tsx)

| Constant | Value | Meaning |
|---|---|---|
| `SIDEBAR_WIDTH` | `19.2rem` (307px) | 48px activity bar + 259px panel |
| `SIDEBAR_WIDTH_ICON` | `3rem` (48px) | Activity bar only (collapsed) |
| `SIDEBAR_WIDTH_MOBILE` | `21.6rem` (346px) | Both columns in mobile Sheet |

## Files to Create

### 1. `frontend/src/components/sidebar/ActivityBarItem.tsx`
- Icon button with VS Code-style left-border active indicator (`border-l-2 border-white` when active)
- Wraps content in existing `<Tooltip>` for hover label
- Props: `icon`, `label`, `isActive`, `onClick`, `data-tour?`
- ~40 lines

### 2. `frontend/src/components/sidebar/ActivityBar.tsx`
- 48px wide, full height, flex-col with `justify-between`
- Top section: small logo icon (links to `/`)
- Middle section: 5 nav icons (Bot, Brain, FolderKanban, Calendar, MessageSquare)
- Bottom section: Settings icon (reuses `SettingsPopover`)
- Wraps icons in `<TooltipProvider>`
- ~80 lines

### 3. `frontend/src/components/sidebar/panels/ThreadsPanel.tsx`
- Extract from `CollapsibleGroup` (type="threads" branch, lines 567-719)
- Contains `useVirtualizer`, infinite scroll handler, search button
- Renders `ThreadItem` components (imported, not duplicated)
- Props: threads, projects, loadMore, hasMore, isLoadingMore, onSearchClick
- ~100 lines

### 4. `frontend/src/components/sidebar/panels/ProjectsPanel.tsx`
- Extract from `ProjectsCollapsibleGroup` (lines 494-553)
- Contains "Create Project" button, renders `ProjectItem` list
- Props: projects, onCreateProject, onAddSource
- ~50 lines

### 5. `frontend/src/components/sidebar/panels/SchedulesPanel.tsx`
- Extract from `SchedulesCollapsibleGroup` (lines 722-801)
- Self-contained with own `useScheduleExecutions`/`useSchedules` hooks
- ~60 lines

### 6. `frontend/src/components/sidebar/SidePanel.tsx`
- Renders panel header (title text) + active panel content
- Switch on `activePanel` to render the correct panel component
- Hidden when sidebar is collapsed (via existing `group-data-[collapsible=icon]` CSS)
- ~60 lines

## Files to Modify

### 7. `frontend/src/components/drawers/app-sidebar.tsx`
- **Major refactor**: Replace the current `SidebarHeader + SidebarContent (collapsible groups) + SidebarFooter` with a `flex-row` wrapper containing `<ActivityBar />` + `<SidePanel />`
- Move `ThreadItem`, `ProjectItem`, `AssistantItem` definitions to separate files or keep inline (they're used only here)
- Add `activePanel` state and toggle logic
- Pass `collapsible="icon"` to `<Sidebar>` (instead of default `"offcanvas"`)
- Keep all modals (`CreateProjectModal`, `AddSourceModal`, `ThreadSearchModal`) at bottom
- Keep all context hooks (`useChatContext`, `useProjectContext`, etc.)

### 8. `frontend/src/components/ui/sidebar.tsx` (minimal change)
- No structural changes needed
- The only change: `AppSidebar` passes `collapsible="icon"` explicitly to `<Sidebar>`

### 9. `frontend/src/lib/config/onboardingSteps.ts`
- Update `data-tour` selectors to match new DOM structure

## Files NOT Modified
- `frontend/src/layouts/chat-layout-v2.tsx` — No changes needed, layout wrapper stays the same
- `frontend/src/components/sidebar/ScheduleSidebarItem.tsx` — Used as-is inside SchedulesPanel
- All context providers, hooks, services — No changes

## Visual Design

### Activity Bar Icons
```
Background: sidebar-background (matches current sidebar)
Icon size: 24px (w-6 h-6)
Icon color: sidebar-foreground/60 (inactive), sidebar-foreground (active)
Active indicator: 2px left border in primary/white color
Hover: bg-sidebar-accent/50
Spacing: gap-1 between icons
```

### Side Panel
```
Width: fills remaining space (~259px)
Header: section title + action button (search for threads, create for projects)
Content: scrollable, matches current styling
Border: border-l border-sidebar-border between activity bar and panel
```

## Verification Plan

1. `npm run build` — Ensure no TypeScript errors
2. `npm run test` — Ensure existing tests pass
3. `npm run dev:claude` — Visual verification:
   - Activity bar renders with 5 icons + logo + settings
   - Clicking Threads icon opens threads panel with virtual scroll
   - Clicking Projects icon switches to projects panel
   - Clicking active icon collapses to icon-only (48px)
   - Clicking Assistants icon navigates to `/assistants` route
   - Ctrl+B toggles panel open/closed
   - Tooltips appear on icon hover
   - Mobile: Sheet renders with both activity bar + panel
4. Use `agent-browser` skill with 1920x1080 viewport for screenshot validation
