# Architectural Proposal: Frontend `file_system` Alignment

## 1. Executive Summary

This proposal outlines a migration strategy to update the frontend to use `file_system` instead of `files` when communicating with the backend, aligning with the backend's new naming convention. The approach prioritizes backwards compatibility during the transition period, maintains internal `filesMap` state naming for minimal disruption, and updates only the API boundary layer to use the new `file_system` field.

**Key Recommendation**: Adopt a phased "API boundary translation" approach where internal frontend state continues using `filesMap` but all API submissions and SSE event handling translate to/from `file_system` at the boundary.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Backend State (Already Implemented)

The backend has introduced dual-field support in `LLMInput`:

```python
# backend/src/schemas/entities/llm.py
class LLMInput(BaseModel):
    messages: List[ChatMessage]
    files: Optional[Dict[str, Any]] = Field(default=None)  ## TODO: Deprecate
    file_system: Optional[Dict[str, Any]] = Field(default=None)  # New field
```

The backend prioritizes `file_system` with fallback to `files`:
```python
# backend/src/utils/stream.py:60
files_map = metadata.get("files", {}) or input.file_system or {}
```

The `Assistant` model uses `file_system`:
```python
# backend/src/schemas/entities/llm.py
class Assistant(BaseModel):
    file_system: Optional[Dict[str, str]] = Field(default_factory=dict)
```

#### Frontend State (Current)

The frontend currently uses `files` in multiple places:

| Location | Current Usage | Purpose |
|----------|--------------|---------|
| `useChat.ts` L198-199 | `files: filesToSubmit` | API submission payload |
| `useChat.ts` L306-307 | `files: filesToSubmit` | API submission payload |
| `useChat.ts` L467-479 | `valuesData.files` | SSE stream handling |
| `useThread.ts` L102-112 | `threadData.files` | Thread loading |
| `validations/stream.ts` L30 | `files: z.record(...)` | Stream validation |
| `entities/stream.ts` L51 | `files?: Record<...>` | Type definitions |
| `entities/thread.ts` L18 | `files: any[]` | Type definitions |
| `agentService.ts` L27 | `files?: Record<...>` | Agent type |
| `shareService.ts` L14,24,31 | `show_files`, `files` | Share types |
| `agent-create-form.tsx` L134-137 | `files: fileSystemData` | Agent creation |
| `pages/agents/edit.tsx` L72 | `agent?.files` | Agent file sync |
| `pages/agents/thread.tsx` L91 | `agent?.files` | Agent file sync |

### 2.2 Data Flow Analysis

```
User Action (create/edit file)
        |
        v
+-------------------+
| useFileSystem     | <-- Manages fileSystem Map internally
| (fileSystem hook) |
+-------------------+
        |
        v (sync via ChatContext)
+-------------------+
| filesMap          | <-- Legacy nested structure (messageId -> files)
| (useChat state)   |
+-------------------+
        |
        v (on submit)
+-------------------+
| API Payload       | <-- Currently: { input: { files: {...} } }
| (handleSSE*)      |     Target: { input: { file_system: {...} } }
+-------------------+
        |
        v
+-------------------+
| Backend           | <-- Reads file_system OR files (fallback)
+-------------------+
        |
        v (SSE response)
+-------------------+
| values event      | <-- Currently: { files: {...} }
| (SSE stream)      |     Future: { file_system: {...} }
+-------------------+
        |
        v
+-------------------+
| handleMessages    | <-- Processes valuesData.files
| (useChat)         |
+-------------------+
```

### 2.3 Integration Points

1. **API Submission Layer** (`useChat.ts`):
   - `handleSSEUnified()` - builds payload with `files` in input
   - `handleSSE()` - builds payload with `files` in input

2. **SSE Event Handling** (`useChat.ts`):
   - `handleMessages()` - reads `valuesData.files` from values events

3. **Thread Loading** (`useThread.ts`):
   - `loadThread()` - reads `threadData.files` from checkpoint metadata

4. **Type Definitions**:
   - `stream.ts` - ValuesEvent type
   - `thread.ts` - SemanticThread type
   - `agentService.ts` - Agent type

5. **Validation Schemas** (`validations/stream.ts`):
   - `ValuesPayloadSchema` - validates `files` field

6. **Agent Pages**:
   - `edit.tsx` and `thread.tsx` - read `agent.files` for file sync

---

## 3. Implementation Strategy

### 3.1 Approach: API Boundary Translation

**Principle**: Keep internal state naming (`filesMap`) unchanged, translate only at API boundaries.

This approach minimizes risk by:
- Avoiding widespread refactoring of internal state
- Keeping existing tests valid
- Providing clear boundary for future deprecation

### 3.2 Step-by-Step Implementation Plan

#### Phase 1: Update Type Definitions (Low Risk)

**Files to modify:**

1. **`/frontend/src/lib/entities/stream.ts`**
   - Add `file_system` to `ValuesEvent.data`
   - Keep `files` as optional for backwards compatibility

2. **`/frontend/src/lib/entities/thread.ts`**
   - Update `SemanticThread` interface

3. **`/frontend/src/lib/services/agentService.ts`**
   - Add `file_system` to `Agent` type
   - Keep `files` as deprecated alias

4. **`/frontend/src/lib/services/shareService.ts`**
   - Add `file_system` variants to types

#### Phase 2: Update Validation Schemas (Low Risk)

**Files to modify:**

1. **`/frontend/src/validations/stream.ts`**
   - Add `file_system` to `ValuesPayloadSchema`
   - Make both `files` and `file_system` optional

```typescript
export const ValuesPayloadSchema = z.object({
    messages: z.array(z.record(z.unknown())),
    files: z.record(z.unknown()).optional(),
    file_system: z.record(z.unknown()).optional(), // Add new field
    todos: z.record(z.unknown()).optional(),
});
```

#### Phase 3: Update API Submission (Medium Risk)

**Files to modify:**

1. **`/frontend/src/hooks/useChat.ts`**
   - Change `files:` to `file_system:` in payload construction (2 locations)

```typescript
// Line ~198-199 in handleSSEUnified
...(Object.keys(filesToSubmit).length > 0 && {
    file_system: filesToSubmit,  // Changed from 'files'
}),

// Line ~306-307 in handleSSE
...(Object.keys(filesToSubmit).length > 0 && {
    file_system: filesToSubmit,  // Changed from 'files'
}),
```

#### Phase 4: Update SSE Event Handling (Medium Risk)

**Files to modify:**

1. **`/frontend/src/hooks/useChat.ts`**
   - Update `handleMessages()` to read `file_system` with `files` fallback

```typescript
// Line ~466-483
if (streamMode === "values") {
    const valuesData = payload[1];

    // Read file_system with fallback to files for backwards compatibility
    const fileData = valuesData.file_system ?? valuesData.files;

    if (fileData && Object.keys(fileData).length > 0) {
        const latestAiMessage = history
            .slice()
            .reverse()
            .find((msg: any) =>
                ["ai", "assistant", "tool"].includes(msg.type ?? msg.role),
            );

        if (latestAiMessage) {
            setFilesMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(latestAiMessage.id, fileData);
                return newMap;
            });
        }
    }
    // ... rest of handler
}
```

#### Phase 5: Update Thread Loading (Medium Risk)

**Files to modify:**

1. **`/frontend/src/hooks/useThread.ts`**
   - Update `loadThread()` to read `file_system` with fallback

```typescript
// Line ~100-114
// Build filesMap - check file_system first, then files for backwards compat
const filesMap = new Map<string, any>();
const fileData = threadData.file_system ?? threadData.files;
if (fileData && Object.keys(fileData).length > 0) {
    const formattedMsgs = formatMessages(checkpointsData[0].values.messages);
    const latestAiMessage = formattedMsgs
        .slice()
        .reverse()
        .find((msg: any) => ["ai", "assistant"].includes(msg.role));

    if (latestAiMessage) {
        filesMap.set(latestAiMessage.id, fileData);
    }
}
```

#### Phase 6: Update Agent Pages (Low Risk)

**Files to modify:**

1. **`/frontend/src/pages/agents/edit.tsx`**
   - Update to read `agent.file_system` with `agent.files` fallback

```typescript
// Line ~70-75
useEffect(() => {
    const fileData = agent?.file_system ?? agent?.files;
    if (fileData && Object.keys(fileData).length > 0) {
        fromBackendFormat(fileData);
    }
}, [agent?.id, fromBackendFormat]);
```

2. **`/frontend/src/pages/agents/thread.tsx`**
   - Same update as above

#### Phase 7: Update Agent Form (Low Risk)

**Files to modify:**

1. **`/frontend/src/components/forms/agents/agent-create-form.tsx`**
   - Update submission to use `file_system`

```typescript
// Line ~134-137
const configData: Agent = {
    // ...
    ...(Object.keys(fileSystemData).length > 0 && {
        file_system: fileSystemData,  // Changed from 'files'
    }),
};
```

### 3.3 Files Summary

| File | Change Type | Risk Level |
|------|-------------|------------|
| `frontend/src/lib/entities/stream.ts` | Add type | Low |
| `frontend/src/lib/entities/thread.ts` | Add type | Low |
| `frontend/src/lib/services/agentService.ts` | Add type | Low |
| `frontend/src/lib/services/shareService.ts` | Add type | Low |
| `frontend/src/validations/stream.ts` | Add field | Low |
| `frontend/src/hooks/useChat.ts` | Update logic | Medium |
| `frontend/src/hooks/useThread.ts` | Update logic | Medium |
| `frontend/src/pages/agents/edit.tsx` | Update usage | Low |
| `frontend/src/pages/agents/thread.tsx` | Update usage | Low |
| `frontend/src/components/forms/agents/agent-create-form.tsx` | Update field | Low |

---

## 4. Design Decisions

### 4.1 Decision: Keep Internal `filesMap` Naming

**Trade-offs:**
- (+) Minimal refactoring of internal state management
- (+) Existing tests remain valid
- (+) Clear separation between internal state and API contract
- (-) Slight cognitive overhead of different names internally vs externally

**Rationale**: The internal naming `filesMap` is used extensively in useChat, ChatContext, and component code. Renaming would touch 50+ locations and introduce unnecessary risk. The API boundary translation approach cleanly separates concerns.

### 4.2 Decision: Backwards-Compatible Fallback Pattern

**Trade-offs:**
- (+) Graceful handling of older backend responses
- (+) Works during transition period
- (+) No coordination required between frontend/backend deploys
- (-) Slightly more complex reading logic

**Rationale**: The pattern `valuesData.file_system ?? valuesData.files` ensures the frontend works with both old and new backend responses during the transition.

### 4.3 Decision: No Internal State Renaming

**Alternatives considered:**
1. **Full rename** - Change `filesMap` to `fileSystemMap` everywhere
   - Rejected: High risk, many touch points, test updates required
2. **Gradual internal rename** - Add alias, deprecate old name
   - Rejected: Complexity without clear benefit
3. **API boundary translation** (chosen)
   - Clean separation, minimal risk, clear upgrade path

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backend not sending `file_system` yet | Medium | Low | Fallback pattern handles this |
| Type mismatches | Low | Medium | Update types before logic |
| Test failures | Medium | Low | Tests use internal state, unchanged |
| SSE parsing errors | Low | High | Validation schema update first |
| Thread loading breaks | Medium | Medium | Fallback pattern + testing |

### 5.2 Edge Cases

1. **Empty file_system with populated files**: Fallback handles
2. **Both fields populated**: `file_system` takes precedence
3. **Neither field present**: Treated as empty (existing behavior)
4. **Partial backend deployment**: Fallback handles during transition
5. **Shared thread links**: `show_files` flag preserved, data field updated

### 5.3 Testing Considerations

**Required Tests:**

1. **Unit Tests** (hooks):
   - `useChat` payload construction uses `file_system`
   - `handleMessages` reads `file_system` with fallback
   - `useThread.loadThread` reads `file_system` with fallback

2. **Integration Tests**:
   - Full stream cycle with `file_system` in values event
   - Thread reload with `file_system` in checkpoint metadata
   - Agent creation/update with `file_system`

3. **Backwards Compatibility Tests**:
   - Verify old `files` field still works (fallback)
   - Verify mixed scenarios (old backend, new frontend)

---

## 6. Estimated Complexity

| Dimension | Assessment |
|-----------|------------|
| **Scope** | Medium - 10 files, clear boundaries |
| **Risk Level** | Low-Medium - Backwards-compatible approach |
| **Effort** | 1-2 days for implementation + testing |

### 6.1 Implementation Priority Order

1. **P0 (Critical Path)**: Type definitions and validation schemas
2. **P1 (Core Logic)**: `useChat.ts` submission and SSE handling
3. **P2 (Data Loading)**: `useThread.ts` thread loading
4. **P3 (Agent Forms)**: Agent create/edit form and pages

### 6.2 Rollout Strategy

1. **Deploy Phase 1-2** (Types/Validation) - No behavior change
2. **Deploy Phase 3-5** (Core logic) - Frontend starts sending `file_system`
3. **Verify** backend receives `file_system` correctly
4. **Deploy Phase 6-7** (Agent pages) - Complete alignment
5. **Backend cleanup** - Can now remove `files` field after transition period

---

## 7. Appendix: Code Patterns

### 7.1 Fallback Pattern

```typescript
// Standard pattern for reading with fallback
const fileData = data.file_system ?? data.files;
```

### 7.2 Submission Pattern

```typescript
// Standard pattern for API submission
...(Object.keys(filesData).length > 0 && {
    file_system: filesData,
}),
```

### 7.3 Type Definition Pattern

```typescript
// Interface with both fields for transition period
interface DataWithFiles {
    files?: Record<string, unknown>;      // Deprecated
    file_system?: Record<string, unknown>; // Preferred
}
```

---

**Document Status**: Ready for Review
**Author**: AGENT_1 (ARCHITECT)
**Created**: 2026-01-17
**Target Branch**: `feat/685-simplify-llm-stream`
