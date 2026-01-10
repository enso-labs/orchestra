# AGENT_3: GUARDIAN — Security, Accessibility & Edge Cases Specialist

## Mission
Ensure the TreeView implementation is robust, accessible, handles all edge cases, and maintains security best practices.

---

## Executive Summary

The TreeView integration must prioritize **accessibility compliance** (WCAG 2.1 AA), **defensive programming** against edge cases, and **XSS prevention** for user-generated file paths. The `react-complex-tree` library provides excellent a11y foundations, but we must ensure proper ARIA attributes, keyboard navigation, and screen reader announcements.

---

## Architectural Analysis

### Current Security Posture

**Observations:**
- File paths are user-generated (can contain malicious content)
- No visible sanitization of file names in `FileEditorPanel`
- Context menus use native browser elements (low XSS risk)
- Monaco editor handles code content safely

**Accessibility Baseline:**
- Some ARIA labels present (`aria-label` on buttons)
- Keyboard shortcuts exist but aren't comprehensive
- Screen reader support is minimal

### react-complex-tree Accessibility Features

✅ W3C compliant tree patterns (aria-treeitem, aria-expanded)
✅ Full keyboard navigation (Arrow keys, Enter, Space, Home, End)
✅ Multi-select with Ctrl/Shift
✅ Type-ahead search
✅ Configurable focus management

---

## Implementation Strategy

### Step 1: Security - Input Sanitization

**`lib/utils/pathSanitizer.ts`**
```typescript
/**
 * Sanitizes file paths to prevent XSS and path traversal
 */
export function sanitizePath(path: string): string {
  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');
  
  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Remove leading/trailing whitespace
  sanitized = sanitized.trim();
  
  // Ensure path starts with /
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }
  
  // Remove consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/');
  
  return sanitized;
}

/**
 * Extracts safe display name from path
 */
export function getDisplayName(path: string): string {
  const sanitized = sanitizePath(path);
  const segments = sanitized.split('/').filter(Boolean);
  const name = segments[segments.length - 1] || 'Untitled';
  
  // Escape HTML entities for safe rendering
  return escapeHtml(name);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
```

### Step 2: Accessibility Implementation

**`components/panels/FileTree/FileTreeSidebar.tsx`**
```tsx
export function FileTreeSidebar({ isCollapsed }: FileTreeSidebarProps) {
  const announcerRef = useRef<HTMLDivElement>(null);
  
  // Screen reader announcements
  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  }, []);
  
  const handleSelect = useCallback((items: string[]) => {
    const selectedItem = items[0];
    if (selectedItem) {
      const name = getDisplayName(selectedItem);
      announce(`Selected ${name}`);
    }
    onFileSelect(selectedItem);
  }, [announce, onFileSelect]);
  
  const handleExpand = useCallback((item: TreeItem) => {
    announce(`Expanded folder ${item.data.name}`);
  }, [announce]);
  
  const handleCollapse = useCallback((item: TreeItem) => {
    announce(`Collapsed folder ${item.data.name}`);
  }, [announce]);

  return (
    <div
      role="region"
      aria-label="File explorer"
      className={cn("h-full flex flex-col", isCollapsed && "hidden")}
    >
      {/* Live region for screen reader announcements */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      
      <FileTreeHeader />
      
      <ControlledTreeEnvironment
        items={treeItems}
        getItemTitle={(item) => item.data.name}
        onSelectItems={handleSelect}
        onExpandItem={handleExpand}
        onCollapseItem={handleCollapse}
        // Accessibility props
        showLiveDescription
        renderLiveDescriptorContainer={(props) => (
          <div {...props} className="sr-only" />
        )}
      >
        <Tree
          treeId="file-tree"
          rootItem="root"
          treeLabel="Project files"
        />
      </ControlledTreeEnvironment>
      
      {/* Keyboard shortcuts help (visible on focus) */}
      <div className="sr-only" aria-describedby="tree-shortcuts">
        <p id="tree-shortcuts">
          Use arrow keys to navigate. Enter to select or expand folders.
          Type to search. Ctrl+click to multi-select.
        </p>
      </div>
    </div>
  );
}
```

### Step 3: Error Boundaries

**`components/panels/FileTree/FileTreeErrorBoundary.tsx`**
```tsx
import React, { Component, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FileTreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('FileTree error:', error, errorInfo);
    // Could send to error tracking service
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="flex flex-col items-center justify-center h-full p-4 text-center"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            Failed to load file tree
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Step 4: Edge Case Handling

**`hooks/useFileTreeData.ts` - Defensive Implementation**
```typescript
export function useFileTreeData(filesMap: Map<string, any>) {
  const treeItems = useMemo(() => {
    try {
      // Guard against null/undefined
      if (!filesMap || filesMap.size === 0) {
        return getEmptyTree();
      }
      
      return buildTreeFromPaths(filesMap);
    } catch (error) {
      console.error('Error building file tree:', error);
      return getEmptyTree();
    }
  }, [filesMap]);

  return { items: treeItems, isEmpty: Object.keys(treeItems).length <= 1 };
}

function getEmptyTree(): Record<string, FileTreeItem> {
  return {
    root: {
      index: 'root',
      isFolder: true,
      children: [],
      data: { name: 'Files', path: '/', isFolder: true },
    },
  };
}

function buildTreeFromPaths(filesMap: Map<string, any>): Record<string, FileTreeItem> {
  const items: Record<string, FileTreeItem> = getEmptyTree();
  const MAX_DEPTH = 20; // Prevent infinite recursion
  const MAX_FILES = 10000; // Prevent memory issues
  
  let fileCount = 0;
  
  for (const [rawPath] of filesMap) {
    if (fileCount++ >= MAX_FILES) {
      console.warn('Max file limit reached in tree view');
      break;
    }
    
    // Sanitize path
    const fullPath = sanitizePath(rawPath);
    if (!fullPath || fullPath === '/') continue;
    
    const segments = fullPath.split('/').filter(Boolean);
    
    // Prevent deeply nested paths
    if (segments.length > MAX_DEPTH) {
      console.warn(`Path exceeds max depth: ${fullPath}`);
      continue;
    }
    
    let currentPath = '';
    let parentKey = 'root';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Skip empty or dangerous segments
      if (!segment || segment === '.' || segment === '..') continue;
      
      const isLast = i === segments.length - 1;
      currentPath = `/${segments.slice(0, i + 1).join('/')}`;

      if (!items[currentPath]) {
        items[currentPath] = {
          index: currentPath,
          isFolder: !isLast,
          children: [],
          data: {
            name: segment,
            path: currentPath,
            isFolder: !isLast,
          },
        };

        const parent = items[parentKey];
        if (parent && !parent.children.includes(currentPath)) {
          parent.children.push(currentPath);
        }
      }

      parentKey = currentPath;
    }
  }

  // Sort all children (folders first, then alphabetical)
  for (const item of Object.values(items)) {
    if (item.children.length > 0) {
      item.children.sort((a, b) => {
        const aItem = items[a];
        const bItem = items[b];
        if (!aItem || !bItem) return 0;
        
        if (aItem.isFolder !== bItem.isFolder) {
          return bItem.isFolder ? 1 : -1;
        }
        return aItem.data.name.localeCompare(bItem.data.name);
      });
    }
  }

  return items;
}
```

### Step 5: Keyboard Shortcuts

**`components/panels/FileTree/useFileTreeKeyboard.ts`**
```typescript
import { useEffect } from 'react';

interface UseFileTreeKeyboardProps {
  onNewFile: () => void;
  onNewFolder: () => void;
  onDelete: () => void;
  onRename: () => void;
  selectedFile: string | null;
}

export function useFileTreeKeyboard({
  onNewFile,
  onNewFolder,
  onDelete,
  onRename,
  selectedFile,
}: UseFileTreeKeyboardProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when tree is focused
      const target = e.target as HTMLElement;
      if (!target.closest('[data-tree-id]')) return;
      
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedFile && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onDelete();
          }
          break;
          
        case 'F2':
          if (selectedFile) {
            e.preventDefault();
            onRename();
          }
          break;
          
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              onNewFolder();
            } else {
              onNewFile();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, onNewFile, onNewFolder, onDelete, onRename]);
}
```

---

## Design Decisions

### Security Measures

| Threat | Mitigation |
|--------|------------|
| XSS via file names | HTML entity escaping in `getDisplayName()` |
| Path traversal | Remove `..` sequences in sanitizePath() |
| Null byte injection | Strip null bytes from paths |
| Infinite recursion | MAX_DEPTH limit of 20 |
| Memory exhaustion | MAX_FILES limit of 10,000 |

### Accessibility Compliance (WCAG 2.1 AA)

| Guideline | Implementation |
|-----------|----------------|
| 1.3.1 Info & Relationships | Proper ARIA tree roles |
| 1.4.3 Contrast | Uses theme CSS variables (≥4.5:1) |
| 2.1.1 Keyboard | Full arrow key navigation |
| 2.1.2 No Keyboard Trap | Focus can leave tree naturally |
| 2.4.3 Focus Order | Logical top-to-bottom |
| 2.4.7 Focus Visible | Ring outline on focus |
| 4.1.2 Name, Role, Value | aria-label, aria-expanded, aria-selected |

---

## Risk Assessment

### Critical Edge Cases

| Case | Handling |
|------|----------|
| 10,000+ files | Virtualization + warning log |
| Circular path refs | Depth limit prevents |
| Unicode file names | Supported, normalized |
| Empty tree | Friendly "No files" state |
| Concurrent mutations | Memoization rebuilds tree |
| Invalid paths | Skip with warning, don't crash |

### Testing Requirements

```typescript
// Security tests
describe('sanitizePath', () => {
  it('should remove path traversal attempts', () => {
    expect(sanitizePath('/../etc/passwd')).toBe('/etc/passwd');
    expect(sanitizePath('/foo/../bar')).toBe('/foo/bar');
  });
  
  it('should escape HTML entities', () => {
    expect(getDisplayName('/<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});

// Accessibility tests (using jest-axe)
describe('FileTreeSidebar accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<FileTreeSidebar />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Estimated Complexity

| Aspect | Rating |
|--------|--------|
| **Scope** | Medium |
| **Risk Level** | Medium (security-sensitive) |
| **Time Estimate** | 2-3 days |

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/utils/pathSanitizer.ts` | Create | Path sanitization utilities |
| `components/panels/FileTree/FileTreeErrorBoundary.tsx` | Create | Error boundary wrapper |
| `components/panels/FileTree/useFileTreeKeyboard.ts` | Create | Keyboard shortcuts |
| `components/panels/FileTree/FileTreeSidebar.tsx` | Create | With a11y enhancements |
| `tests/unit/pathSanitizer.test.ts` | Create | Security unit tests |
| `tests/a11y/FileTree.test.tsx` | Create | Accessibility tests |
