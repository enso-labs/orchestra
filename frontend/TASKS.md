# Implementation Tasks: FileSystem State Refactoring

## Pre-Implementation

- [ ] Verify development environment setup
- [ ] Review REVIEW.md council decisions

---

## Core Implementation

### Task 1: Create `useFileSystem` Hook

- [ ] **1.1** Create file `src/hooks/useFileSystem.ts`
  - Files: `src/hooks/useFileSystem.ts`
  - Acceptance: File exists with proper TypeScript types

- [ ] **1.2** Define `FileData` interface
  - Acceptance: Interface includes `content`, `created_at`, `modified_at`, `source?`

- [ ] **1.3** Implement state variables
  - `fileSystem: Map<string, FileData>`
  - `openTabs: string[]`
  - `activeFile: string | null`
  - `dirtyFiles: Set<string>`
  - Acceptance: All four state variables initialized

- [ ] **1.4** Implement file operations
  - `createFile(path, content?)`: Add to fileSystem, auto-open tab
  - `updateFile(path, content)`: Update content and modified_at
  - `deleteFile(path)`: Remove from fileSystem AND openTabs
  - `renameFile(oldPath, newPath)`: Move file data to new key
  - Acceptance: All four functions implemented with useCallback

- [ ] **1.5** Implement tab operations
  - `openTab(path)`: Add to openTabs if not present
  - `closeTab(path)`: Remove from openTabs, select adjacent tab
  - `selectTab(path)`: Set as activeFile
  - Acceptance: closeTab does NOT delete file from fileSystem

- [ ] **1.6** Implement bulk operations
  - `importFiles(files: Map<string, FileData>)`: Merge into fileSystem
  - `clearFileSystem()`: Reset all state
  - `getFilesForSubmission()`: Export as Record for API
  - Acceptance: importFiles merges (not replaces) existing files

- [ ] **1.7** Implement dirty tracking
  - `markDirty(path)`: Add to dirtyFiles
  - `markClean(path)`: Remove from dirtyFiles
  - Acceptance: Functions work correctly

---

### Task 2: Update SSE Handler Integration

- [ ] **2.1** Modify `useChat.ts` to use `useFileSystem` actions
  - Files: `src/hooks/useChat.ts`
  - Acceptance: Import `importFiles`, `openTab`, `selectTab` from context

- [ ] **2.2** Transform nested files to flat Map at receive
  - In `handleMessages` when `valuesData.files` received
  - Create `Map<string, FileData>` from nested object
  - Call `importFiles(flatMap)`
  - Acceptance: Files are stored with path as key

- [ ] **2.3** Auto-open new files as tabs
  - After importing, call `openTab(path)` for each new file
  - Set first new file as active
  - Acceptance: New AI-generated files appear as open tabs

---

### Task 3: Update Context Provider

- [ ] **3.1** Add `useFileSystem` to `ChatProvider`
  - Files: `src/context/ChatContext.tsx`
  - Acceptance: fileSystem state accessible via `useChatContext()`

- [ ] **3.2** Export new types from context
  - Acceptance: `FileData`, `FileSystemState` types exported

- [ ] **3.3** Remove old `filesMap` state from useChat
  - Keep `getFilesForSubmission` for backward compat
  - Acceptance: Old `filesMap` no longer in hook

---

### Task 4: Update `useFileTreeData` Hook

- [ ] **4.1** Change parameter type to `Map<string, FileData>`
  - Files: `src/hooks/useFileTreeData.ts`
  - Acceptance: Function signature accepts flat file Map

- [ ] **4.2** Update iteration to use file paths directly
  - Remove any nested object handling
  - Iterate `fileSystem.keys()` directly
  - Acceptance: Tree builds correctly from flat Map

---

### Task 5: Update `FileEditorPanel`

- [ ] **5.1** Replace `filesMap` prop with context usage
  - Files: `src/components/panels/FileEditorPanel.tsx`
  - Acceptance: Uses `useChatContext()` for fileSystem

- [ ] **5.2** Replace `allFiles` derivation with `fileSystem` Map
  - Remove the `useMemo` that flattens filesMap
  - Use `fileSystem` directly
  - Acceptance: File content accessed via `fileSystem.get(path)`

- [ ] **5.3** Update tab bar to use `openTabs`
  - Iterate `openTabs` instead of all file keys
  - Acceptance: Only open tabs shown in tab bar

- [ ] **5.4** Update tab close to call `closeTab`
  - X button calls `closeTab(path)` NOT `removeFile`
  - Acceptance: Closing tab preserves file in tree

- [ ] **5.5** Update delete to call `deleteFile`
  - Context menu "Delete" calls `deleteFile(path)`
  - Acceptance: Delete removes from both tabs and fileSystem

- [ ] **5.6** Update file selection to call `selectTab`
  - Clicking tab calls `selectTab(path)`
  - Acceptance: `activeFile` updates on tab click

---

### Task 6: Update `FileTreeSidebar`

- [ ] **6.1** Use `fileSystem` instead of `filesMap`
  - Files: `src/components/panels/FileTree/FileTreeSidebar.tsx`
  - Acceptance: Receives correct flattened Map

- [ ] **6.2** Double-click opens file in tab
  - Call `openTab(path)` + `selectTab(path)` on double-click
  - Acceptance: Tree item double-click opens tab

- [ ] **6.3** Single-click selects without opening
  - Just highlight in tree, don't open tab
  - Acceptance: Single click selects in tree only

---

## Integration

- [ ] **7.1** Verify tree displays all files
  - Acceptance: Created files appear in tree

- [ ] **7.2** Verify tab close preserves files
  - Acceptance: Closed tab file still in tree

- [ ] **7.3** Verify tree double-click reopens file
  - Acceptance: Double-clicking tree item opens tab

---

## Testing

- [ ] **8.1** Test file creation flow
  - Create file → appears in tree AND tabs
  - Acceptance: New files visible in both

- [ ] **8.2** Test tab close flow
  - Close tab → file remains in tree
  - Acceptance: Tree still shows file

- [ ] **8.3** Test file reopen flow
  - Double-click closed file in tree → opens as tab
  - Acceptance: Tab appears, editor shows content

- [ ] **8.4** Test file delete flow
  - Delete from context menu → removes from everywhere
  - Acceptance: File gone from tree AND tabs

---

## Verification

- [ ] All acceptance criteria from tasks met
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Tree displays files correctly
- [ ] Tabs work with VSCode semantics

---

## Completion Signature

- **Total Tasks**: 28
- **Estimated Effort**: 4-6 hours
- **Dependencies**: None (all frontend)
