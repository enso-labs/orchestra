# COUNCIL REVIEW: FileSystem State Refactoring

## Feature Under Review

Address TreeView file display issues, standardize `filesMap` → `fileSystem` naming, implement VSCode-like tab semantics.

---

## Proposal Comparison Matrix

| Aspect        | ARCHITECT                              | CRAFTSMAN                        | INTEGRATOR                  | Council Verdict                     |
| ------------- | -------------------------------------- | -------------------------------- | --------------------------- | ----------------------------------- |
| Root Cause    | Data structure mismatch                | SRP violation, leaky abstraction | Broken transformation layer | **All correct** — same root cause   |
| Solution      | Three-tier state model                 | `useFileSystem` hook             | Transformation utility      | **Unified**: New hook + transformer |
| State Design  | `fileSystem`, `openTabs`, `activeFile` | Same + `dirtyFiles`              | Delegates to hook           | **Include all four**                |
| Tab Semantics | Close ≠ Delete                         | Close ≠ Delete                   | Close ≠ Delete              | **Unanimous**                       |
| Naming        | `fileSystem` Map                       | `files` Map inside state         | `files` in context          | **Use `fileSystem`** (clarity)      |

---

## Consensus Points

All three proposals agree on:

1. **Root Cause**: `useFileTreeData` iterates `filesMap.keys()` which are message IDs, not file paths
2. **Solution**: Flatten nested structure into path-keyed Map
3. **Tab Behavior**: Closing a tab should NOT delete the file from state
4. **New State Variables**: Need `openTabs` and `activeFile` separate from file storage
5. **Naming**: Replace `filesMap` with `fileSystem` for semantic clarity

---

## Divergence Analysis

| Conflict         | ARCHITECT           | CRAFTSMAN                 | INTEGRATOR               | Council Decision                                             |
| ---------------- | ------------------- | ------------------------- | ------------------------ | ------------------------------------------------------------ |
| Hook Location    | New `useFileSystem` | New `useFileSystem`       | Transform utility + hook | **Create `useFileSystem` hook** with inline transformer      |
| Dirty State      | Not mentioned       | Explicit `dirtyFiles` Set | Not mentioned            | **Include `dirtyFiles`** (already exists in FileEditorPanel) |
| SSE Integration  | Abstract            | Abstract                  | Detailed transformation  | **Follow INTEGRATOR's** transformation pattern               |
| Where to flatten | At state update     | At state update           | At receive boundary      | **At receive boundary** (cleanest)                           |

---

## Unified Implementation Plan

### Phase 1: Create Foundation

1. **Create `useFileSystem.ts` hook** with:
   - `fileSystem`: `Map<string, FileData>` — canonical file storage
   - `openTabs`: `string[]` — ordered open tabs
   - `activeFile`: `string | null` — selected tab
   - `dirtyFiles`: `Set<string>` — unsaved changes tracking

2. **Define `FileData` interface**:
   ```typescript
   interface FileData {
   	content: string[];
   	created_at: string;
   	modified_at: string;
   	source?: string; // message ID that generated file
   }
   ```

### Phase 2: Implement Actions

3. **File operations** (modify `fileSystem`):
   - `createFile(path, content)`: Add to `fileSystem`, auto-open tab
   - `updateFile(path, content)`: Update content, set modified_at
   - `deleteFile(path)`: Remove from `fileSystem` AND `openTabs`
   - `renameFile(oldPath, newPath)`: Update key in `fileSystem`

4. **Tab operations** (modify `openTabs` only):
   - `openTab(path)`: Add to `openTabs` if not present
   - `closeTab(path)`: Remove from `openTabs`, select adjacent
   - `selectTab(path)`: Set as `activeFile`

5. **Bulk operations**:
   - `importFiles(files: Map<string, FileData>)`: Merge into `fileSystem`
   - `getFilesForSubmission()`: Export for API calls

### Phase 3: Integrate

6. **Update SSE handler** in `useChat.ts`:
   - Transform nested structure at receive
   - Call `importFiles()` with flattened Map
   - Auto-open new files as tabs

7. **Update `useFileTreeData`** to receive `Map<string, FileData>`:
   - Remove internal flattening logic
   - Iterate directly over `fileSystem.keys()`

8. **Update `FileEditorPanel`**:
   - Replace `filesMap` with `fileSystem` context
   - Use `openTabs` for tab bar
   - Call `closeTab` instead of delete on tab X button
   - Call `deleteFile` only from context menu "Delete"

9. **Update `FileTreeSidebar`**:
   - Receive `fileSystem` (not `filesMap`)
   - Double-click calls `openTab` + `selectTab`

### Phase 4: Cleanup

10. **Remove old `filesMap`** from `useChat.ts`
11. **Update `ChatContext`** exports
12. **Add `FileSystemProvider`** wrapper (optional, or keep in ChatContext)

---

## Risk Consolidation

| Risk                   | Likelihood | Impact | Mitigation                                   |
| ---------------------- | ---------- | ------ | -------------------------------------------- |
| Breaking SSE streaming | Medium     | High   | Transform at boundary, preserve stream logic |
| Component prop changes | High       | Low    | Update consumers systematically              |
| State sync issues      | Low        | Medium | Single source of truth in hook               |
| Dirty state tracking   | Low        | Low    | Already implemented in FileEditorPanel       |

---

## Final Verdict

**GO** — Proceed with implementation

### Confidence Level: **High**

### Non-Negotiable Requirements:

1. `useFileSystem` hook with four state variables
2. Flatten at SSE receive boundary
3. `closeTab` ≠ `deleteFile` semantics
4. Rename to `fileSystem` (not `filesMap`)

### Implementation Order:

1. Create `useFileSystem` hook (foundation)
2. Update SSE handler (data source)
3. Update `useFileTreeData` (data consumer)
4. Update `FileEditorPanel` (primary UI)
5. Update `FileTreeSidebar` (secondary UI)
6. Remove deprecated code

### Estimated Effort: **4-6 hours**
