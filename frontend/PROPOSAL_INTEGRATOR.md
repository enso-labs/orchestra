# PROPOSAL: INTEGRATOR — API & System Boundaries Perspective

## Executive Summary
The integration point between SSE stream data and frontend state is where the data structure mismatch occurs. The fix requires a **transformation layer** at the receive boundary and proper API contracts between components.

## Architectural Analysis

### Current Integration Flow (Broken)
```
SSE Stream → handleMessages() → filesMap.set(messageId, files) → useFileTreeData(filesMap)
                                    ↑                                      ↑
                              Stores by messageId              Expects file paths as keys
```

### Proposed Integration Flow (Fixed)
```
SSE Stream → handleMessages() → transformFiles() → fileSystem.importFiles(flatMap)
                                      ↓
                              Flattens to path-keyed Map
                                      ↓
                              useFileTreeData(fileSystem.files) ← Now receives correct format
```

## Implementation Strategy

### Step 1: Create File Transformer Utility

```typescript
// lib/utils/fileTransformer.ts
export interface RawStreamFiles {
  [path: string]: {
    content: string | string[];
    created_at?: string;
    modified_at?: string;
  };
}

export interface NormalizedFile {
  content: string[];
  created_at: string;
  modified_at: string;
  source: string;
}

/**
 * Transforms SSE file payload to normalized format
 * @param rawFiles - Files from SSE stream
 * @param sourceId - Message ID that produced these files
 */
export function transformStreamFiles(
  rawFiles: RawStreamFiles,
  sourceId: string
): Map<string, NormalizedFile> {
  const result = new Map<string, NormalizedFile>();
  const now = new Date().toISOString();
  
  for (const [path, data] of Object.entries(rawFiles)) {
    result.set(path, {
      content: Array.isArray(data.content) ? data.content : data.content.split('\n'),
      created_at: data.created_at || now,
      modified_at: data.modified_at || now,
      source: sourceId,
    });
  }
  
  return result;
}
```

### Step 2: Update SSE Handler Integration

```typescript
// In useChat.ts handleMessages()
if (valuesData.files && Object.keys(valuesData.files).length > 0) {
  const latestAiMessage = history.slice().reverse()
    .find((msg: any) => ["ai", "assistant", "tool"].includes(msg.type ?? msg.role));
  
  if (latestAiMessage) {
    // Transform and merge into fileSystem
    const normalizedFiles = transformStreamFiles(valuesData.files, latestAiMessage.id);
    importFiles(normalizedFiles);
    
    // Auto-open new files as tabs
    for (const path of normalizedFiles.keys()) {
      openTab(path);
    }
    
    // Set first new file as active
    const firstPath = normalizedFiles.keys().next().value;
    if (firstPath) selectTab(firstPath);
  }
}
```

### Step 3: API Contract for FileEditorPanel

```typescript
interface FileEditorPanelProps {
  // Remove: filesMap: Map<string, any>
  // The panel now uses context directly
}

// Inside FileEditorPanel:
const { 
  files,       // Map<string, FileData>
  openTabs,    // string[]
  activeFile,  // string | null
  closeTab,    // (path: string) => void
  selectTab,   // (path: string) => void
  deleteFile,  // (path: string) => void
} = useFileSystem();
```

### Step 4: API Contract for FileTreeSidebar

```typescript
interface FileTreeSidebarProps {
  // Receive from context:
  // - files: Map<string, FileData> for tree building
  // - openTabs: string[] to show "open" indicator (optional)
  
  onFileSelect: (path: string) => void;  // Opens tab + selects
  onFileDelete: (path: string) => void;  // Removes from fileSystem
}
```

## Design Decisions

### Boundary Responsibilities

| Component | Input Contract | Output Contract |
|-----------|---------------|-----------------|
| SSE Handler | Raw stream JSON | Calls `importFiles(Map)` |
| `useFileSystem` | Method calls | State + actions |
| `useFileTreeData` | `Map<string, FileData>` | Tree structure |
| `FileTreeSidebar` | Tree data from hook | File selection events |
| `FileEditorPanel` | State from context | File operations |

### Backward Compatibility
- `getFilesForSubmission()` still returns `Record<string, any>` for API submission
- Internal state is `Map` for O(1) operations

## Risk Assessment
- **Integration Risk**: SSE handler changes affect streaming behavior
- **Mitigation**: Transform at earliest point, maintain existing stream processing

## Estimated Complexity
- **Scope**: Medium
- **Risk Level**: Medium (touches SSE handler)
- **Priority**: P0
