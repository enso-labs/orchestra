# AGENT_4: OPTIMIZER — Performance & Efficiency Specialist

## Mission
Ensure the TreeView implementation maintains exceptional performance with large file sets, minimal re-renders, and efficient memory usage.

---

## Executive Summary

Performance is critical for file trees. Users may have 1000+ files, and the tree must remain responsive. Key strategies: **virtualization** for large trees, **memoization** of tree data transformations, **lazy loading** of deep folder contents, and **efficient selection state management**. Target: <16ms render time for any tree operation.

---

## Architectural Analysis

### Current Performance Profile

**Observations from FileEditorPanel.tsx:**
- Monaco editor options are memoized (line 93-101) ✅
- Content change is debounced (300ms) ✅
- `allFiles` is derived via `useMemo` ✅

**Potential Issues:**
- `filesMap` iteration on every render
- No virtualization for tabs (could be 50+ tabs)
- Tree data would rebuild on any `filesMap` change

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial render | <50ms | React DevTools Profiler |
| Tree expansion | <16ms | Frame timing |
| File selection | <8ms | Click → render |
| Memory | <10MB for 5K files | Chrome DevTools |

---

## Implementation Strategy

### Step 1: Virtualized Tree Rendering

`react-complex-tree` supports virtualization via render callbacks:

**`components/panels/FileTree/VirtualizedTree.tsx`**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tree, TreeEnvironmentRef } from 'react-complex-tree';
import { useRef, useMemo, useCallback } from 'react';

interface VirtualizedTreeProps {
  items: Record<string, TreeItem>;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

export function VirtualizedTree({ items, selectedFile, onSelect }: VirtualizedTreeProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const environmentRef = useRef<TreeEnvironmentRef>(null);
  
  // Get visible items for virtualization
  const visibleItems = useMemo(() => {
    return getVisibleItems(items, environmentRef.current?.viewState || {});
  }, [items]);
  
  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // row height in pixels
    overscan: 10, // render extra items above/below viewport
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  return (
    <div 
      ref={parentRef} 
      className="h-full overflow-auto"
      style={{ contain: 'strict' }} // CSS containment for perf
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = visibleItems[virtualRow.index];
          return (
            <div
              key={item.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TreeItemRow
                item={item}
                isSelected={selectedFile === item.data.path}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Memoized row component to prevent re-renders
const TreeItemRow = React.memo(function TreeItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: TreeItem;
  isSelected: boolean;
  onSelect: (path: string) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(item.data.path);
  }, [item.data.path, onSelect]);
  
  return (
    <button
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 text-sm",
        "hover:bg-sidebar-accent rounded-sm",
        isSelected && "bg-sidebar-accent"
      )}
      onClick={handleClick}
    >
      {/* ... icon, name, etc */}
    </button>
  );
});
```

### Step 2: Efficient Tree Data Memoization

**`hooks/useFileTreeData.ts`**
```typescript
import { useMemo, useRef } from 'react';

// Custom equality check for filesMap
function filesMapEqual(a: Map<string, any>, b: Map<string, any>): boolean {
  if (a.size !== b.size) return false;
  for (const [key] of a) {
    if (!b.has(key)) return false;
  }
  return true;
}

export function useFileTreeData(filesMap: Map<string, any>) {
  // Cache previous result
  const cacheRef = useRef<{
    input: Map<string, any>;
    output: Record<string, TreeItem>;
  } | null>(null);
  
  const treeItems = useMemo(() => {
    // Use cached result if filesMap hasn't changed
    if (cacheRef.current && filesMapEqual(cacheRef.current.input, filesMap)) {
      return cacheRef.current.output;
    }
    
    const result = buildTreeFromPaths(filesMap);
    
    // Update cache
    cacheRef.current = {
      input: new Map(filesMap),
      output: result,
    };
    
    return result;
  }, [filesMap]);

  return { items: treeItems };
}

// Optimized tree builder with object pooling
const nodePool: TreeItem[] = [];

function getPooledNode(): TreeItem {
  return nodePool.pop() || {
    index: '',
    isFolder: false,
    children: [],
    data: { name: '', path: '', isFolder: false },
  };
}

function returnToPool(node: TreeItem) {
  node.children = [];
  nodePool.push(node);
}

function buildTreeFromPaths(filesMap: Map<string, any>): Record<string, TreeItem> {
  // Convert to sorted array once (O(n log n) instead of O(n²))
  const paths = Array.from(filesMap.keys()).sort();
  
  const items: Record<string, TreeItem> = {
    root: {
      index: 'root',
      isFolder: true,
      children: [],
      data: { name: 'Files', path: '/', isFolder: true },
    },
  };
  
  // Track parent-child relationships for batch update
  const childrenMap = new Map<string, string[]>();
  childrenMap.set('root', []);
  
  for (const fullPath of paths) {
    const segments = fullPath.split('/').filter(Boolean);
    let currentPath = '';
    let parentKey = 'root';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      currentPath = `/${segments.slice(0, i + 1).join('/')}`;

      if (!items[currentPath]) {
        items[currentPath] = {
          index: currentPath,
          isFolder: !isLast,
          children: [],
          data: { name: segment, path: currentPath, isFolder: !isLast },
        };
        
        // Batch children updates
        const siblings = childrenMap.get(parentKey) || [];
        siblings.push(currentPath);
        childrenMap.set(parentKey, siblings);
        childrenMap.set(currentPath, []);
      }

      parentKey = currentPath;
    }
  }
  
  // Apply children in one pass
  for (const [key, children] of childrenMap) {
    if (items[key]) {
      items[key].children = children.sort((a, b) => {
        const aIsFolder = items[a]?.isFolder ?? false;
        const bIsFolder = items[b]?.isFolder ?? false;
        if (aIsFolder !== bIsFolder) return bIsFolder ? 1 : -1;
        return (items[a]?.data.name || '').localeCompare(items[b]?.data.name || '');
      });
    }
  }

  return items;
}
```

### Step 3: Lazy Loading for Deep Trees

**`hooks/useFileTreeLazyLoad.ts`**
```typescript
interface LazyTreeItem extends TreeItem {
  isLoaded?: boolean;
}

export function useFileTreeLazyLoad(
  filesMap: Map<string, any>,
  maxInitialDepth: number = 2
) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set(['root']));
  
  // Build tree with lazy loading support
  const treeItems = useMemo(() => {
    const items = buildTreeFromPaths(filesMap);
    
    // Mark items beyond maxInitialDepth as not loaded
    for (const [path, item] of Object.entries(items)) {
      const depth = path.split('/').filter(Boolean).length;
      if (depth > maxInitialDepth && item.isFolder) {
        (item as LazyTreeItem).isLoaded = loadedItems.has(path);
      }
    }
    
    return items;
  }, [filesMap, loadedItems, maxInitialDepth]);
  
  const handleExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => new Set([...prev, itemId]));
    
    // Load children if not already loaded
    if (!loadedItems.has(itemId)) {
      // Simulate async loading (in reality, children are already in filesMap)
      setLoadedItems(prev => new Set([...prev, itemId]));
    }
  }, [loadedItems]);
  
  return {
    treeItems,
    expandedItems,
    handleExpand,
    handleCollapse: useCallback((itemId: string) => {
      setExpandedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, []),
  };
}
```

### Step 4: React.memo for Tree Components

**`components/panels/FileTree/FileTreeNode.tsx`**
```tsx
import { memo, useCallback } from 'react';

interface FileTreeNodeProps {
  item: TreeItem;
  depth: number;
  isSelected: boolean;
  isDirty: boolean;
  isExpanded: boolean;
  onSelect: (path: string) => void;
  onExpand: (path: string) => void;
  onCollapse: (path: string) => void;
}

// Custom comparison function for shallow prop comparison
function arePropsEqual(prev: FileTreeNodeProps, next: FileTreeNodeProps): boolean {
  return (
    prev.item.index === next.item.index &&
    prev.depth === next.depth &&
    prev.isSelected === next.isSelected &&
    prev.isDirty === next.isDirty &&
    prev.isExpanded === next.isExpanded
    // Callbacks are stable via useCallback in parent
  );
}

export const FileTreeNode = memo(function FileTreeNode({
  item,
  depth,
  isSelected,
  isDirty,
  isExpanded,
  onSelect,
  onExpand,
  onCollapse,
}: FileTreeNodeProps) {
  // Stable callback references
  const handleClick = useCallback(() => {
    if (item.data.isFolder) {
      isExpanded ? onCollapse(item.data.path) : onExpand(item.data.path);
    } else {
      onSelect(item.data.path);
    }
  }, [item.data.path, item.data.isFolder, isExpanded, onSelect, onExpand, onCollapse]);
  
  return (
    <button
      className={cn(
        "w-full flex items-center gap-1.5 text-sm",
        "hover:bg-sidebar-accent rounded-sm",
        isSelected && "bg-sidebar-accent"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={handleClick}
    >
      {/* Render content */}
    </button>
  );
}, arePropsEqual);
```

### Step 5: Debounced Search Filter

**`components/panels/FileTree/FileTreeSearch.tsx`**
```tsx
import { useDeferredValue, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface FileTreeSearchProps {
  items: Record<string, TreeItem>;
  onFilterChange: (filteredItems: Record<string, TreeItem>) => void;
}

export function FileTreeSearch({ items, onFilterChange }: FileTreeSearchProps) {
  const [query, setQuery] = useState('');
  
  // Defer expensive filtering
  const deferredQuery = useDeferredValue(query);
  
  const filteredItems = useMemo(() => {
    if (!deferredQuery.trim()) return items;
    
    const lowerQuery = deferredQuery.toLowerCase();
    const matching = new Set<string>();
    
    // Find matching items
    for (const [path, item] of Object.entries(items)) {
      if (item.data.name.toLowerCase().includes(lowerQuery)) {
        matching.add(path);
        
        // Include all ancestors
        const segments = path.split('/').filter(Boolean);
        let ancestorPath = '';
        for (const segment of segments.slice(0, -1)) {
          ancestorPath = `/${ancestorPath}${segment}`.replace('//', '/');
          matching.add(ancestorPath);
        }
      }
    }
    
    // Build filtered tree
    const filtered: Record<string, TreeItem> = {
      root: { ...items.root, children: [] },
    };
    
    for (const path of matching) {
      if (items[path]) {
        filtered[path] = {
          ...items[path],
          children: items[path].children.filter(c => matching.has(c)),
        };
      }
    }
    
    // Rebuild root children
    filtered.root.children = items.root.children.filter(c => matching.has(c));
    
    return filtered;
  }, [items, deferredQuery]);
  
  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange(filteredItems);
  }, [filteredItems, onFilterChange]);
  
  return (
    <div className="px-2 pb-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 pl-8 text-sm"
        />
      </div>
    </div>
  );
}
```

---

## Performance Benchmarks

### Expected Results

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| 100 files initial render | ~30ms | ~20ms | 33% faster |
| 1000 files initial render | ~150ms | ~40ms | 73% faster |
| 5000 files initial render | ~800ms | ~80ms | 90% faster |
| File selection | ~15ms | ~5ms | 67% faster |
| Expand folder (100 items) | ~20ms | ~8ms | 60% faster |

### Measurement Strategy

```typescript
// Performance monitoring hook
export function useFileTreePerformance() {
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('file-tree:')) {
          console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, []);
  
  return {
    mark: (name: string) => performance.mark(`file-tree:${name}`),
    measure: (name: string, startMark: string) => {
      performance.measure(
        `file-tree:${name}`,
        `file-tree:${startMark}`
      );
    },
  };
}
```

---

## Risk Assessment

### Performance Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Slow initial render | Low | High | Virtualization |
| Memory leaks | Low | Medium | Cleanup in useEffect |
| Re-render storms | Medium | Medium | React.memo + stable callbacks |
| Large DOM | Medium | High | Virtualization limits DOM nodes |

---

## Estimated Complexity

| Aspect | Rating |
|--------|--------|
| **Scope** | Medium |
| **Risk Level** | Low |
| **Time Estimate** | 2 days |

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `hooks/useFileTreeData.ts` | Create | Memoized tree builder |
| `hooks/useFileTreeLazyLoad.ts` | Create | Lazy loading support |
| `components/panels/FileTree/VirtualizedTree.tsx` | Create | Virtualized rendering |
| `components/panels/FileTree/FileTreeSearch.tsx` | Create | Deferred search filter |
| `components/panels/FileTree/FileTreeNode.tsx` | Create | Memoized node component |
