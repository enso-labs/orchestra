# PROPOSAL: CRAFTSMAN — Clean Code & Maintainability Perspective

## Executive Summary
The current implementation violates the **Single Responsibility Principle** by overloading `filesMap` with both data storage and UI state concerns. The solution is to create a dedicated `useFileSystem` hook with clear separation between file data, tab state, and selection state.

## Architectural Analysis

### Code Smell Identification

1. **Semantic Mismatch**: Variable named `filesMap` but stores message-keyed nested objects
2. **Leaky Abstraction**: `useFileTreeData` assumes input structure that doesn't match reality
3. **Tight Coupling**: Tab close === file delete, violating user expectations

### Clean Code Violations

```typescript
// CURRENT: Confusing nested structure
filesMap.forEach((messageFiles) => {
  Object.assign(files, messageFiles);
});

// PROBLEM: useFileTreeData doesn't flatten, iterates wrong keys
for (const rawPath of filesMap.keys()) { ... }
```

## Implementation Strategy

### Step 1: Define Clear Interfaces

```typescript
// Types for file system state
interface FileData {
  content: string[];
  created_at: string;
  modified_at: string;
  source?: string; // message ID that created this file
}

interface FileSystemState {
  files: Map<string, FileData>;      // Canonical file storage
  openTabs: string[];                 // UI: which files have tabs
  activeFile: string | null;          // UI: which tab is selected
  dirtyFiles: Set<string>;            // UI: unsaved changes
}

interface FileSystemActions {
  // File operations (affect files Map)
  createFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  
  // Tab operations (affect openTabs only)
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  selectTab: (path: string) => void;
  
  // Bulk operations
  importFiles: (files: Record<string, FileData>) => void;
  getFilesForSubmission: () => Record<string, FileData>;
}
```

### Step 2: Implement `useFileSystem` Hook

```typescript
// hooks/useFileSystem.ts
export function useFileSystem(): FileSystemState & FileSystemActions {
  const [files, setFiles] = useState<Map<string, FileData>>(new Map());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  
  // Tab operations - NEVER delete files
  const closeTab = useCallback((path: string) => {
    setOpenTabs(prev => prev.filter(p => p !== path));
    if (activeFile === path) {
      // Select adjacent tab or null
      const idx = openTabs.indexOf(path);
      const next = openTabs[idx + 1] || openTabs[idx - 1] || null;
      setActiveFile(next);
    }
  }, [activeFile, openTabs]);
  
  // ... rest of implementation
}
```

### Step 3: Update `useFileTreeData` to Accept Flat Map

```typescript
// hooks/useFileTreeData.ts
export function useFileTreeData(files: Map<string, FileData>) {
  // Now correctly iterates file paths
  for (const path of files.keys()) { ... }
}
```

### Step 4: Integrate with SSE Handler

```typescript
// In handleMessages, transform nested to flat:
if (valuesData.files) {
  const flatFiles = new Map<string, FileData>();
  Object.entries(valuesData.files).forEach(([path, data]) => {
    flatFiles.set(path, { ...data, source: messageId });
  });
  importFiles(flatFiles);
}
```

## Design Decisions

### Naming Convention
| Old | New | Reason |
|-----|-----|--------|
| `filesMap` | `fileSystem.files` | Semantic clarity |
| `setFilesMap` | `createFile`, `updateFile` | Single responsibility |
| N/A | `openTabs` | Explicit UI state |

### Tab vs Delete Semantics
- **Close Tab**: `openTabs.filter()` — file remains in `files`
- **Delete File**: `files.delete()` + `openTabs.filter()` — both updated

## Risk Assessment
- **Breaking Change**: Components using old `filesMap` API need updates
- **Mitigation**: Provide backward-compatible wrapper during transition

## Estimated Complexity
- **Scope**: Medium
- **Risk Level**: Low
- **Priority**: P0
