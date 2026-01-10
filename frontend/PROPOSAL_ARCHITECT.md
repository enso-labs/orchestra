# PROPOSAL: ARCHITECT — System Design Perspective

## Executive Summary
The core issue is a **data structure mismatch**: `filesMap` stores files nested under message IDs, but `useFileTreeData` expects a flat map of file paths. The solution requires introducing a proper `fileSystem` state with VSCode-like tab semantics (open tabs vs file existence are decoupled).

## Architectural Analysis

### Current State Assessment
```
filesMap: Map<string, Record<string, FileData>>
├── "__user_files__" → { "/main.py": {...}, "/src/app.ts": {...} }
├── "msg-123" → { "/generated/output.txt": {...} }
└── "msg-456" → { "/docs/readme.md": {...} }
```

The `useFileTreeData` hook incorrectly iterates:
```typescript
for (const rawPath of filesMap.keys()) { ... }
// Gets: "__user_files__", "msg-123", "msg-456" — NOT file paths!
```

### Proposed Architecture
Introduce a **three-tier state model**:

1. **`fileSystem`** - Canonical source of all files (replaces `filesMap`)
   ```typescript
   type FileSystem = Map<string, FileData>;
   // Keys are file paths: "/main.py", "/src/app.ts"
   ```

2. **`openTabs`** - Set of currently open file paths
   ```typescript
   type OpenTabs = string[];
   // Ordered list: ["/main.py", "/src/app.ts"]
   ```

3. **`activeFile`** - Currently selected/focused file path
   ```typescript
   type ActiveFile = string | null;
   ```

### Data Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                      useFileSystem Hook                      │
├──────────────────┬──────────────────┬───────────────────────┤
│   fileSystem     │    openTabs      │    activeFile         │
│   Map<path,data> │    string[]      │    string | null      │
├──────────────────┴──────────────────┴───────────────────────┤
│                         Actions                              │
│  • createFile(path, content)    → adds to fileSystem        │
│  • deleteFile(path)             → removes from fileSystem   │
│  • openTab(path)                → adds to openTabs          │
│  • closeTab(path)               → removes from openTabs     │
│  • selectTab(path)              → sets activeFile           │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Strategy

### Step 1: Create `useFileSystem` Hook
New hook that manages the three-tier state with proper separation of concerns.

### Step 2: Migrate `filesMap` → `fileSystem`
- Flatten the nested structure on SSE receive
- Store files directly by path
- Maintain backward compatibility with stream handler

### Step 3: Update FileTree Components
- `useFileTreeData` receives flattened `fileSystem` Map
- Tree correctly iterates over actual file paths

### Step 4: Implement Tab Management
- `openTabs` array tracks visible tabs
- Closing tab removes from `openTabs`, NOT from `fileSystem`
- Double-clicking tree item adds to `openTabs` and sets `activeFile`

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Flat `fileSystem` Map | Direct path → data lookup, O(1) access |
| Separate `openTabs` array | Decouples UI state from data persistence |
| Keep message association metadata | Allows tracking file provenance for debugging |

## Risk Assessment
- **Migration Risk**: Existing SSE handler expects nested structure
- **Mitigation**: Transform at receive boundary, internal state is flat

## Estimated Complexity
- **Scope**: Medium
- **Risk Level**: Low (localized to frontend state)
- **Priority**: P0 — Blocking user functionality
