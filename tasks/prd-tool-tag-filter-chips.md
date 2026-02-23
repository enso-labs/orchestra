# PRD: Tool Tag Filter Chips (#803-B)

## Introduction

The Platform tab in the Manage Tools modal shows a flat grid of 20+ tools with no grouping. Each tool already has tags (`search`, `finance`, `python`, `threads`, `epic`, `ms_teams`, `test`) assigned by the backend, but they're only displayed as tiny non-interactive badges on each card. This PRD adds clickable tag filter chips above the grid for quick category filtering and batch enable/disable to manage tools by category.

## Goals

- Add tag filter chips above the Platform tools grid for one-click category filtering
- Enable batch enable/disable of all tools in a filtered category
- Reduce time to configure tools from "scroll + click each" to "filter + batch toggle"
- Derive tags dynamically from tool data (no hardcoded tag list)
- Work within the existing persistence flow (debounced `patchDefaults({ tools })`)

## User Stories

### US-005: Tag filter chips in Platform tools panel
**Description:** As a user viewing the Platform tab in the Manage Tools modal, I want clickable tag filter chips above the tool grid so that I can quickly narrow down the 20+ tools to a specific category instead of scrolling through the entire flat grid.

**Acceptance Criteria:**
- [ ] An "All" chip is shown by default and is active on initial render
- [ ] One chip is rendered for each unique tag derived from the `tags[]` field on the loaded platform tools
- [ ] Each chip displays the tag name and count of tools with that tag: e.g., "search (3)"
- [ ] Clicking a tag chip filters the grid to show only tools whose `tags[]` includes that tag
- [ ] Clicking "All" clears any active tag filter and shows all tools
- [ ] Only one tag chip can be active at a time (radio-style, not multi-select)
- [ ] Tag filtering works in combination with the existing text search -- both narrow the results simultaneously
- [ ] Tags with zero matching tools (after text search filtering) are visually dimmed but still clickable
- [ ] The chip bar is horizontally scrollable on narrow viewports (mobile)
- [ ] Typecheck passes (`npx tsc --noEmit` from `frontend/`)
- [ ] Lint passes (`npm run lint` from `frontend/`)
- [ ] Verify in browser using agent-browser skill

### US-006: Batch enable/disable tools by tag category
**Description:** As a user who has filtered by a tag, I want "Enable All" and "Disable All" buttons visible when a tag filter is active so that I can quickly toggle all tools in a category without clicking each card individually.

**Acceptance Criteria:**
- [ ] When any tag filter (not "All") is active, "Enable All" and "Disable All" buttons appear in the toolbar area below the tag chips
- [ ] "Enable All" selects every tool currently visible in the filtered grid
- [ ] "Disable All" deselects every tool currently visible in the filtered grid
- [ ] The buttons are hidden when the "All" chip is active (prevents accidentally toggling every tool)
- [ ] Batch actions apply instantly with no confirmation dialog
- [ ] A toast confirms the action: "Enabled 3 search tools" / "Disabled 3 search tools"
- [ ] Persistence happens via the existing debounced `patchDefaults({ tools })` flow -- no extra API calls
- [ ] The status bar at the bottom updates immediately to reflect the new selected count
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- FR-1: Derive unique tags and their counts from the `tools` array using `useMemo` in `PlatformToolsPanel.tsx`
- FR-2: Add `activeTag` state (`string | null`, default `null` meaning "All") to `PlatformToolsPanel`
- FR-3: Update `filteredTools` memo to apply tag filter before text search filter (both narrow results)
- FR-4: Render a horizontally-scrollable chip bar between the search input and the tool grid with "All" + one chip per unique tag
- FR-5: Active chip uses `bg-primary text-primary-foreground`; inactive uses `bg-secondary text-secondary-foreground`
- FR-6: Render "Enable All" and "Disable All" buttons below chips when `activeTag !== null`
- FR-7: "Enable All" calls `onSelectMultiple(filteredTools.map(t => t.name))`
- FR-8: "Disable All" calls `onDeselectMultiple(filteredTools.map(t => t.name))`
- FR-9: Add `deselectMultiple` method to `useToolSelection` hook as counterpart to existing `selectMultiple`
- FR-10: Add `onSelectMultiple` and `onDeselectMultiple` props to `PlatformToolsPanelProps` interface
- FR-11: Pass `selectMultiple` and `deselectMultiple` from `useToolSelection` through `ToolSelectionModal/index.tsx` to `PlatformToolsPanel`
- FR-12: Tag chips scoped to Platform tab only (not API, MCP, or A2A tabs)

## Non-Goals

- No tag filtering on Custom Tools (API), MCP, or A2A tabs
- No persistent tag filter state (resets to "All" when modal reopens)
- No backend changes -- tags are already attached by `attach_tool_details()` in `backend/src/utils/tools.py`
- No changes to ToolCard component (tag badges remain as-is)
- No multi-tag selection (only one tag active at a time)
- No custom/user-defined tags
- No confirmation dialog for batch actions

## Design Considerations

### Wireframe

```
+-------------------------------------------------------------+
|  Tools & Integrations                                       |
|  Connect tools to extend your agent's capabilities          |
|                                                             |
|  [Search tools...                                       ]   |
|                                                             |
|  [All (20)] [search (3)] [finance (2)] [python (1)] [...]   |
|   ^active    ^inactive                                      |
|                                                             |
|  [When a tag is active:]                                    |
|  [Enable All]  [Disable All]                                |
|                                                             |
|  +------------+ +------------+ +------------+               |
|  | web_search | | web_scrape | | tavily     |               |
|  | Search the | | Scrape web | | Search via |               |
|  | web        | | pages      | | Tavily     |               |
|  | [search]   | | [search]   | | [search]   |               |
|  +------------+ +------------+ +------------+               |
|                                                             |
|  Selected: 5 tools                                          |
+-------------------------------------------------------------+
```

### Component Hierarchy

```
ToolSelectionModal (index.tsx)
  -> passes selectMultiple, deselectMultiple
  PlatformToolsPanel
    -> Header (title, description)
    -> Search input (existing)
    -> Tag chip bar (NEW)
    -> Batch toggle buttons (NEW, conditional)
    -> ToolGrid (existing)
      -> ToolCard (existing, no changes)
```

### Styling

- Chip bar: `flex gap-2 overflow-x-auto` for horizontal scroll
- Active chip: `bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium`
- Inactive chip: `bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium hover:bg-secondary/80`
- Batch buttons: `Button variant="outline" size="sm"` (existing shadcn component)

## Technical Considerations

- **Tag source:** Tags come from `attach_tool_details()` in `backend/src/utils/tools.py`. Known tags: `search`, `python`, `ms_teams`, `test`, `finance`, `threads`, `epic`. Tags are derived dynamically so new backend tags appear automatically.
- **Fallback tools:** Unauthenticated users see `FALLBACK_TOOLS` with tags `search` and `utility`. Tag chips still work but batch toggle has no persistence (no auth token).
- **`deselectMultiple` pattern:** Mirrors `selectMultiple` -- filters out a set of tool names from current selection, then persists.
- **No new API calls:** All state changes flow through the existing `persistTools()` debounced function.
- **Combined filtering:** Tag filter applied first, then text search narrows within the tag-filtered set.

### Key Files

| File | Change |
|------|--------|
| `frontend/src/components/modals/ToolSelectionModal/PlatformToolsPanel.tsx` | Add tag chip bar, batch toggle buttons, `activeTag` state, combined filtering logic |
| `frontend/src/components/modals/ToolSelectionModal/hooks/useToolSelection.ts` | Add `deselectMultiple` method, return it from hook |
| `frontend/src/components/modals/ToolSelectionModal/index.tsx` | Pass `selectMultiple` and `deselectMultiple` props to PlatformToolsPanel |
| `frontend/src/components/modals/ToolSelectionModal/__tests__/PlatformToolsPanel.test.tsx` | **NEW** test file |

### Testing

| Test | Description |
|------|-------------|
| Renders "All" chip by default | "All" chip is active on initial render; all tools shown |
| Renders tag chips with counts | Each unique tag renders a chip with `tag (count)` label |
| Clicking tag filters grid | Clicking "search" chip shows only tools with the "search" tag |
| Clicking "All" clears filter | After filtering by tag, clicking "All" shows all tools again |
| Tag + search work together | Filtering by "search" tag AND typing "web" narrows to matching tools |
| Batch enable visible when filtered | "Enable All" button appears when a tag filter is active |
| Batch disable visible when filtered | "Disable All" button appears when a tag filter is active |
| Batch buttons hidden on "All" | Buttons hidden when no tag filter is active |
| Enable All selects filtered tools | Clicking "Enable All" calls `onSelectMultiple` with all visible tool names |
| Disable All deselects filtered tools | Clicking "Disable All" calls `onDeselectMultiple` with all visible tool names |
| `deselectMultiple` removes tools | Hook removes specified tools from selection and persists |
| `deselectMultiple` ignores missing | Removing tool names not in selection is a no-op |
| Tools with no tags only show on "All" | Tools with empty `tags[]` are excluded from tag-filtered views |
| Tools with multiple tags appear in each | A tool tagged `["search", "utility"]` appears under both chip filters |

## Success Metrics

- Users can filter to a tool category in 1 click (down from scrolling through 20+ cards)
- Users can enable/disable an entire category in 2 clicks (filter + batch toggle)
- No increase in API calls (existing debounce handles batch just like individual toggles)
- Tag chips render correctly for all 7 known tag categories

## Open Questions

- None -- scope is locked to Platform tab only, no confirmation dialog, instant batch actions with toast feedback.
