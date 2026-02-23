# Spec: Manage Tools Modal Improvements (#803)

## Overview

Two improvements to the "Manage Tools" modal:

1. **Subagent persistence** (US-001 through US-004): Subagent selections are stored only in React state and lost on page refresh. Tools, MCP servers, and A2A agents all persist correctly via `PATCH /settings/default`. Add the same persistence for subagents.

2. **Tool category UX** (US-005, US-006): The Platform tab shows a flat grid of 20+ tools with no grouping. Tools have tags (`search`, `finance`, `python`, `threads`, `epic`, `ms_teams`, `test`) but they're only shown as tiny badges on each card. Users need tag filter chips for quick filtering and batch enable/disable to manage tools by category.

---

## User Stories

### US-001: Persist subagent selections across sessions

**As a** user viewing the subagents tab of the Manage Tools modal,
**I want** my subagent selections to be saved automatically,
**So that** I don't have to re-select my preferred subagents every time I refresh the page or start a new session.

#### Acceptance Criteria

- [ ] When I toggle a subagent on/off, the selection is persisted to the backend via `PATCH /settings/default` within 500ms (debounced)
- [ ] When I reload the page, my previously selected subagents are restored
- [ ] The persistence uses agent IDs (strings), not full agent objects
- [ ] A toast error appears if the save fails: "Failed to save subagent defaults"
- [ ] Selecting/deselecting subagents updates both local state AND the backend

### US-002: Load saved subagent defaults on app start

**As a** returning user,
**I want** my saved subagent selections to be loaded when the app starts,
**So that** my chat sessions include my preferred subagents without manual re-selection.

#### Acceptance Criteria

- [ ] On app mount, `GET /settings` returns `defaults.subagents` as a list of agent IDs
- [ ] The returned IDs are resolved against the loaded agents list to populate `agent.subagents` with full `Agent` objects
- [ ] If a saved agent ID no longer exists (agent was deleted), it is silently filtered out -- no error
- [ ] If the agents list hasn't loaded yet when settings arrive, resolution is deferred until agents are available (race condition handled)
- [ ] The subagent badges/indicators in the UI reflect the loaded defaults

### US-003: Subagents field in settings API

**As a** developer,
**I want** the `/settings/default` API to support a `subagents` field,
**So that** subagent defaults can be stored and retrieved alongside tools, MCP, and A2A configs.

#### Acceptance Criteria

- [ ] `PATCH /settings/default` accepts `{ "subagents": ["agent-id-1", "agent-id-2"] }`
- [ ] `PATCH /settings/default` accepts `{ "subagents": null }` to clear the selection
- [ ] `GET /settings` returns `{ "defaults": { "subagents": ["agent-id-1", ...], ... } }`
- [ ] Fresh users get `defaults.subagents: null` (not an empty list)
- [ ] Patching `subagents` does NOT affect other defaults (model, tools, mcp, a2a)
- [ ] The `subagents` field stores a flat list of string IDs (not nested agent objects)

### US-004: Unauthenticated users are unaffected

**As an** unauthenticated user,
**I want** the subagents tab to remain hidden,
**So that** no persistence is attempted and no errors occur.

#### Acceptance Criteria

- [ ] The "subagents" tab is not visible for unauthenticated users (existing behavior, no change)
- [ ] No `patchDefaults` calls are made for subagents when unauthenticated
- [ ] No errors appear in the console related to subagent persistence for unauthenticated users

### US-005: Tag filter chips in Platform tools panel

**As a** user viewing the Platform tab in the Manage Tools modal,
**I want** clickable tag filter chips above the tool grid,
**So that** I can quickly narrow down the 20+ tools to a specific category instead of scrolling through the entire flat grid.

#### Acceptance Criteria

- [ ] An "All" chip is shown by default and is active on initial render
- [ ] One chip is rendered for each unique tag derived from the `tags[]` field on the loaded platform tools
- [ ] Each chip displays the tag name and count of tools with that tag: e.g., "search (3)"
- [ ] Clicking a tag chip filters the grid to show only tools whose `tags[]` includes that tag
- [ ] Clicking "All" clears any active tag filter and shows all tools
- [ ] Only one tag chip can be active at a time (radio-style, not multi-select)
- [ ] Tag filtering works in combination with the existing text search -- both narrow the results simultaneously
- [ ] Tags with zero matching tools (after text search filtering) are visually dimmed but still clickable
- [ ] The chip bar is horizontally scrollable on narrow viewports (mobile)

### US-006: Batch enable/disable tools by tag category

**As a** user who has filtered by a tag,
**I want** "Enable All" and "Disable All" buttons visible when a tag filter is active,
**So that** I can quickly toggle all tools in a category without clicking each card individually.

#### Acceptance Criteria

- [ ] When any tag filter (not "All") is active, "Enable All" and "Disable All" buttons appear in the toolbar area next to the tag chips
- [ ] "Enable All" selects every tool currently visible in the filtered grid
- [ ] "Disable All" deselects every tool currently visible in the filtered grid
- [ ] The buttons are hidden when the "All" chip is active (prevents accidentally toggling every tool)
- [ ] Batch actions use the existing `useToolSelection.selectMultiple()` for enabling
- [ ] Batch disable uses a new `deselectMultiple(tools: string[])` method on `useToolSelection`
- [ ] Persistence happens via the existing debounced `patchDefaults({ tools })` flow -- no extra API calls
- [ ] The status bar at the bottom updates immediately to reflect the new selected count
- [ ] A toast confirms the action: "Enabled 3 search tools" / "Disabled 3 search tools"

### US-007: Fix empty model string crashes subagent initialization

**As a** user who has persisted subagent selections without choosing an explicit model,
**I want** the backend to gracefully handle empty model strings,
**So that** submitting a query does not crash with `TypeError: _init_chat_model_helper() missing 1 required positional argument: 'model'`.

#### Bug Description

When a subagent has `model: ""` (empty string — the default from `useAgent.ts` initial state), the backend's `init_subagents()` guard `if getattr(subagent, "model", None) is not None` passes the empty string through. The deepagents library then calls `init_chat_model("")`, which fails.

**Three-part chain:**
1. Frontend sends `model: ""` for agents without an explicit model (default `INIT_AGENT_STATE`)
2. Pydantic `Assistant.model: Optional[str] = None` accepts `""` without normalization
3. `init_subagents()` only guards against `None`, not empty strings — so `""` gets injected into the subagent dict instead of falling back to `default_model`

#### Acceptance Criteria

- [ ] `init_subagents` guard in `backend/src/agents/__init__.py` changed from `is not None` to truthy check (`if getattr(subagent, "model", None):`)
- [ ] `Assistant` model field in `backend/src/schemas/entities/llm.py` has a `field_validator` that coerces empty/whitespace strings to `None`
- [ ] Submitting a query with persisted subagents (no explicit model) succeeds without error
- [ ] Subagents without a model correctly inherit the parent agent's model
- [ ] Backend tests pass
- [ ] Format passes (`make format`)

---

## Current Behavior (Reproduction Steps)

1. Navigate to https://chat.ruska.ai (or localhost)
2. Log in with a valid account
3. Click the `+` button in the chat input area
4. Click "Configure Tools" to open the Manage Tools modal
5. Click the "Subagents" tab in the sidebar
6. Select 2-3 subagents by clicking on them (they highlight with a blue border)
7. Close the modal
8. **Refresh the page (F5)**
9. **ACTUAL**: Re-open the modal > Subagents tab -- all selections are gone
10. **EXPECTED**: Previously selected subagents should still be selected

### Comparison with Tools (working behavior)

1. Open the same modal > "Platform" tab
2. Toggle some tools on/off
3. Refresh the page
4. Re-open the modal > "Platform" tab
5. **Tools persist correctly** -- they are saved via `useToolSelection` hook + `patchDefaults({ tools })`

### Platform tab UX gap (tag filtering)

1. Open Manage Tools modal > "Platform" tab
2. Observe 20+ tools in a flat grid with no grouping
3. Each tool card shows tiny tag badges (e.g., "search", "finance") but they are not interactive
4. **ACTUAL**: No way to filter by category; user must scroll through the entire grid or use text search
5. **EXPECTED**: Clickable tag chips above the grid let users filter by category and batch enable/disable

---

## Technical Implementation Guide

### Design Decision: Store Agent IDs

Store subagent selections as `list[str]` of agent IDs (not full agent objects). This mirrors how `default_tools` stores tool name strings and prevents stale data when agent details change.

### Backend Changes

#### 1. `backend/src/schemas/entities/settings.py`

Add `default_subagents` to three models:

**`UserSettings` entity** (after `default_tools` on line 31):
```python
default_subagents: Optional[list[str]] = Field(default=None, description="User's default subagent selection (agent IDs)")
```

**`DefaultsResponse`** (after `tools` on line 41):
```python
subagents: Optional[list[str]] = None
```

**`PatchDefaultsRequest`** (after `tools` on line 58):
```python
subagents: Optional[list[str]] = Field(default=None, description="Default subagent selection (agent IDs), or null to clear")
```

#### 2. `backend/src/repos/user_settings_repo.py`

Add one entry to `_DEFAULTS_FIELD_MAP` (line 83-89):
```python
"subagents": "default_subagents",
```

No validation logic needed (unlike sandbox which validates against an enum).

#### 3. `backend/src/routes/v0/settings.py`

Add to `_build_response` (line 24-34):
```python
subagents=settings.default_subagents,
```

The `patch_defaults` route handler needs no changes -- it uses `model_dump(exclude_unset=True)` which automatically passes through any `subagents` key.

### Frontend Changes

#### 4. `frontend/src/lib/services/userSettingsService.ts`

Add `subagents: string[] | null` to both `DefaultsResponse` interface and `patchDefaults` parameter type.

#### 5. New: `frontend/src/components/modals/ToolSelectionModal/hooks/useSubagentSelection.ts`

Create a new hook mirroring `useToolSelection.ts`:
- Manages a `Set<string>` of selected agent IDs
- Debounced `persistSubagents()` calls `patchDefaults({ subagents: [...] })` with 500ms delay
- `toggleSubagent(agent: Agent)` adds/removes IDs and updates `agent.subagents` in AgentContext
- `resolveAgents(ids)` converts IDs to full `Agent` objects using the agents list from context
- `getAuthToken()` guard skips API calls for unauthenticated users
- `flushPersist()` clears pending debounce timer

#### 6. `frontend/src/components/menus/BaseToolMenu.tsx`

Modify the settings loading `useEffect` to also extract `defaults.subagents`:
- Store the loaded subagent IDs in state (`pendingSubagentIds`)
- Add a second `useEffect` watching `[agents, pendingSubagentIds]` that resolves IDs to Agent objects once the agents list is available
- Set resolved agents onto `agent.subagents` via `setAgent`

#### 7. `frontend/src/components/modals/ToolSelectionModal/index.tsx`

- Import and instantiate `useSubagentSelection` hook
- Derive `initialSubagentIds` from `agent.subagents` (map to IDs)
- Wire `SubagentsPanel` to use the hook's `toggleSubagent` and `isSelected`
- Call `flushSubagentPersist()` in `handleClose`
- Remove `toggleSubagent` and `isAgentSelected` from the `useAgentContext()` destructure (now provided by hook)

#### 8. `frontend/src/components/modals/ToolSelectionModal/SubagentsPanel.tsx`

No changes needed -- the component's props interface already matches the hook's function signatures.

### Tool Category UX Changes (US-005, US-006)

No backend changes required. Tags are already attached by `attach_tool_details()` in `backend/src/utils/tools.py` (lines 81-104). The known tags are: `search`, `python`, `ms_teams`, `test`, `finance`, `threads`, `epic`.

#### 9. `frontend/src/components/modals/ToolSelectionModal/PlatformToolsPanel.tsx`

Add tag filter chips and batch toggle buttons. Current file has a search input and tool grid. Changes:

**Derive unique tags from tools:**
```tsx
const allTags = useMemo(() => {
  const tagCounts = new Map<string, number>();
  tools.forEach((tool) =>
    (tool.tags ?? []).forEach((tag) =>
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    )
  );
  return tagCounts; // Map<string, number> e.g. { "search" => 3, "finance" => 2 }
}, [tools]);
```

**Add `activeTag` state:**
```tsx
const [activeTag, setActiveTag] = useState<string | null>(null); // null = "All"
```

**Update `filteredTools` to also filter by tag:**
```tsx
const filteredTools = useMemo(() => {
  let result = tools;
  if (activeTag) {
    result = result.filter((t) => (t.tags ?? []).includes(activeTag));
  }
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(query))
    );
  }
  return result;
}, [tools, activeTag, searchQuery]);
```

**Render tag chip bar** between the search input and the tool grid:
```tsx
{/* Tag Filter Chips */}
<div className="flex gap-2 overflow-x-auto pb-1 pt-3">
  <button
    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
      ${!activeTag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
    onClick={() => setActiveTag(null)}
  >
    All ({tools.length})
  </button>
  {[...allTags.entries()].map(([tag, count]) => (
    <button
      key={tag}
      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
        ${activeTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
      onClick={() => setActiveTag(tag === activeTag ? null : tag)}
    >
      {tag} ({count})
    </button>
  ))}
</div>
```

**Render batch toggle buttons** when a tag filter is active:
```tsx
{activeTag && (
  <div className="flex gap-2 pt-2">
    <Button variant="outline" size="sm" onClick={handleEnableAll}>
      Enable All
    </Button>
    <Button variant="outline" size="sm" onClick={handleDisableAll}>
      Disable All
    </Button>
  </div>
)}
```

**Add new props** to PlatformToolsPanel:
```tsx
interface PlatformToolsPanelProps {
  tools: Tool[];
  selectedTools: Set<string>;
  onToggleSelection: (toolName: string) => void;
  onSelectMultiple: (toolNames: string[]) => void;     // NEW
  onDeselectMultiple: (toolNames: string[]) => void;    // NEW
}
```

#### 10. `frontend/src/components/modals/ToolSelectionModal/hooks/useToolSelection.ts`

Add `deselectMultiple` method (counterpart to existing `selectMultiple`):
```tsx
const deselectMultiple = (tools: string[]) => {
  const toRemove = new Set(tools);
  const next = new Set([...selectedTools].filter((t) => !toRemove.has(t)));
  const arr = Array.from(next);
  setSelectedTools(next);
  setAgentTools(arr);
  persistTools(arr);
};
```

Return it from the hook alongside `selectMultiple`.

#### 11. `frontend/src/components/modals/ToolSelectionModal/index.tsx`

Pass the new props from useToolSelection to PlatformToolsPanel:
```tsx
<PlatformToolsPanel
  tools={platformTools}
  selectedTools={selectedTools}
  onToggleSelection={toggleTool}
  onSelectMultiple={selectMultiple}        // NEW
  onDeselectMultiple={deselectMultiple}     // NEW
/>
```

### Wireframe: Tag Filter Chips Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Tools & Integrations                                       │
│  Connect tools to extend your agent's capabilities          │
│                                                             │
│  🔍 [Search tools...                                    ]   │
│                                                             │
│  ┌─────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────┐  │
│  │ All │ │search (3)│ │finance (2)│ │python (1)│ │ ...  │  │
│  │(20) │ │          │ │           │ │          │ │      │  │
│  └─────┘ └──────────┘ └───────────┘ └──────────┘ └──────┘  │
│  ▲ active (filled)   ▲ inactive (outline)                   │
│                                                             │
│  [When a tag is active:]                                    │
│  ┌───────────┐ ┌────────────┐                               │
│  │Enable All │ │Disable All │                               │
│  └───────────┘ └────────────┘                               │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ 🔧         │ │ 🔧         │ │ 🔧         │               │
│  │ web_search │ │ web_scrape │ │ tavily     │               │
│  │ Search the │ │ Scrape web │ │ Search via │               │
│  │ web        │ │ pages      │ │ Tavily     │               │
│  │ [search]   │ │ [search]   │ │ [search]   │               │
│  └────────────┘ └────────────┘ └────────────┘               │
│                                                             │
│  Selected: 5 tools                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Test Requirements

### Backend Tests

#### Route tests (`backend/tests/unit/routes/test_settings_routes.py`)

| Test | Description |
|------|-------------|
| `test_patch_default_subagents` | PATCH with `subagents: ["id-1", "id-2"]` returns 200 with the IDs |
| `test_patch_clear_subagents` | PATCH with `subagents: null` clears the field |
| `test_get_settings_empty` | Update existing test: verify `defaults.subagents` is null for fresh users |
| `test_patch_multiple_defaults` | Update existing test: include `subagents` in multi-field PATCH |

#### Repo tests (`backend/tests/unit/repos/test_user_settings_repo.py`)

| Test | Description |
|------|-------------|
| `test_patch_defaults_subagents` | Patching subagents persists the agent IDs list |
| `test_patch_defaults_subagents_clear` | Patching subagents with None clears the field |

### Frontend Tests

#### Hook test (`frontend/src/components/modals/ToolSelectionModal/hooks/__tests__/useSubagentSelection.test.ts`)

| Test | Description |
|------|-------------|
| Initialize with provided IDs | Hook starts with correct selected set |
| Toggle on/off | Adding and removing agents updates state and calls persist |
| Debounced persistence | `patchDefaults` is called after 500ms, not immediately |
| Clear selection | `clearSelection()` empties state and persists empty list |
| Auth guard | No `patchDefaults` call when `getAuthToken()` returns null |
| Filter missing agents | IDs without matching agents are silently dropped during resolution |

#### Tag filter + batch toggle tests (`frontend/src/components/modals/ToolSelectionModal/__tests__/PlatformToolsPanel.test.tsx`)

| Test | Description |
|------|-------------|
| Renders "All" chip by default | "All" chip is active on initial render; all tools shown |
| Renders tag chips with counts | Each unique tag from tools renders a chip with `tag (count)` label |
| Clicking tag filters grid | Clicking "search" chip shows only tools with the "search" tag |
| Clicking "All" clears filter | After filtering by tag, clicking "All" shows all tools again |
| Tag + search work together | Filtering by "search" tag AND typing "web" narrows to matching tools |
| Batch enable visible | "Enable All" button appears when a tag filter is active |
| Batch disable visible | "Disable All" button appears when a tag filter is active |
| Batch buttons hidden on "All" | "Enable All" / "Disable All" hidden when no tag filter active |
| Enable All selects filtered tools | Clicking "Enable All" calls `onSelectMultiple` with all visible tool names |
| Disable All deselects filtered tools | Clicking "Disable All" calls `onDeselectMultiple` with all visible tool names |

#### Hook test updates (`frontend/src/components/modals/ToolSelectionModal/hooks/__tests__/useToolSelection.test.ts`)

| Test | Description |
|------|-------------|
| `deselectMultiple` removes tools | Removes specified tools from selection and persists |
| `deselectMultiple` ignores missing | Removing tool names not in selection is a no-op |

### Manual Validation

#### API Validation (curl)
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' | jq -r '.access_token')

# Set default subagents
curl -X PATCH http://localhost:8000/api/settings/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subagents": ["agent-id-1", "agent-id-2"]}'

# Verify persisted
curl -X GET http://localhost:8000/api/settings \
  -H "Authorization: Bearer $TOKEN"

# Clear subagents
curl -X PATCH http://localhost:8000/api/settings/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subagents": null}'
```

#### Browser Validation: Subagent Persistence (agent-browser)
1. Navigate to app, log in
2. Open Manage Tools modal > Subagents tab
3. Select 2-3 subagents
4. Close modal, refresh page
5. Re-open modal > Subagents tab
6. Verify selections persisted
7. Deselect one, refresh, verify update persisted

#### Browser Validation: Tag Filter Chips (agent-browser)
1. Navigate to app, log in
2. Open Manage Tools modal > Platform tab
3. Verify "All" chip is active and shows total count
4. Verify tag chips appear with correct counts (search, finance, python, etc.)
5. Click "search" chip -- grid filters to show only search tools
6. Verify "Enable All" and "Disable All" buttons appear
7. Click "Enable All" -- all visible search tools become selected
8. Click "Disable All" -- all visible search tools become deselected
9. Type "web" in search while "search" tag is active -- verify combined filtering
10. Click "All" chip -- verify grid returns to full view and batch buttons disappear

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|------------------|
| **Subagent Persistence** | |
| Saved agent ID was deleted | Silently filtered out during resolution; no error |
| Empty subagents list `[]` | Saved as empty list; on load, no subagents selected |
| Null subagents | Treated as "no preference"; falls back to empty |
| Agents list loads before settings | Resolution happens immediately in settings callback |
| Settings load before agents list | IDs stored in state; resolved reactively when agents arrive |
| Rapid toggle (debounce) | Only the final state is persisted after 500ms |
| Modal closed during debounce | `flushPersist()` cancels the pending timer |
| Network error on save | Toast: "Failed to save subagent defaults"; local state still updated |
| Unauthenticated user | Subagents tab hidden; no persistence attempted |
| Subagent with `model: ""` (empty string) | `field_validator` normalizes to `None`; `init_subagents` falls back to `default_model` |
| Subagent with `model: "   "` (whitespace) | Same as empty string — validator strips and coerces to `None` |
| **Tag Filter & Batch Toggle** | |
| Tool has no tags (`tags: []`) | Tool only appears when "All" is active; no chip generated for empty tag |
| Tool has multiple tags | Tool appears in each tag's filtered view; counted once per tag chip |
| All tools share the same tag | Single tag chip with full count; "All" and that tag show same results |
| No tools loaded yet | No chips rendered (empty `allTags` map); "All" chip still shows with count 0 |
| Tag filter + text search yields 0 | Empty state message shown; batch buttons still visible but disabled |
| Batch enable when some already selected | `selectMultiple` merges -- already-selected tools remain selected |
| Batch disable on already-empty selection | No-op; toast still confirms "Disabled 0 tools" or is suppressed |
| Tags change after tools reload | Chips re-derive from new tool data; active tag resets to "All" if removed |
| Unauthenticated user (fallback tools) | Only "search" and "utility" tags shown (from `FALLBACK_TOOLS`); batch toggle works locally (no persistence) |

---

## Files to Modify

### Subagent Persistence (US-001 through US-004)

| File | Change |
|------|--------|
| `backend/src/schemas/entities/settings.py` | Add `default_subagents` to 3 models |
| `backend/src/repos/user_settings_repo.py` | Add field mapping entry |
| `backend/src/routes/v0/settings.py` | Add to response builder |
| `backend/tests/unit/routes/test_settings_routes.py` | Add + update tests |
| `backend/tests/unit/repos/test_user_settings_repo.py` | Add tests |
| `frontend/src/lib/services/userSettingsService.ts` | Add `subagents` to types |
| `frontend/src/components/modals/ToolSelectionModal/hooks/useSubagentSelection.ts` | **NEW** hook |
| `frontend/src/components/modals/ToolSelectionModal/hooks/__tests__/useSubagentSelection.test.ts` | **NEW** test |
| `frontend/src/components/menus/BaseToolMenu.tsx` | Load + resolve defaults |
| `frontend/src/components/modals/ToolSelectionModal/index.tsx` | Wire subagent hook |

### Empty Model Bug Fix (US-007)

| File | Change |
|------|--------|
| `backend/src/agents/__init__.py` | Line 194: change `is not None` guard to truthy check |
| `backend/src/schemas/entities/llm.py` | Line 85: add `field_validator("model")` to normalize `""` / whitespace to `None` |

### Tool Category UX (US-005, US-006)

| File | Change |
|------|--------|
| `frontend/src/components/modals/ToolSelectionModal/PlatformToolsPanel.tsx` | Add tag chip bar, batch toggle buttons, `activeTag` state, combined filtering |
| `frontend/src/components/modals/ToolSelectionModal/hooks/useToolSelection.ts` | Add `deselectMultiple` method |
| `frontend/src/components/modals/ToolSelectionModal/index.tsx` | Pass `selectMultiple` and `deselectMultiple` to PlatformToolsPanel |
| `frontend/src/components/modals/ToolSelectionModal/__tests__/PlatformToolsPanel.test.tsx` | **NEW** test file for tag filtering + batch toggle |
| `backend/src/utils/tools.py` | No changes needed -- tags already attached |
