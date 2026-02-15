# Plan: Address PR Feedback on Memory Files (Issue #776)

## Context

The initial memory-files-to-filesystem feature has been implemented and all tests pass (433 backend, 25 frontend). The reviewer flagged two issues:

1. **Bug**: After login redirect to `/chat`, memory files don't load until a manual page refresh
2. **Feature**: Memory editing should be a full-page experience with markdown preview/raw toggle (like GitHub), modeled after the `SkillEditPage` from PR #774

---

## Fix 1: Memory files don't load after login redirect

### Root Cause

`ChatProvider` is mounted at the **app root** in `main.tsx` (wraps ALL routes including `/login`). The memory-loading `useEffect` at `ChatContext.tsx:170-184` has an empty `[]` dependency, so it fires once at app startup — before the user is authenticated. After login, `navigate("/chat")` is client-side; ChatProvider does **not** remount, so the effect never re-fires. Note: `ChatProvider` is *outside* the `<Router>` (Router lives inside `AppRoutes`), so `useLocation()` is not available here.

### Fix

Follow the existing `useModelsEffect` pattern (`frontend/src/hooks/useModel.tsx:12-19`): expose a `useMemoryFilesEffect()` from ChatContext and call it from `ChatV2Page` (which is inside `PrivateRoute` — only renders when authenticated).

### Changes

**File: `frontend/src/context/ChatContext.tsx`**

1. Replace the mount-time `useEffect` (lines 170-184) with a `useMemoryFilesEffect` function:

```typescript
const useMemoryFilesEffect = () => {
    useEffect(() => {
        const loadMemoryFiles = async () => {
            try {
                const memoryFiles = await MemoryService.getFiles();
                if (memoryFiles && Object.keys(memoryFiles).length > 0) {
                    const filesMap = new Map(Object.entries(memoryFiles));
                    importFiles(filesMap);
                }
            } catch (error) {
                console.error("Failed to load memory files:", error);
            }
        };
        loadMemoryFiles();
    }, []);
};
```

2. Add `useMemoryFilesEffect` to the Provider value spread.

**File: `frontend/src/pages/chat/chat-v2.tsx`**

3. Destructure `useMemoryFilesEffect` from `useChatContext()` and call it:

```typescript
const { ..., useMemoryFilesEffect } = useChatContext();
useMemoryFilesEffect();
```

---

## Fix 2: Full-page memory editing with markdown preview (SkillEditPage pattern)

### Reference Pattern

PR #774 introduced `SkillEditPage` (`frontend/src/pages/skills/edit.tsx`) which uses:
- `ChatLayout` + `ChatNav` wrapper
- Header bar: back button, title, enable/disable `Switch`, Save button, Delete button
- `Tabs` component: "Editor" tab (full-height `MonacoEditor` with `language="markdown"`) + "Settings" tab (form fields)
- Route: `/skills/:skillName/edit` inside `PrivateRoute`

### Design for Memory

Create `MemoryEditPage` and `MemoryCreatePage` following the same pattern, with these adaptations:
- **Tabs**: "Preview" (rendered `MarkdownCard`) + "Editor" (full-height `MonacoEditor`)
- Preview tab is default when editing existing memories; Editor tab is default when creating
- Memory has fewer settings than Skill, so no separate Settings tab needed — just Preview + Editor
- Route: `/memories/:memoryId/edit` and `/memories/create`

### Reusable Components (already exist)

| Component | Path | Usage |
|-----------|------|-------|
| `MonacoEditor` | `frontend/src/components/inputs/MonacoEditor.tsx` | Raw markdown editor (default export) |
| `MarkdownCard` | `frontend/src/components/cards/MarkdownCard.tsx` | Rendered markdown preview (default export) |
| `ChatLayout` | `frontend/src/layouts/chat-layout-v2.tsx` | Page layout wrapper |
| `ChatNav` | `frontend/src/components/nav/ChatNav.tsx` | Top navigation bar |
| `Switch` | `frontend/src/components/ui/switch.tsx` | Enable/disable toggle |
| `Tabs` | `frontend/src/components/ui/tabs.tsx` | Tab navigation |
| `ScrollArea` | `frontend/src/components/ui/scroll-area.tsx` | Scrollable content |
| `AlertDialog` | `frontend/src/components/ui/alert-dialog.tsx` | Delete confirmation |

### New Files

**File: `frontend/src/pages/memories/edit.tsx`** — `MemoryEditPage`

Structure (following SkillEditPage pattern):

```
ChatLayout
  ├── ChatNav
  ├── Header: ← Back | "AGENTS.md" title | Enabled/Disabled Switch | Save | Delete
  └── Tabs
       ├── "Preview" tab → ScrollArea > MarkdownCard(content)
       └── "Editor" tab → MonacoEditor(language="markdown", height="100%")
```

- Load memory by ID from URL params via `MemoryService.get(memoryId)`
- `activeTab` state: default to `"preview"` for existing memories
- Save calls `MemoryService.update(memoryId, { content })`
- Toggle calls `MemoryService.toggle(memoryId)` and updates local state
- Delete calls `MemoryService.delete(memoryId)` then navigates to `/settings`

**File: `frontend/src/pages/memories/create.tsx`** — `MemoryCreatePage`

Structure:

```
ChatLayout
  ├── ChatNav
  ├── Header: ← Back | "Create Memory" title | Save
  └── Content
       ├── File Name input (e.g. "AGENTS.md")
       └── Tabs
            ├── "Preview" tab → ScrollArea > MarkdownCard(content)
            └── "Editor" tab → MonacoEditor(language="markdown", height="100%")
```

- `activeTab` default to `"editor"` (nothing to preview yet)
- Save calls `MemoryService.create({ path, content })` then navigates to `/settings`

### Modified Files

**File: `frontend/src/routes/AppRoutes.tsx`**

Add routes (before the `*` catch-all):

```typescript
import MemoryEditPage from "@/pages/memories/edit";
import MemoryCreatePage from "@/pages/memories/create";

// Inside Routes:
<Route path="/memories/create" element={<PrivateRoute><MemoryCreatePage /></PrivateRoute>} />
<Route path="/memories/:memoryId/edit" element={<PrivateRoute><MemoryEditPage /></PrivateRoute>} />
```

**File: `frontend/src/components/settings/MemorySettings.tsx`**

- Import `useNavigate` from react-router-dom
- "Add Memory" button navigates to `/memories/create` instead of opening dialog
- "Edit" pencil button navigates to `/memories/${encodeURIComponent(memory.id)}/edit`
- Remove `editDialogOpen`, `editingMemory` state and `MemoryEditDialog` import/usage
- Keep delete functionality inline (AlertDialog is fine for delete confirmation)

**File: `frontend/src/components/settings/MemoryEditDialog.tsx`**

- **Delete this file** — replaced by full-page `MemoryEditPage` and `MemoryCreatePage`

---

## Files Summary

| File | Action |
|------|--------|
| `frontend/src/context/ChatContext.tsx` | Replace mount-time useEffect with `useMemoryFilesEffect()` exposed on context |
| `frontend/src/pages/chat/chat-v2.tsx` | Call `useMemoryFilesEffect()` |
| `frontend/src/pages/memories/edit.tsx` | **NEW** — Full-page memory editor (SkillEditPage pattern) |
| `frontend/src/pages/memories/create.tsx` | **NEW** — Full-page memory creator |
| `frontend/src/routes/AppRoutes.tsx` | Add `/memories/create` and `/memories/:memoryId/edit` routes |
| `frontend/src/components/settings/MemorySettings.tsx` | Navigate to edit/create pages instead of dialog |
| `frontend/src/components/settings/MemoryEditDialog.tsx` | **DELETE** — replaced by page components |
| `frontend/src/components/settings/MemorySettings.test.tsx` | Update: remove dialog mock, update "Add Memory" and "Edit" click assertions to check navigation |

---

## Verification

### Bug fix
1. Start app, navigate to `/login`, log in
2. After redirect to `/chat`, memory files should appear in file editor panel immediately (no refresh)
3. Full page refresh on `/chat` should also load memory files

### Memory editing
1. Settings > Memories > click "Add Memory" > navigates to `/memories/create`
2. Enter file name (e.g. `NOTES.md`), type markdown content in Editor tab
3. Switch to Preview tab to see rendered markdown
4. Save > redirected back to settings, new memory appears
5. Click edit pencil on a memory > navigates to `/memories/AGENTS.md/edit`
6. Preview tab shows rendered markdown by default
7. Switch to Editor tab, make changes, save
8. Toggle enable/disable switch in header
9. Delete with confirmation

### Automated Tests
```bash
cd frontend && npm run test
```

### Full QA with agent-browser

Use the `agent-browser` skill to perform end-to-end user story validation:

**Story 1: Login redirect loads memory files**
1. Navigate to `/login`
2. Log in with valid credentials
3. After redirect to `/chat`, take screenshot
4. Verify memory files appear in the file editor panel tabs (no manual refresh)

**Story 2: Create a new memory file**
1. Navigate to `/settings`
2. Scroll to Memories section
3. Click "Add Memory" button
4. Verify navigation to `/memories/create`
5. Enter file name `TEST.md` and markdown content in Editor tab
6. Switch to Preview tab — take screenshot to verify rendered markdown
7. Switch back to Editor tab, click Save
8. Verify redirect to `/settings` and new memory appears in list

**Story 3: Edit an existing memory file**
1. Navigate to `/settings`, scroll to Memories section
2. Click edit (pencil icon) on a memory
3. Verify navigation to `/memories/<id>/edit`
4. Verify Preview tab is active by default — take screenshot showing rendered markdown
5. Switch to Editor tab — verify raw markdown content in MonacoEditor
6. Make a change, switch to Preview tab to verify
7. Save and verify redirect back to settings with updated content

**Story 4: Toggle and delete memory**
1. Navigate to `/settings`, scroll to Memories section
2. Toggle a memory off via the Switch — verify it dims (opacity-50)
3. Navigate to `/chat` — verify the disabled memory does NOT appear in file editor
4. Go back to settings, toggle it back on
5. Click delete on a memory, confirm in dialog — verify it's removed from list

**Story 5: Memory edit page controls**
1. Navigate to edit page for a memory
2. Verify header shows: back button, file name title, Enabled/Disabled toggle, Save button, Delete button
3. Toggle enabled/disabled via the Switch in header — take screenshot
4. Click Delete, confirm — verify redirect to settings and memory is gone
