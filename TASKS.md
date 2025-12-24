# File Management Implementation Tasks

## Priority: High (Core Functionality)

### Task 1: Add File Toggle in ChatInput
**File:** `frontend/src/components/inputs/ChatInput.tsx`
**Description:** Add button to toggle between chat and editor mode
- [ ] Import `FolderCode` or `Files` icon from lucide-react
- [ ] Get `viewMode`, `setViewMode`, `filesMap` from `useChatContext()`
- [ ] Add toggle button next to submit button
- [ ] Show badge with file count when `filesMap.size > 0`
- [ ] Tooltip: "Manage Files" / "Back to Chat"

### Task 2: Add Quick "New File" Action
**File:** `frontend/src/components/inputs/ChatInput.tsx`
**Description:** Allow creating file without switching to editor first
- [ ] Add `showNewFileDialog` state
- [ ] Add "+" button that opens new file dialog inline
- [ ] Use same validation as `FileEditorPanel.tsx` (lines 156-164)
- [ ] On create: call `addFile()`, switch to editor mode, select new file

### Task 3: Add "Edit" Button to FileViewer
**File:** `frontend/src/components/viewers/FileViewer.tsx`
**Description:** Let users jump to editor from chat message files
- [ ] Add `setViewMode` from `useChatContext()`
- [ ] Add "Edit" button in file header (next to copy)
- [ ] On click: `setViewMode("editor")`
- [ ] Consider: pre-select the file in editor

---

## Priority: Medium (UX Polish)

### Task 4: Empty State Enhancement
**File:** `frontend/src/components/panels/FileEditorPanel.tsx`
**Description:** Better empty state when no files exist
- [ ] Already has empty state (lines 500-513)
- [ ] Consider adding brief instruction text

### Task 5: File Toggle in ChatNav
**File:** `frontend/src/components/nav/ChatNav.tsx`
**Description:** Secondary toggle location for discoverability
- [ ] Add small files indicator icon in nav
- [ ] Shows file count badge
- [ ] Toggles viewMode on click

---

## Priority: Low (Nice-to-Have)

### Task 6: Keyboard Shortcut
**Description:** Cmd/Ctrl+Shift+E to toggle editor mode
- [ ] Add keyboard listener in ChatPanel/ThreadPage
- [ ] Toggle viewMode on shortcut

### Task 7: Mobile Sheet View
**Description:** Show files in bottom sheet on mobile
- [ ] Currently editor is `hidden md:block`
- [ ] Could show Sheet component for mobile

---

## Testing Checklist

### Unit Tests
- [ ] `addFile()` creates file with correct structure
- [ ] `updateFileContent()` updates correct file in filesMap
- [ ] `removeFile()` removes file and cleans empty keys
- [ ] `renameFile()` preserves content, updates path

### Integration Tests
- [ ] Create file → appears in editor tabs
- [ ] Edit file → changes persist in filesMap
- [ ] Delete file → removed from tabs, selects adjacent
- [ ] Files sent to backend on submit
- [ ] Thread reload restores files

### Manual Tests
- [ ] New conversation: add file before first message
- [ ] Existing thread: add file, send message, reload
- [ ] VSCode feel: tabs, context menu, inline rename
- [ ] Mobile: graceful degradation

---

## Implementation Order

```
1. ChatInput toggle button (Task 1)
   └── Enables basic file management access

2. FileViewer edit button (Task 3)
   └── Connects chat files to editor

3. Quick new file (Task 2)
   └── Streamlines file creation

4. Testing & Polish (Tasks 4-7)
```

---

## Estimated Scope
- **Task 1-3:** Core functionality - ~2-3 hours
- **Task 4-7:** Polish - ~1-2 hours
- **Testing:** ~1 hour
