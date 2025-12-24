# File Management Feature Proposal

## Summary
Enable users to add, edit, and remove files from the agent environment through the `FileEditorPanel`, accessible from both `ChatPanel` and `ThreadPage`.

---

## Research Findings

### Backend Status
The backend now supports files in the `/llm/stream` endpoint:
- Files format: `{ "/path/to/file.ext": { content: string[], created_at, modified_at } }`
- Files are passed via `input.files` in the request payload
- Example at `backend/src/constants/examples/__init__.py:585-600`

### Frontend Current State

#### 1. useChat.ts (File CRUD - Already Implemented)
- `addFile(path, content)` - Creates new file under `__user_files__` key
- `updateFileContent(path, content)` - Updates existing file content
- `removeFile(path)` - Deletes file from filesMap
- `renameFile(oldPath, newPath)` - Renames file
- `getFilesForSubmission()` - Flattens filesMap for backend submission
- Files ARE being sent to backend in `handleSSE` (lines 146-154)

#### 2. FileEditorPanel.tsx (UI - Already Implemented)
- VSCode-like tab interface
- Monaco editor with syntax highlighting
- New file dialog with path validation
- Delete/Rename dialogs
- Context menu (right-click)
- Inline rename (double-click)
- Copy/Download individual + ZIP all

#### 3. The Gap - Missing User Entry Point
- **No UI trigger to switch to editor mode** from chat view
- **No way to add files before starting conversation**
- `viewMode` toggle exists in state but not exposed in UI

---

## Proposed Solution

### Approach: Simple Toggle + FAB

1. **Add "Files" toggle button in ChatNav/ChatInput**
   - Shows file count badge when files exist
   - Toggles between `chat` and `editor` viewMode

2. **Add floating "+" button in chat mode**
   - Quick access to create new file
   - Auto-switches to editor mode when file created

3. **Ensure FileViewer shows "Edit" action**
   - Click on FileViewer in chat messages can open editor mode

### Files to Modify
| File | Change |
|------|--------|
| `ChatInput.tsx` | Add file toggle button |
| `ChatNav.tsx` | Add file indicator/toggle |
| `FileViewer.tsx` | Add "Edit in Editor" action |
| `ChatPanel.tsx` | Minor UX adjustments |
| `ThreadPage.tsx` | Mirror ChatPanel changes |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      ChatPanel/ThreadPage                    │
├─────────────────────────────────────────────────────────────┤
│  viewMode === "chat"         │  viewMode === "editor"       │
│  ┌─────────────────────┐     │  ┌────────────┬────────────┐ │
│  │     ChatNav         │     │  │ FileEditor │  Chat      │ │
│  │  [Files Toggle] ────┼─────┼──│ (Monaco)   │  Messages  │ │
│  ├─────────────────────┤     │  │            │            │ │
│  │   ChatMessages      │     │  │  Add/Edit  │  Input     │ │
│  │   └─ FileViewer ────┼─────┼──│  Delete    │            │ │
│  │      [Edit btn]     │     │  │  Rename    │            │ │
│  ├─────────────────────┤     │  └────────────┴────────────┘ │
│  │   ChatInput         │     │                              │
│  │   [+ Files btn]     │     │                              │
│  └─────────────────────┘     │                              │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   filesMap    │  (useChat state)
            │ key: msgId    │
            │ val: files{}  │
            └───────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Backend API   │
            │ input.files   │
            └───────────────┘
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Complexity creep | Keep UI minimal - single toggle |
| Mobile UX | Editor mode already hidden on mobile (`hidden md:block`) |
| Data loss | Dirty file indicator already exists, add unsaved warning |

---

## Decision Points
1. Toggle location: ChatNav header vs ChatInput area?
2. Should new file auto-open editor mode?
3. Show empty editor state with "Create File" CTA?
