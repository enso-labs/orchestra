# GUARDIAN Implementation Proposal: Frontend `file_system` Alignment

**Agent:** GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Feature:** Update frontend to use `file_system` instead of `files` to align with backend changes
**Date:** 2026-01-17
**Branch:** `feat/685-simpilfy-llm-stream`

---

## 1. Executive Summary

The frontend must migrate from using the `files` field to the new `file_system` field when communicating with the backend API. This migration requires careful defensive programming to ensure backwards compatibility with existing threads, graceful handling of mixed formats during the transition period, and comprehensive validation to prevent data loss. The implementation should prioritize stability through a dual-read strategy that accepts both field names while standardizing on `file_system` for all outbound requests.

---

## 2. Architectural Analysis

### 2.1 Current Data Flow

```
Frontend FileEditorPanel
        |
        v
useFileSystem hook (Map<string, FileData>)
        |
        v
ChatContext (filesMap: Map<string, any>)
        |
        v
useChat hook (builds payload with `files` field)
        |
        v
Backend API (/llm/stream, /threads, /shares)
```

### 2.2 Error Handling Gaps Identified

| Location | Gap | Risk |
|----------|-----|------|
| `useChat.ts:198-199` | Sends `files` field only, ignores `file_system` | Backend may drop data if `files` is deprecated |
| `useChat.ts:467-483` | SSE handler only checks `valuesData.files` | Misses `file_system` data from newer backend responses |
| `ChatContext.tsx:46-74` | Syncs only from `filesMap` to `fileSystem` | No reverse handling for `file_system` SSE events |
| `FileEditorPanel.tsx:257-258` | Sends `files` in payload | Inconsistent with backend schema changes |
| `SharedThreadPage.tsx:52-56` | Reads `data.thread.files` only | Shared threads with `file_system` will fail |
| `useThread.ts:102-114` | Only checks `threadData.files` | Existing threads stored with `file_system` won't load files |
| `stream.ts (validation)` | Schema only defines `files?: Record<string, unknown>` | No validation for `file_system` field |

### 2.3 Edge Cases in Current Implementation

1. **Mixed Format Threads**: Older threads have `files`, newer ones may have `file_system`
2. **In-Flight Requests**: During deployment, backend may return either format
3. **Shared Links**: Cached or persisted share data may contain old format
4. **Agent Configurations**: The `Assistant.file_system` field already exists in backend
5. **SSE Stream Events**: `ValuesEvent` may contain `files` or `file_system` or both
6. **Race Conditions**: Concurrent SSE updates may interleave old/new formats
7. **Browser Storage**: Cached thread data may be stale

### 2.4 Security Considerations

1. **Data Integrity**: Migration must not silently drop file content
2. **Path Validation**: File paths must be validated regardless of field name
3. **XSS Prevention**: Content from either field flows to Monaco editor - already sanitized
4. **Information Disclosure**: Error messages should not leak field name details

---

## 3. Implementation Strategy

### 3.1 Defensive Coding Patterns

#### Pattern 1: Dual-Read Utility Function

Create a centralized utility to extract files from any payload:

```typescript
// frontend/src/lib/utils/fileSystemCompat.ts

/**
 * Safely extracts file data from a payload that may use either
 * the legacy `files` field or the new `file_system` field.
 *
 * Priority: file_system > files (matches backend behavior)
 *
 * @param payload - Object that may contain files or file_system
 * @returns Normalized file data object, never null
 */
export function extractFiles(payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  // Backend prioritizes file_system over files (see backend/src/utils/stream.py:60)
  const fileSystem = payload.file_system;
  const files = payload.files;

  // Validate that the value is actually an object
  if (fileSystem && typeof fileSystem === 'object' && !Array.isArray(fileSystem)) {
    return fileSystem as Record<string, unknown>;
  }

  if (files && typeof files === 'object' && !Array.isArray(files)) {
    return files as Record<string, unknown>;
  }

  return {};
}

/**
 * Validates file path format for security.
 * Rejects path traversal attempts.
 */
export function isValidFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('/')) return false;
  if (path.includes('..')) return false;
  if (!/^\/[a-zA-Z0-9_\-./]+$/.test(path)) return false;
  return true;
}

/**
 * Sanitizes a file system object by validating all paths.
 * Invalid paths are logged and excluded.
 */
export function sanitizeFileSystem(files: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [path, data] of Object.entries(files)) {
    if (isValidFilePath(path)) {
      result[path] = data;
    } else {
      console.warn(`[fileSystemCompat] Invalid file path rejected: ${path.substring(0, 50)}`);
    }
  }

  return result;
}
```

#### Pattern 2: Payload Builder with Deprecation Support

```typescript
// frontend/src/lib/utils/payloadBuilder.ts

interface FilePayloadOptions {
  files: Record<string, unknown>;
  /**
   * When true, sends both `files` and `file_system` for backwards compatibility.
   * When false (default after migration complete), sends only `file_system`.
   */
  includeLegacyField?: boolean;
}

/**
 * Builds the file portion of an API request payload.
 * Handles the migration from `files` to `file_system`.
 */
export function buildFilePayload(options: FilePayloadOptions): Record<string, unknown> {
  const { files, includeLegacyField = true } = options;

  if (Object.keys(files).length === 0) {
    return {};
  }

  const result: Record<string, unknown> = {
    file_system: files,
  };

  // Include legacy field during transition period
  if (includeLegacyField) {
    result.files = files;
  }

  return result;
}
```

### 3.2 Fallback Mechanisms for Backwards Compatibility

#### Strategy: Dual-Write During Transition

During the migration period (suggest 2-4 weeks), the frontend should:

1. **Read**: Accept both `files` and `file_system`, prioritizing `file_system`
2. **Write**: Send both `files` and `file_system` in payloads

This ensures:
- Old backend versions can still read `files`
- New backend versions prefer `file_system`
- Threads created during transition work with both versions

#### Transition Timeline

```
Phase 1 (Week 1-2): Dual-Write Mode
- Frontend sends: { files: {...}, file_system: {...} }
- Frontend reads: file_system || files
- Backend accepts both, prefers file_system

Phase 2 (Week 3-4): Monitor & Validate
- Monitor logs for files-only requests
- Confirm no clients are sending files-only

Phase 3 (Post-transition): Cleanup
- Set includeLegacyField = false
- Remove files field from outbound payloads
- Add deprecation warning for files-only inbound
```

### 3.3 Validation Improvements

#### Update Zod Schemas

```typescript
// frontend/src/validations/stream.ts - MODIFIED

// Schema for values event payload - NOW INCLUDES file_system
export const ValuesPayloadSchema = z.object({
  messages: z.array(z.record(z.unknown())),
  files: z.record(z.unknown()).optional(),
  file_system: z.record(z.unknown()).optional(),  // NEW
  todos: z.record(z.unknown()).optional(),
});

// Add validation helper
export function validateFilesPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  // At least one file field should be present if files are expected
  const hasFiles = p.files !== undefined && p.files !== null;
  const hasFileSystem = p.file_system !== undefined && p.file_system !== null;

  return hasFiles || hasFileSystem;
}
```

#### Update Stream Entity Types

```typescript
// frontend/src/lib/entities/stream.ts - MODIFIED

export interface ValuesEvent {
  type: "values";
  data: {
    messages: Array<Record<string, unknown>>;
    files?: Record<string, unknown>;        // Legacy - will be deprecated
    file_system?: Record<string, unknown>;  // NEW - preferred
    todos?: Record<string, unknown>;
  };
}
```

---

## 4. Design Decisions

### 4.1 How to Handle Mixed `files`/`file_system` Data

**Decision**: Priority-based merging with `file_system` taking precedence

**Rationale**:
- Matches backend behavior (`files_map = metadata.get("files", {}) or input.file_system or {}`)
- Provides predictable behavior for developers
- Allows gradual migration without data loss

**Implementation**:

```typescript
// In handleMessages or SSE event handlers
const extractedFiles = extractFiles(valuesData);
// extractFiles internally handles: file_system > files
```

### 4.2 Error Recovery Strategies

#### Strategy 1: Silent Fallback with Logging

When `file_system` is missing but `files` is present:
- Use `files` data
- Log warning: `"Using legacy 'files' field - consider updating to 'file_system'"`
- Continue operation normally

#### Strategy 2: Graceful Degradation for Invalid Data

When file data is malformed:
- Skip invalid entries
- Log error with path (truncated for security)
- Display available files only
- Show toast notification to user: "Some files could not be loaded"

#### Strategy 3: Retry Logic for Network Errors

For thread loading failures:
- Retry up to 3 times with exponential backoff
- On final failure, show user-friendly error
- Offer "Retry" button in UI

### 4.3 Logging and Debugging Improvements

Add structured logging for file system operations:

```typescript
// frontend/src/lib/utils/fileSystemCompat.ts

const FILE_SYSTEM_LOG_PREFIX = '[FileSystem]';

export function logFileOperation(operation: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${FILE_SYSTEM_LOG_PREFIX} ${operation}`, details);
  }
}

// Usage in extractFiles:
export function extractFiles(payload: Record<string, unknown>): Record<string, unknown> {
  const hasFileSystem = 'file_system' in payload;
  const hasFiles = 'files' in payload;

  logFileOperation('extractFiles', {
    hasFileSystem,
    hasFiles,
    source: hasFileSystem ? 'file_system' : hasFiles ? 'files' : 'none'
  });

  // ... rest of implementation
}
```

---

## 5. Risk Assessment

### 5.1 Data Loss Scenarios

| Scenario | Risk Level | Mitigation |
|----------|------------|------------|
| Frontend sends `files` only, backend ignores it | HIGH | Dual-write both fields during transition |
| Backend returns `file_system` only, frontend ignores | HIGH | Update frontend read logic first |
| Existing threads have `files`, frontend expects `file_system` | MEDIUM | Dual-read utility function |
| User edits file, SSE update overwrites with stale `files` | MEDIUM | Respect `dirtyFiles` set during sync |
| Cached thread data has old format | LOW | Clear cache on version upgrade |

### 5.2 Race Conditions

| Scenario | Risk Level | Mitigation |
|----------|------------|------------|
| SSE event arrives during component unmount | MEDIUM | AbortController cleanup already in place |
| Multiple SSE events interleave with user edits | MEDIUM | Existing `dirtyFiles` tracking prevents overwrite |
| Thread switch during file load | LOW | `lastFetchedTokenRef` pattern already in use |
| Concurrent file updates from multiple tabs | LOW | Out of scope - no multi-tab sync currently |

### 5.3 API Version Mismatches

| Scenario | Risk Level | Mitigation |
|----------|------------|------------|
| Old frontend, new backend | HIGH | Backend sends both fields (already does) |
| New frontend, old backend | HIGH | Frontend sends both fields (new implementation) |
| Mixed deployment (rolling update) | MEDIUM | Both sides handle both fields |
| Third-party API clients | LOW | Not applicable - internal frontend only |

---

## 6. Testing Strategy

### 6.1 Unit Tests to Add/Modify

#### New Test File: `frontend/src/tests/utils/fileSystemCompat.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractFiles, isValidFilePath, sanitizeFileSystem } from '@/lib/utils/fileSystemCompat';

describe('fileSystemCompat', () => {
  describe('extractFiles', () => {
    it('should return file_system when both fields are present', () => {
      const payload = {
        files: { '/old.txt': 'old content' },
        file_system: { '/new.txt': 'new content' }
      };
      expect(extractFiles(payload)).toEqual({ '/new.txt': 'new content' });
    });

    it('should fall back to files when file_system is missing', () => {
      const payload = { files: { '/test.txt': 'content' } };
      expect(extractFiles(payload)).toEqual({ '/test.txt': 'content' });
    });

    it('should return empty object when both are missing', () => {
      expect(extractFiles({})).toEqual({});
    });

    it('should return empty object for null/undefined input', () => {
      expect(extractFiles(null)).toEqual({});
      expect(extractFiles(undefined)).toEqual({});
    });

    it('should reject arrays disguised as files', () => {
      const payload = { file_system: ['/bad.txt'] };
      expect(extractFiles(payload)).toEqual({});
    });

    it('should handle nested objects in file data', () => {
      const payload = {
        file_system: {
          '/test.txt': { content: ['line1', 'line2'], created_at: '2024-01-01' }
        }
      };
      expect(extractFiles(payload)).toHaveProperty('/test.txt');
    });
  });

  describe('isValidFilePath', () => {
    it('should accept valid absolute paths', () => {
      expect(isValidFilePath('/test.txt')).toBe(true);
      expect(isValidFilePath('/src/main.py')).toBe(true);
      expect(isValidFilePath('/path/to/file-name_123.tsx')).toBe(true);
    });

    it('should reject path traversal attempts', () => {
      expect(isValidFilePath('../etc/passwd')).toBe(false);
      expect(isValidFilePath('/foo/../bar')).toBe(false);
      expect(isValidFilePath('/../test.txt')).toBe(false);
    });

    it('should reject relative paths', () => {
      expect(isValidFilePath('test.txt')).toBe(false);
      expect(isValidFilePath('./test.txt')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidFilePath('/test file.txt')).toBe(false);
      expect(isValidFilePath('/test;rm -rf.txt')).toBe(false);
    });

    it('should reject empty or non-string input', () => {
      expect(isValidFilePath('')).toBe(false);
      expect(isValidFilePath(null as any)).toBe(false);
    });
  });

  describe('sanitizeFileSystem', () => {
    it('should keep valid paths and remove invalid ones', () => {
      const input = {
        '/valid.txt': 'content',
        '../invalid.txt': 'bad',
        '/also/valid.py': 'code'
      };
      const result = sanitizeFileSystem(input);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result).not.toHaveProperty('../invalid.txt');
    });

    it('should log warnings for rejected paths', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      sanitizeFileSystem({ '../bad.txt': 'x' });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
```

#### Modify Existing: `frontend/src/tests/hooks/useFileSystem.test.ts`

Add tests for `file_system` handling:

```typescript
describe('Backend Sync with file_system field', () => {
  describe('fromBackendFormat with file_system', () => {
    it('should handle file_system field from backend', () => {
      const { result } = renderHook(() => useFileSystem());

      const backendData = {
        '/test.txt': 'content from file_system'
      };

      act(() => {
        result.current.fromBackendFormat(backendData);
      });

      expect(result.current.fileSystem.has('/test.txt')).toBe(true);
    });

    it('should mark imported files with __backend_sync__ source', () => {
      const { result } = renderHook(() => useFileSystem());

      act(() => {
        result.current.fromBackendFormat({ '/sync.txt': 'content' });
      });

      expect(result.current.fileSystem.get('/sync.txt')?.source).toBe('__backend_sync__');
    });
  });
});
```

#### Modify Existing: `frontend/src/tests/hooks/useInferenceDictation.test.ts`

Add tests for `file_system` in payload:

```typescript
describe('buildPayload with file_system support', () => {
  it('should include file_system in input when files are present', () => {
    // Test that the payload structure includes file_system
    // This tests the future state after migration
  });

  it('should include both files and file_system during transition', () => {
    // Test dual-write behavior
  });
});
```

#### Modify Existing: `frontend/src/tests/components/FileEditorPanel.test.tsx`

Add integration tests for SSE handling:

```typescript
describe('FileEditorPanel SSE file_system handling', () => {
  it('should process file_system from SSE values event', async () => {
    // Mock SSE response with file_system field
    // Verify files are imported correctly
  });

  it('should handle mixed files and file_system in SSE', async () => {
    // Verify file_system takes precedence
  });
});
```

### 6.2 Integration Test Scenarios

| Scenario | Test Location | Priority |
|----------|---------------|----------|
| Create thread with files, verify `file_system` sent | `tests/integration/stream.test.ts` | HIGH |
| Load existing thread with `files` field | `tests/integration/thread.test.ts` | HIGH |
| Load existing thread with `file_system` field | `tests/integration/thread.test.ts` | HIGH |
| SSE stream delivers `file_system` updates | `tests/integration/sse.test.ts` | HIGH |
| Shared thread loads with either field | `tests/integration/share.test.ts` | MEDIUM |
| Agent create/edit preserves file_system | `tests/integration/agent.test.ts` | MEDIUM |

### 6.3 Edge Case Coverage Matrix

| Edge Case | Unit Test | Integration Test | Manual Test |
|-----------|-----------|------------------|-------------|
| Empty `file_system` object | X | | |
| `file_system` with nested content arrays | X | | |
| Large file (>1MB content) | | X | X |
| Unicode file paths | X | | |
| Files with special characters in name | X | | |
| Concurrent SSE updates | | X | X |
| Network error during file load | | X | |
| Mixed `files`/`file_system` in same response | X | X | |
| Backend returns only `files` (old version) | X | X | |
| Backend returns only `file_system` (new version) | X | X | |
| Thread with 50+ files | | X | X |
| File paths at max length (255 chars) | X | | |

---

## 7. Estimated Complexity

### 7.1 Scope Assessment

| Component | Scope | Complexity |
|-----------|-------|------------|
| New utility file (`fileSystemCompat.ts`) | Small | Low |
| Update `useChat.ts` SSE handling | Medium | Medium |
| Update `useChat.ts` payload building | Small | Low |
| Update `ChatContext.tsx` sync logic | Medium | Medium |
| Update `FileEditorPanel.tsx` | Small | Low |
| Update `SharedThreadPage.tsx` | Small | Low |
| Update `useThread.ts` | Small | Low |
| Update validation schemas | Small | Low |
| Update TypeScript types | Small | Low |
| New unit tests | Medium | Medium |
| Modify existing tests | Medium | Medium |

**Overall Scope:** **Medium**

### 7.2 Risk Level Assessment

- **Technical Risk:** **Medium** - Multiple integration points require careful coordination
- **Data Risk:** **Low** - Dual-write strategy prevents data loss
- **Timeline Risk:** **Low** - Well-defined scope with clear patterns
- **Compatibility Risk:** **Medium** - Must support transition period

**Overall Risk Level:** **Medium**

### 7.3 Suggested Priority Order

1. **Phase 1: Foundation (Day 1)**
   - Create `fileSystemCompat.ts` utility file
   - Update TypeScript types in `stream.ts` and `thread.ts`
   - Update Zod validation schemas
   - Add unit tests for new utilities

2. **Phase 2: Read Path (Day 2)**
   - Update `useChat.ts` SSE handler to use `extractFiles()`
   - Update `ChatContext.tsx` sync logic
   - Update `useThread.ts` to use `extractFiles()`
   - Update `SharedThreadPage.tsx` to use `extractFiles()`

3. **Phase 3: Write Path (Day 3)**
   - Update `useChat.ts` payload building (dual-write)
   - Update `FileEditorPanel.tsx` payload building
   - Update `agent-create-form.tsx` to use `file_system`

4. **Phase 4: Testing & Validation (Day 4-5)**
   - Run full test suite
   - Add integration tests
   - Manual testing of key workflows
   - Document migration status

5. **Phase 5: Cleanup (Post-transition)**
   - Remove dual-write after backend confirmation
   - Add deprecation warnings for `files`-only requests
   - Update documentation

---

## 8. Files to Modify

### Primary Changes

| File | Change Type | Priority |
|------|-------------|----------|
| `frontend/src/lib/utils/fileSystemCompat.ts` | **NEW** | P0 |
| `frontend/src/lib/entities/stream.ts` | Modify | P0 |
| `frontend/src/lib/entities/thread.ts` | Modify | P0 |
| `frontend/src/validations/stream.ts` | Modify | P0 |
| `frontend/src/hooks/useChat.ts` | Modify | P1 |
| `frontend/src/context/ChatContext.tsx` | Modify | P1 |
| `frontend/src/hooks/useThread.ts` | Modify | P1 |
| `frontend/src/pages/share/SharedThreadPage.tsx` | Modify | P1 |
| `frontend/src/components/panels/FileEditorPanel.tsx` | Modify | P2 |
| `frontend/src/components/forms/agents/agent-create-form.tsx` | Modify | P2 |

### Test Files

| File | Change Type |
|------|-------------|
| `frontend/src/tests/utils/fileSystemCompat.test.ts` | **NEW** |
| `frontend/src/tests/hooks/useFileSystem.test.ts` | Modify |
| `frontend/src/tests/hooks/useInferenceDictation.test.ts` | Modify |
| `frontend/src/tests/components/FileEditorPanel.test.tsx` | Modify |

---

## 9. Summary

This proposal recommends a careful, phased migration from `files` to `file_system` using:

1. **Dual-Read**: Accept both field names on all read paths
2. **Dual-Write**: Send both fields during transition period
3. **Centralized Logic**: New utility file for consistent handling
4. **Comprehensive Testing**: Cover all edge cases identified
5. **Structured Logging**: Enable debugging during transition

The implementation prioritizes data integrity and backwards compatibility while setting up a clean path for future deprecation of the legacy `files` field.

---

*Prepared by AGENT_3: GUARDIAN*
*Expertise: Security, Error Handling, Edge Cases, Testing*
