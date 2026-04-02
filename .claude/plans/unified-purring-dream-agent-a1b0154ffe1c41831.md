# VS Code-Style Activity Bar + Side Panel Implementation Plan

## Executive Summary

Convert the Orchestra app's monolithic sidebar into a VS Code-style two-column layout:
a narrow **Activity Bar** (~48px) with icon buttons on the far left, and a collapsible
**Side Panel** (~260px) that shows content for the selected section. Clicking the active
icon toggles the panel closed; clicking an inactive icon switches sections.

---

## 1. Architectural Decision: Modify Existing vs. Build New

### Recommendation: **Build a new `ActivityBarSidebar` wrapper INSIDE the existing `Sidebar` primitive**

**Why not modify `sidebar.tsx`?**
- `sidebar.tsx` is a shared shadcn/ui primitive used across the entire app (16+ files import from it)
- It handles mobile Sheet rendering, cookie-based persistence, keyboard shortcuts (Ctrl+B), CSS variable-driven widths, and the `SidebarProvider` context
- Modifying its internals risks breaking all pages and tests

**Why not build completely outside `Sidebar`?**
- We would lose the `SidebarProvider` context (open/collapsed state, mobile detection, toggleSidebar, keyboard shortcut)
- Every page that uses `<ChatLayout>` would need changes
- The CSS variable system (`--sidebar-width`, `--sidebar-width-icon`) that controls main content offset would need reimplementation

**The hybrid approach:**
- Keep `<Sidebar>` as the outer container — it manages positioning, width, mobile Sheet, and the gap div
- Replace the *contents* of `<Sidebar>` (currently Header + Content + Footer + Rail) with a new two-column flex layout: `<ActivityBar>` + `<SidePanel>`
- Adjust `SIDEBAR_WIDTH` to `"19.2rem"` (stays the same or slightly wider) to accommodate 48px activity bar + ~260px panel
- When the panel is "closed" (only activity bar visible), the sidebar is in its existing `collapsed` state using `SIDEBAR_WIDTH_ICON = "3rem"` — this already works!

This approach touches only **2 files** for the core change (`app-sidebar.tsx` and `sidebar.tsx` constants), plus the new component files.

---

## 2. State Management for Active Panel

### New state: `activePanel`

```typescript
type PanelId = "assistants" | "memories" | "projects" | "schedules" | "threads" | null;
```

**Where to put it:** Inside `AppSidebar` component as local `useState`. No need for context — the activity bar and side panel are siblings within the same component.

**Toggle logic:**
```typescript
const [activePanel, setActivePanel] = useState<PanelId>("threads"); // default open to threads

const handleIconClick = (panelId: PanelId) => {
  if (activePanel === panelId) {
    // Clicking active icon → close the panel
    setActivePanel(null);
    // Use existing sidebar context to collapse
    setOpen(false);
  } else {
    setActivePanel(panelId);
    // Ensure sidebar is open
    if (!open) setOpen(true);
  }
};
```

**Interaction with existing `SidebarProvider`:**
- `open === true` + `activePanel !== null` → Activity bar + side panel visible
- `open === false` → Only activity bar visible (existing collapsed behavior)
- When user presses Ctrl+B → `toggleSidebar()` fires, which toggles `open`. When reopening, restore last `activePanel` (or default to "threads")
- On mobile: Sheet opens with full sidebar (activity bar + panel)

### Hybrid navigation items (route links vs. content panels)

Currently Assistants and Memories are `<Link>` elements that navigate to `/assistants` and `/memories`. In the new design, they should:
1. **Always navigate** to their route when clicked
2. **Also activate** their panel section (which can show a mini-preview or just indicate you're on that page)
3. Since these pages render their own full content area, the side panel for these could either:
   - Option A: Show nothing / show a simplified view (just the icon highlighted, panel hidden)
   - Option B: Show the same content that was in the sidebar section

**Recommended: Option A for Assistants/Memories, Option B for Projects/Schedules/Threads.**

Assistants and Memories are full pages — when clicked, navigate to the route AND close the panel (or keep it open on the last content panel). Projects, Schedules, and Threads show content lists in the panel (just like they do now in the collapsible sections).

Updated behavior for route-link items:
```typescript
const handleRouteIconClick = (panelId: PanelId, route: string) => {
  navigate(route);
  // For route-based items, set them as active but they don't show a panel
  // OR toggle the panel off, leaving just the icon highlighted
  setActivePanel(panelId);
};
```

---

## 3. Component Structure and File Organization

### New files to create:

```
frontend/src/components/sidebar/
├── ActivityBar.tsx              # The narrow icon strip
├── SidePanel.tsx                # The content panel container
├── panels/
│   ├── ThreadsPanel.tsx         # Threads content (extracted from CollapsibleGroup)
│   ├── ProjectsPanel.tsx        # Projects content (extracted from ProjectsCollapsibleGroup)
│   ├── SchedulesPanel.tsx       # Schedules content (extracted from SchedulesCollapsibleGroup)
│   ├── AssistantsPanel.tsx      # (optional) placeholder or mini-view
│   └── MemoriesPanel.tsx        # (optional) placeholder or mini-view
├── ActivityBarItem.tsx          # Individual icon button with tooltip
└── ScheduleSidebarItem.tsx      # (already exists, keep as-is)
```

### Files to modify:

1. **`frontend/src/components/drawers/app-sidebar.tsx`** — Major refactor: replace current layout with ActivityBar + SidePanel composition
2. **`frontend/src/components/ui/sidebar.tsx`** — Minor: adjust `SIDEBAR_WIDTH` constant and add a new CSS variable `--activity-bar-width`
3. **`frontend/src/styles/globals.css`** — Add `--activity-bar-width: 3rem` CSS variable (optional, could inline)
4. **`frontend/src/lib/config/onboardingSteps.ts`** — Update `data-tour` selectors to match new DOM structure
5. **Tests** — Update mocks in `ThreadPage.test.tsx`, `thread.test.tsx`, `ChatPanel.test.tsx`

### Files that need NO changes:
- `frontend/src/layouts/chat-layout-v2.tsx` — No change (still renders `<AppSidebar />`)
- All page files — No change (they use `<ChatLayout>` which wraps `<AppSidebar>`)
- `ChatNav` — No change (still receives `<SidebarTrigger />`)

---

## 4. CSS/Tailwind Approach for the Two-Column Layout

### Inside the `<Sidebar>` container

The existing `<Sidebar>` renders a `<div data-sidebar="sidebar">` with `flex h-full w-full flex-col`. We change the inner structure:

```tsx
// Inside <Sidebar>, replace the single column with:
<div data-sidebar="sidebar" className="flex h-full w-full flex-row bg-sidebar">
  <ActivityBar />        {/* 48px fixed-width column */}
  <SidePanel />          {/* flex-1, takes remaining width */}
</div>
```

### Activity Bar styling:

```tsx
<div className="flex flex-col items-center w-12 shrink-0 border-r border-sidebar-border bg-sidebar py-2 gap-1">
  {/* Logo at top */}
  {/* Nav icons in middle (flex-1) */}
  {/* Settings at bottom */}
</div>
```

### Activity Bar Item styling (VS Code indicator):

```tsx
<button className={cn(
  "relative flex items-center justify-center w-10 h-10 rounded-md",
  "text-sidebar-foreground/60 hover:text-sidebar-foreground",
  "transition-colors",
  isActive && "text-sidebar-foreground",
  // VS Code left-border indicator
  isActive && "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-sidebar-primary before:rounded-full"
)}>
```

### Side Panel styling:

```tsx
<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
  {/* Panel header with section title */}
  <div className="px-3 py-2 border-b border-sidebar-border shrink-0">
    <h3 className="text-sm font-semibold text-sidebar-foreground">{title}</h3>
  </div>
  {/* Panel content - scrollable */}
  <div className="flex-1 overflow-auto">
    {/* Render the active panel's content */}
  </div>
</div>
```

### Width management:

Current: `SIDEBAR_WIDTH = "19.2rem"` (307px) for expanded, `SIDEBAR_WIDTH_ICON = "3rem"` for collapsed.

New approach:
- `SIDEBAR_WIDTH = "19.2rem"` — keep the same total width (activity bar 48px + panel 259px = 307px)
- `SIDEBAR_WIDTH_ICON = "3rem"` — collapsed state shows ONLY the activity bar (48px)
- The existing `collapsible="offcanvas"` default slides the entire sidebar off-screen. We should switch to `collapsible="icon"` mode so the activity bar stays visible when "collapsed"

**Key change in `sidebar.tsx`:** The `Sidebar` component's default `collapsible` prop should be changed from `"offcanvas"` to `"icon"` for this use case, OR we pass it explicitly from `AppSidebar`:

```tsx
<Sidebar collapsible="icon" {...props}>
```

When `collapsible="icon"` and `state="collapsed"`, the sidebar shrinks to `--sidebar-width-icon` (3rem = 48px), which is exactly the activity bar width. The side panel content will be hidden via `overflow-hidden` on the parent (already handled by the existing `group-data-[collapsible=icon]:overflow-hidden` on `SidebarContent`).

**However**, there is a problem: with `collapsible="icon"`, the existing shadcn sidebar hides text content via `group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0` on labels. We need the activity bar icons to ALWAYS be visible, even in collapsed state. 

**Solution:** The activity bar is rendered OUTSIDE the `SidebarContent` component. It lives at the same level as `SidebarContent` inside the `data-sidebar="sidebar"` flex container. Only the `SidePanel` (rendered inside `SidebarContent`) gets hidden/shown.

Updated structure:
```tsx
<Sidebar collapsible="icon" {...props}>
  <div className="flex h-full w-full flex-row">
    <ActivityBar />                    {/* Always visible, 48px */}
    <SidebarContent>                   {/* Hidden when collapsed via existing CSS */}
      <SidePanel activePanel={activePanel} />
    </SidebarContent>
  </div>
</Sidebar>
```

Wait — `SidebarContent` uses `group-data-[collapsible=icon]:overflow-hidden` which would hide the panel's scrollable content. That is actually what we want: when collapsed, the SidebarContent portion (the side panel) is hidden, and only the ActivityBar remains visible.

But we need to verify: does `collapsible="icon"` mode properly shrink the width? Looking at the code:
- The gap div: `group-data-[collapsible=icon]:w-[--sidebar-width-icon]` — YES, shrinks to 48px
- The fixed sidebar div: `group-data-[collapsible=icon]:w-[--sidebar-width-icon]` — YES, shrinks to 48px

So in collapsed state, the entire sidebar is 48px wide. The `<ActivityBar>` at 48px fills it. The `<SidebarContent>` wrapper gets `overflow-hidden` and effectively zero width. This works.

### Mobile behavior:

The existing `Sidebar` component renders a `<Sheet>` on mobile. Inside the Sheet, it renders `{children}` in a full-width flex column. The same ActivityBar + SidePanel flex-row layout will render inside the Sheet. On mobile, the Sheet is `--sidebar-width-mobile: 21.6rem` (345px), giving plenty of room for both columns.

For mobile, we should always show both the activity bar and panel (default to threads or last-selected panel).

---

## 5. Handling the Hybrid Behavior (Route Links vs. Content Panels)

### Classification of nav items:

| Item        | Icon          | Behavior                                            | Panel Content                          |
|-------------|---------------|-----------------------------------------------------|----------------------------------------|
| Assistants  | Bot           | Navigate to `/assistants` + highlight icon           | None (route handles content)           |
| Memories    | Brain         | Navigate to `/memories` + highlight icon             | None (route handles content)           |
| Projects    | FolderKanban  | Open side panel with projects list                   | Project list + create button           |
| Schedules   | Calendar      | Open side panel with schedules                       | Recent executions + "View All" button  |
| Threads     | MessageSquare | Open side panel with threads                         | Virtual scroll thread list + search    |

### Auto-detection of active panel from route:

We can use `useLocation()` to auto-highlight the correct icon based on the current route:

```typescript
const { pathname } = useLocation();

// Derive which icon should be highlighted from the route
const routeBasedPanel: PanelId | null = useMemo(() => {
  if (pathname.startsWith("/assistants") || pathname.startsWith("/assistant/")) return "assistants";
  if (pathname.startsWith("/memories")) return "memories";
  if (pathname.startsWith("/p/")) return "projects";
  if (pathname.startsWith("/schedules")) return "schedules";
  if (pathname.startsWith("/thread/") || pathname === "/chat") return "threads";
  return null;
}, [pathname]);
```

The `activePanel` state controls which panel content is shown. The `routeBasedPanel` is used to determine which icon gets the active indicator. These can differ: you might be on the `/assistants` page but have the Threads panel open.

**Simplification:** Use `routeBasedPanel` as a fallback highlight, but `activePanel` takes precedence for the left-border indicator. This keeps the UX intuitive.

---

## 6. Detailed Component Specifications

### 6a. `ActivityBar.tsx`

```typescript
interface ActivityBarProps {
  activePanel: PanelId;
  highlightedRoute: PanelId | null;
  onPanelSelect: (panelId: PanelId) => void;
  onRouteNavigate: (panelId: PanelId, route: string) => void;
  clearMessages: () => void;
}
```

Layout:
- Top: Small logo icon (the existing circular avatar, scaled to ~28px), links to `/`
- Middle (flex-1): 5 icon buttons stacked vertically
- Bottom: Settings icon button (triggers existing SettingsPopover)

Each icon button wrapped in `<Tooltip>` from existing tooltip component, showing on the right side.

### 6b. `ActivityBarItem.tsx`

```typescript
interface ActivityBarItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  dataTour?: string;  // preserve onboarding hooks
}
```

### 6c. `SidePanel.tsx`

```typescript
interface SidePanelProps {
  activePanel: PanelId;
  // All the data/callbacks needed by child panels, passed through
}
```

Renders a panel header (section title) and the content for the active panel. Uses a simple switch/conditional render.

### 6d. `ThreadsPanel.tsx`

Extracted from the current `CollapsibleGroup` with `type="threads"`. Receives:
- `threads`, `projects`, `loadMore`, `hasMore`, `isLoadingMore`, `onSearchClick`
- Contains the virtualizer, scroll handler, `ThreadItem` rendering
- No longer wrapped in `Collapsible` — always expanded (it IS the panel content)

### 6e. `ProjectsPanel.tsx`

Extracted from `ProjectsCollapsibleGroup`. Receives:
- `projects`, `onCreateProject`, `onAddSource`
- Contains "Create Project" button + project list
- No longer wrapped in `Collapsible`

### 6f. `SchedulesPanel.tsx`

Extracted from `SchedulesCollapsibleGroup`. Self-contained with its own hooks:
- `useScheduleExecutions`, `useSchedules`
- Contains "View All Schedules" button + execution list

---

## 7. Migration Plan (Step-by-Step Implementation Order)

### Phase 1: Foundation (no visual change yet)

**Step 1:** Create `ActivityBarItem.tsx` component
- Simple icon button with tooltip, active state styling, `data-tour` support

**Step 2:** Create `ActivityBar.tsx` component
- Vertical column of `ActivityBarItem` instances
- Logo at top, settings at bottom
- Accept callbacks for panel selection and route navigation

**Step 3:** Extract panel content components
- `ThreadsPanel.tsx` — extract from `CollapsibleGroup` (type="threads" branch)
- `ProjectsPanel.tsx` — extract from `ProjectsCollapsibleGroup`
- `SchedulesPanel.tsx` — extract from `SchedulesCollapsibleGroup`
- Keep `ThreadItem`, `ProjectItem`, `AssistantItem`, `ScheduleSidebarItem` in their existing locations (or co-locate)

**Step 4:** Create `SidePanel.tsx`
- Renders panel header + conditionally renders the active panel content component

### Phase 2: Integration

**Step 5:** Modify `app-sidebar.tsx`
- Add `activePanel` state
- Replace all current `SidebarHeader`/`SidebarContent`/`SidebarFooter` contents with `ActivityBar` + `SidePanel` in a flex-row
- Wire up all the same context hooks and callbacks
- Keep the modal renders (`CreateProjectModal`, `AddSourceModal`, `ThreadSearchModal`) at the bottom

**Step 6:** Modify `sidebar.tsx`
- Change default `collapsible` to `"icon"` (or pass explicitly from `AppSidebar`)
- Adjust `SIDEBAR_WIDTH_ICON` if needed (current `3rem` = 48px, which is perfect)
- Potentially adjust the inner `data-sidebar="sidebar"` div from `flex-col` to allow our `flex-row` children

**Step 7:** Update `onboardingSteps.ts`
- Update `data-tour` selectors to match new DOM structure
- The sidebar target stays the same
- Individual section targets need to point to the activity bar icons or the panel content

### Phase 3: Polish

**Step 8:** Handle edge cases
- Ctrl+B toggle: when sidebar reopens, restore `activePanel` to its last value (use `useRef` to persist)
- Route changes: when navigating to `/assistants`, optionally auto-switch the highlight
- Mobile: ensure Sheet renders the full two-column layout correctly

**Step 9:** Update tests
- `ThreadPage.test.tsx`, `thread.test.tsx`, `ChatPanel.test.tsx` — update sidebar mocks if component structure changed

**Step 10:** Visual refinement
- Active indicator styling (left border highlight)
- Transition animations for panel show/hide
- Hover states on activity bar icons
- Ensure scrollbar styling works in panel

---

## 8. Potential Challenges and Mitigations

### Challenge 1: SidebarContent overflow-hidden in collapsed state
The existing `SidebarContent` has `group-data-[collapsible=icon]:overflow-hidden`. This will hide the side panel when collapsed. But we need the ActivityBar to remain visible.

**Mitigation:** Render `ActivityBar` as a sibling of `SidebarContent`, not inside it. The outer `data-sidebar="sidebar"` div becomes `flex-row`. The ActivityBar has fixed width and is not affected by the collapse CSS. Only `SidebarContent` (containing `SidePanel`) is affected.

### Challenge 2: group-data-[collapsible=icon] CSS selectors
Many existing sidebar sub-components use `group-data-[collapsible=icon]:*` selectors to hide text when collapsed. Since we are no longer using these sub-components in their original way (no `SidebarGroupLabel`, no `SidebarMenuButton` in the activity bar), this is mostly a non-issue. The panel content components use these primitives internally, but they are inside `SidebarContent` which gets `overflow-hidden` anyway.

**Mitigation:** For any visual glitches, override with explicit classes on the panel components.

### Challenge 3: Sidebar width in collapsed state
When collapsed (activity bar only), the sidebar should be exactly 48px. Current `SIDEBAR_WIDTH_ICON = "3rem"` = 48px. This matches perfectly.

### Challenge 4: Existing SidebarRail behavior
`SidebarRail` is a drag handle for resizing/toggling the sidebar. It calls `toggleSidebar()`. This should continue to work — clicking it toggles between showing activity bar only (collapsed) and activity bar + panel (expanded).

**Mitigation:** Keep `<SidebarRail />` rendered, it works with the existing toggle mechanism.

### Challenge 5: The `data-sidebar="sidebar"` div uses `flex-col`
The inner sidebar div has `className="flex h-full w-full flex-col"`. We need `flex-row` for the activity bar + panel layout.

**Mitigation:** This requires a small change in `sidebar.tsx` — either:
- Add a prop to `Sidebar` to control flex direction, OR
- Override with a className passed to the children wrapper, OR
- Change the inner div to `flex-row` and wrap the panel content in a `flex-col` container

The cleanest approach: change the `data-sidebar="sidebar"` div to NOT specify flex direction, and let the children define it. Or more precisely, since this is a shared component, add a `className` pass-through for the inner div.

Actually, looking more carefully at the code, the `<Sidebar>` component renders:
```tsx
<div data-sidebar="sidebar" className="flex h-full w-full flex-col ...">
  {children}
</div>
```

The `children` are what `AppSidebar` passes: `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarRail`. We can simply wrap all of our content in a single flex-row div:

```tsx
<Sidebar>
  <div className="flex flex-row h-full w-full">
    <ActivityBar />
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden
                    group-data-[collapsible=icon]:hidden">
      <SidebarContent>
        <SidePanel />
      </SidebarContent>
    </div>
  </div>
  <SidebarRail />
</Sidebar>
```

The parent `flex-col` from `data-sidebar="sidebar"` will stack our flex-row wrapper and the SidebarRail. Since SidebarRail is absolutely positioned, this works fine.

### Challenge 6: Mobile Sheet rendering
On mobile, the `Sidebar` renders a `<Sheet>` that wraps `{children}` in `flex-col`. Same approach — our flex-row wrapper inside will work because it is a child that can override its own layout.

---

## 9. Sidebar Width Constant Adjustments

Current constants in `sidebar.tsx`:
```typescript
const SIDEBAR_WIDTH = "19.2rem";        // 307px - expanded
const SIDEBAR_WIDTH_MOBILE = "21.6rem"; // 346px - mobile sheet
const SIDEBAR_WIDTH_ICON = "3rem";      // 48px  - collapsed/icon mode
```

Proposed changes:
- `SIDEBAR_WIDTH = "19.2rem"` — **keep as-is** (48px activity bar + 259px panel = 307px total)
- `SIDEBAR_WIDTH_MOBILE = "21.6rem"` — **keep as-is**
- `SIDEBAR_WIDTH_ICON = "3rem"` — **keep as-is** (matches activity bar width)

No constant changes needed! The existing widths work perfectly for the new layout.

---

## 10. Summary of Changes by File

| File | Change Type | Description |
|------|------------|-------------|
| `frontend/src/components/sidebar/ActivityBar.tsx` | **NEW** | Activity bar with logo, nav icons, settings |
| `frontend/src/components/sidebar/ActivityBarItem.tsx` | **NEW** | Individual icon button with tooltip + active indicator |
| `frontend/src/components/sidebar/SidePanel.tsx` | **NEW** | Panel container that renders active section content |
| `frontend/src/components/sidebar/panels/ThreadsPanel.tsx` | **NEW** | Extracted threads list with virtual scroll |
| `frontend/src/components/sidebar/panels/ProjectsPanel.tsx` | **NEW** | Extracted projects list with create button |
| `frontend/src/components/sidebar/panels/SchedulesPanel.tsx` | **NEW** | Extracted schedules with execution list |
| `frontend/src/components/drawers/app-sidebar.tsx` | **MAJOR EDIT** | Replace monolithic sidebar with ActivityBar + SidePanel |
| `frontend/src/components/ui/sidebar.tsx` | **MINOR EDIT** | Pass `collapsible="icon"` as default or via prop |
| `frontend/src/lib/config/onboardingSteps.ts` | **MINOR EDIT** | Update data-tour selectors |
| `frontend/src/styles/globals.css` | **NO CHANGE** | Existing CSS variables sufficient |
| `frontend/src/layouts/chat-layout-v2.tsx` | **NO CHANGE** | Layout wrapper unchanged |
| Test files | **MINOR EDIT** | Update sidebar mocks if needed |

Total: 6 new files, 3 modified files, 0 deleted files.

