# PROPOSAL_CRAFTSMAN.md

## Feature: Update Frontend to Use `file_system` Instead of `files`

**Author:** AGENT_2: CRAFTSMAN
**Expertise Lens:** Clean Code, Maintainability, SOLID Principles
**Date:** 2026-01-17

---

## 1. Executive Summary

The backend has introduced a new `file_system` field alongside the deprecated `files` field in `LLMInput`. The frontend currently uses `files` throughout, creating naming inconsistency with the backend's intended direction. This proposal recommends a phased migration that updates API payloads to use `file_system` while maintaining internal naming conventions that align with React/TypeScript idioms (`fileSystem`, `filesMap`), ensuring clean separation between API contracts and internal state management.

---

## 2. Architectural Analysis

### 2.1 Current Naming Conventions

The codebase exhibits a **dual-layer naming pattern** that is actually well-designed:

| Layer | Current Name | Convention | Files |
|-------|--------------|------------|-------|
| **API Payload** | `files` | snake_case (Python convention) | `useChat.ts:199,307`, `agent-create-form.tsx:136`, `FileEditorPanel.tsx:257` |
| **Internal State** | `filesMap` | camelCase (React convention) | `useChat.ts:61,115`, `ChatContext.tsx:33`, Throughout components |
| **Hook State** | `fileSystem` | camelCase (React convention) | `useFileSystem.ts`, `ChatContext.tsx:83` |
| **Stream Validation** | `files` | snake_case (matches API) | `validations/stream.ts:30` |
| **Thread Entity** | `files` | snake_case (matches API) | `lib/entities/thread.ts:18` |
| **Agent Type** | `files` | snake_case (matches API) | `agentService.ts:27` |

### 2.2 Naming Inconsistencies Identified

**Problem 1: API Field Naming Mismatch**
```typescript
// Current: Frontend sends 'files'
input: {
    messages: formatedMessages,
    files: filesToSubmit,  // <-- Should be 'file_system'
}

// Backend expects: 'file_system' (preferred) or 'files' (deprecated)
class LLMInput(BaseModel):
    files: Optional[Dict[str, Any]] = Field(default=None)  # TODO: deprecate
    file_system: Optional[Dict[str, Any]] = Field(default=None)  # preferred
```

**Problem 2: Agent Storage Field**
```typescript
// Current: Agent type uses 'files'
export type Agent = {
    files?: Record<string, string>;  // Should align with backend 'file_system'
}

// Backend Assistant model:
class Assistant(BaseModel):
    file_system: Optional[Dict[str, str]] = Field(...)
```

**Problem 3: Thread Data Access**
```typescript
// Current: Reads from threadData.files
if (threadData.files && Object.keys(threadData.files).length > 0) {
    filesMap.set(latestAiMessage.id, threadData.files);
}
```

**Problem 4: Agent Page Sync**
```typescript
// Current: Reads agent.files
if (agent?.files && Object.keys(agent.files).length > 0) {
    fromBackendFormat(agent.files);
}
```

### 2.3 What Is Already Correct

The internal state naming is actually well-designed and should NOT be changed:

- `filesMap: Map<string, any>` - Appropriate camelCase for React state
- `fileSystem: Map<string, FileData>` - Appropriate camelCase for React state
- `setFilesMap`, `setFileSystem` - Consistent with React setter conventions

---

## 3. Implementation Strategy

### 3.1 Design Principles

1. **API Boundary Separation**: Only change API payload field names (`files` -> `file_system`)
2. **Internal Consistency**: Keep internal state naming (`filesMap`, `fileSystem`) unchanged
3. **Backward Compatibility**: Support both field names during transition period
4. **Single Responsibility**: Each file has one clear reason to change

### 3.2 File-by-File Refactoring Plan

#### Phase 1: TypeScript Type Definitions (Foundation)

**File 1: `/frontend/src/lib/services/agentService.ts`**
```typescript
// Lines 27-28: Update Agent type
export type Agent = {
    // ... other fields ...
    file_system?: Record<string, string>;  // Renamed from 'files'
    files?: Record<string, string>;  // Keep for backward compat during transition
    // ... other fields ...
};
```

**File 2: `/frontend/src/lib/entities/thread.ts`**
```typescript
// Line 18: Update SemanticThread type
export interface SemanticThread {
    id: string;
    messages: any[];
    file_system: any[];  // Renamed from 'files'
    files?: any[];  // Keep for backward compat
    score: number;
    updated_at: string | null;
}
```

**File 3: `/frontend/src/lib/entities/stream.ts`**
```typescript
// Lines 47-54: Update ValuesEvent interface
export interface ValuesEvent {
    type: "values";
    data: {
        messages: Array<Record<string, unknown>>;
        file_system?: Record<string, unknown>;  // New preferred field
        files?: Record<string, unknown>;  // Deprecated, keep for compat
        todos?: Record<string, unknown>;
    };
}
```

**File 4: `/frontend/src/validations/stream.ts`**
```typescript
// Lines 28-32: Update ValuesPayloadSchema
export const ValuesPayloadSchema = z.object({
    messages: z.array(z.record(z.unknown())),
    file_system: z.record(z.unknown()).optional(),  // New preferred field
    files: z.record(z.unknown()).optional(),  // Keep for backward compat
    todos: z.record(z.unknown()).optional(),
});
```

#### Phase 2: API Payload Updates (Core Change)

**File 5: `/frontend/src/hooks/useChat.ts`**

Location 1 (Lines 197-201 in `handleSSEUnified`):
```typescript
// Before:
...(Object.keys(filesToSubmit).length > 0 && {
    files: filesToSubmit,
}),

// After:
...(Object.keys(filesToSubmit).length > 0 && {
    file_system: filesToSubmit,
}),
```

Location 2 (Lines 305-308 in `handleSSE`):
```typescript
// Before:
...(Object.keys(filesToSubmit).length > 0 && {
    files: filesToSubmit,
}),

// After:
...(Object.keys(filesToSubmit).length > 0 && {
    file_system: filesToSubmit,
}),
```

Location 3 (Lines 467-479 in `handleMessages`):
```typescript
// Before:
if (valuesData.files && Object.keys(valuesData.files).length > 0) {

// After (handle both for backward compat):
const fileData = valuesData.file_system || valuesData.files;
if (fileData && Object.keys(fileData).length > 0) {
```

**File 6: `/frontend/src/components/forms/agents/agent-create-form.tsx`**

Location (Lines 134-137):
```typescript
// Before:
...(Object.keys(fileSystemData).length > 0 && {
    files: fileSystemData,
}),

// After:
...(Object.keys(fileSystemData).length > 0 && {
    file_system: fileSystemData,
}),
```

**File 7: `/frontend/src/components/panels/FileEditorPanel.tsx`**

Location (Lines 253-262):
```typescript
// Before:
const payload = {
    input: {
        messages: [{ role: "user", content: transcribedText }],
        files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
    },
    // ...
};

// After:
const payload = {
    input: {
        messages: [{ role: "user", content: transcribedText }],
        file_system: Object.keys(filesMap).length > 0 ? filesMap : undefined,
    },
    // ...
};
```

#### Phase 3: Data Reading Updates (Backward Compatible)

**File 8: `/frontend/src/hooks/useThread.ts`**

Location (Lines 102-113):
```typescript
// Before:
if (threadData.files && Object.keys(threadData.files).length > 0) {
    // ...
    filesMap.set(latestAiMessage.id, threadData.files);
}

// After (handle both fields):
const threadFiles = threadData.file_system || threadData.files;
if (threadFiles && Object.keys(threadFiles).length > 0) {
    // ...
    filesMap.set(latestAiMessage.id, threadFiles);
}
```

**File 9: `/frontend/src/pages/agents/edit.tsx`**

Location (Lines 70-74):
```typescript
// Before:
if (agent?.files && Object.keys(agent.files).length > 0) {
    fromBackendFormat(agent.files);
}

// After (handle both fields):
const agentFiles = agent?.file_system || agent?.files;
if (agentFiles && Object.keys(agentFiles).length > 0) {
    fromBackendFormat(agentFiles);
}
```

**File 10: `/frontend/src/pages/agents/thread.tsx`**

Location (Lines 89-93):
```typescript
// Before:
if (agent?.files && Object.keys(agent.files).length > 0) {
    fromBackendFormat(agent.files);
}

// After (handle both fields):
const agentFiles = agent?.file_system || agent?.files;
if (agentFiles && Object.keys(agentFiles).length > 0) {
    fromBackendFormat(agentFiles);
}
```

### 3.3 TypeScript Type Updates Summary

| File | Type | Change |
|------|------|--------|
| `agentService.ts` | `Agent` | Add `file_system`, keep `files` |
| `thread.ts` | `SemanticThread` | Add `file_system`, keep `files` |
| `stream.ts` | `ValuesEvent` | Add `file_system`, keep `files` |
| `stream.ts` | No new types needed | - |

### 3.4 Naming Convention Enforcement

**API Layer (snake_case):**
- `file_system` - For all API payloads and responses
- `files` - Deprecated, read for backward compatibility only

**Internal State Layer (camelCase):**
- `fileSystem` - Hook state (Map of file path to FileData)
- `filesMap` - Legacy chat state (Map of message ID to files)
- `filesToSubmit` - Local variable for submission preparation

---

## 4. Design Decisions

### 4.1 Variable Naming: `filesMap` vs `fileSystemMap`

**Decision:** Keep `filesMap` as-is.

**Rationale:**
- `filesMap` is a legacy bridge between SSE responses and the new `fileSystem` state
- Renaming it would require changes across 30+ locations with no functional benefit
- The name accurately describes its purpose: a Map containing files keyed by message ID
- `fileSystemMap` would be redundant with `fileSystem` (which is already a Map)

### 4.2 API Field Naming: `files` vs `file_system`

**Decision:** Use `file_system` for API payloads, support both for reading.

**Rationale:**
- Aligns with backend's intended direction (marked `files` for deprecation)
- snake_case follows Python/FastAPI conventions for API contracts
- Dual-reading ensures backward compatibility during transition

### 4.3 Internal State Naming: Unchanged

**Decision:** Keep `fileSystem`, `filesMap`, etc. unchanged.

**Rationale:**
- camelCase is idiomatic for React/TypeScript
- These are internal implementation details, not API contracts
- Changing them would create unnecessary churn across many files
- Clear separation between API boundary and internal state

---

## 5. Risk Assessment

### 5.1 Breaking Changes in Component Props

**Risk Level:** LOW

**Analysis:**
- No component props use `files` directly in their interface
- `filesMap` is passed through context, not props
- Changes are isolated to API payload construction

**Mitigation:**
- All changes are to internal implementation, not public interfaces
- Context consumers continue using `filesMap` unchanged

### 5.2 TypeScript Type Compatibility

**Risk Level:** LOW

**Analysis:**
- Adding `file_system` alongside `files` is additive, not breaking
- Optional fields (`?:`) ensure backward compatibility
- Zod schemas support both fields via union

**Mitigation:**
- Gradual rollout: add new field, keep old field
- Type union: `file_system?: T; files?: T;`
- Runtime fallback: `data.file_system || data.files`

### 5.3 Testing Coverage Gaps

**Risk Level:** MEDIUM

**Analysis:**
- Current tests may assert on `files` field specifically
- Mock data may not include `file_system` field

**Identified Test Files Requiring Updates:**
- `/frontend/src/tests/components/FileEditorPanel.test.tsx` (lines 194, 214)
- Any tests mocking stream responses with `files` field

**Mitigation:**
- Update test mocks to use `file_system`
- Add tests for backward compatibility (reading `files` fallback)

### 5.4 Backend API Version Compatibility

**Risk Level:** LOW

**Analysis:**
- Backend accepts both `files` and `file_system` currently
- Migration can proceed without backend changes

**Mitigation:**
- Frontend sends `file_system` (preferred by backend)
- Frontend reads both `file_system` and `files` (handles older responses)

---

## 6. Estimated Complexity

### 6.1 Metrics

| Metric | Value |
|--------|-------|
| **Files to Modify** | 10 |
| **Lines Changed** | ~50 |
| **New Types** | 0 (additive changes to existing) |
| **Breaking Changes** | 0 |
| **Test Updates** | ~5 files |

### 6.2 Overall Assessment

| Aspect | Rating |
|--------|--------|
| **Scope** | Small |
| **Risk Level** | Low |
| **Effort** | 2-4 hours |
| **Confidence** | High |

### 6.3 Suggested Implementation Priority

1. **Type Definitions** (Foundation)
   - `agentService.ts`
   - `thread.ts`
   - `stream.ts`
   - `validations/stream.ts`

2. **API Payload Writers** (Core)
   - `useChat.ts` (both locations)
   - `agent-create-form.tsx`
   - `FileEditorPanel.tsx`

3. **API Response Readers** (Backward Compat)
   - `useChat.ts` (handleMessages)
   - `useThread.ts`
   - `pages/agents/edit.tsx`
   - `pages/agents/thread.tsx`

4. **Tests**
   - Update mock data
   - Add backward compatibility tests

---

## 7. Appendix: Files Not Requiring Changes

These files use `filesMap` internally and do NOT need changes because they operate on internal state, not API contracts:

- `/frontend/src/context/ChatContext.tsx` - Bridges `filesMap` to `fileSystem`
- `/frontend/src/hooks/useFileSystem.ts` - Manages internal file state
- `/frontend/src/components/inputs/ChatInput.tsx` - Reads from context
- `/frontend/src/components/lists/ChatMessages.tsx` - Reads from context
- `/frontend/src/components/nav/ChatNav.tsx` - Reads from context
- `/frontend/src/components/panels/FileTree/*` - Internal state only
- `/frontend/src/pages/chat/ChatPanel.tsx` - Reads from context
- `/frontend/src/pages/Home.tsx` - Reads from context

---

## 8. Summary

This proposal outlines a clean, low-risk migration from `files` to `file_system` in API payloads while maintaining the well-designed internal naming conventions. The key insight is that the frontend correctly uses different conventions for different layers:

- **API Layer**: snake_case (`file_system`) to match Python/FastAPI conventions
- **Internal Layer**: camelCase (`fileSystem`, `filesMap`) to match React/TypeScript conventions

The implementation preserves this separation, changing only the API contract while keeping internal state naming stable.
