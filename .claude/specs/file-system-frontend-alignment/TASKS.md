# Implementation Tasks: Frontend `file_system` Alignment

**Feature:** Update frontend to use `file_system` instead of `files` to align with backend changes
**Branch:** `feat/685-simplify-llm-stream`
**Council Decision:** GO with High Confidence
**Estimated Effort:** 2-3 days

---

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: `frontend/package.json`
  - Acceptance: `npm install` completes without errors

- [ ] Review REVIEW.md council decisions
  - Files: `.claude/specs/file-system-frontend-alignment/REVIEW.md`
  - Acceptance: Understand the unified implementation plan

---

## Phase 1: Type Definitions (Foundation)

### Task 1.1: Update Stream Types
- [ ] Add `file_system` field to `ValuesEvent` interface
  - File: `frontend/src/lib/entities/stream.ts`
  - Lines: ~47-54
  - Change:
    ```typescript
    data: {
        messages: Array<Record<string, unknown>>;
        files?: Record<string, unknown>;        // Legacy - deprecated
        file_system?: Record<string, unknown>;  // NEW - preferred
        todos?: Record<string, unknown>;
    };
    ```
  - Acceptance: TypeScript compiles without errors

### Task 1.2: Update Thread Types
- [ ] Add `file_system` field to `SemanticThread` interface
  - File: `frontend/src/lib/entities/thread.ts`
  - Lines: ~18
  - Change:
    ```typescript
    files?: any;         // Legacy - deprecated
    file_system?: any;   // NEW - preferred
    ```
  - Acceptance: TypeScript compiles without errors

### Task 1.3: Update Agent Types
- [ ] Add `file_system` field to `Agent` type
  - File: `frontend/src/lib/services/agentService.ts`
  - Lines: ~27
  - Change:
    ```typescript
    files?: Record<string, string>;        // Legacy - deprecated
    file_system?: Record<string, string>;  // NEW - preferred
    ```
  - Acceptance: TypeScript compiles without errors

### Task 1.4: Update Validation Schema
- [ ] Add `file_system` field to `ValuesPayloadSchema`
  - File: `frontend/src/validations/stream.ts`
  - Lines: ~28-32
  - Change:
    ```typescript
    export const ValuesPayloadSchema = z.object({
        messages: z.array(z.record(z.unknown())),
        files: z.record(z.unknown()).optional(),
        file_system: z.record(z.unknown()).optional(),  // NEW
        todos: z.record(z.unknown()).optional(),
    });
    ```
  - Acceptance: Schema validates both field names

---

## Phase 2: Core Hooks Update

### Task 2.1: Update useChat SSE Handling
- [ ] Update `handleMessages` to read `file_system` with fallback
  - File: `frontend/src/hooks/useChat.ts`
  - Lines: ~466-483
  - Change:
    ```typescript
    // Before: if (valuesData.files && Object.keys(valuesData.files).length > 0)
    // After:
    const fileData = valuesData.file_system ?? valuesData.files;
    if (fileData && Object.keys(fileData).length > 0) {
        // ... rest of logic using fileData instead of valuesData.files
    }
    ```
  - Acceptance: SSE events with `file_system` are processed correctly

### Task 2.2: Update useChat Payload Construction (handleSSEUnified)
- [ ] Change `files` to `file_system` in payload
  - File: `frontend/src/hooks/useChat.ts`
  - Lines: ~197-201
  - Change:
    ```typescript
    // Before: files: filesToSubmit,
    // After:
    file_system: filesToSubmit,
    ```
  - Acceptance: API requests include `file_system` field

### Task 2.3: Update useChat Payload Construction (handleSSE)
- [ ] Change `files` to `file_system` in payload
  - File: `frontend/src/hooks/useChat.ts`
  - Lines: ~305-308
  - Change:
    ```typescript
    // Before: files: filesToSubmit,
    // After:
    file_system: filesToSubmit,
    ```
  - Acceptance: API requests include `file_system` field

### Task 2.4: Update useThread Loading
- [ ] Update `loadThread` to read `file_system` with fallback
  - File: `frontend/src/hooks/useThread.ts`
  - Lines: ~100-114
  - Change:
    ```typescript
    // Before: if (threadData.files && Object.keys(threadData.files).length > 0)
    // After:
    const threadFiles = threadData.file_system ?? threadData.files;
    if (threadFiles && Object.keys(threadFiles).length > 0) {
        // ... rest of logic using threadFiles
    }
    ```
  - Acceptance: Existing threads with `files` load correctly; new threads with `file_system` load correctly

---

## Phase 3: Component Updates

### Task 3.1: Update FileEditorPanel Payload
- [ ] Change `files` to `file_system` in inference payload
  - File: `frontend/src/components/panels/FileEditorPanel.tsx`
  - Lines: ~257-262
  - Change:
    ```typescript
    // Before: files: Object.keys(filesMap).length > 0 ? filesMap : undefined,
    // After:
    file_system: Object.keys(filesMap).length > 0 ? filesMap : undefined,
    ```
  - Acceptance: Inference dictation sends `file_system` in payload

### Task 3.2: Update FileEditorPanel SSE Reading (if applicable)
- [ ] Verify/update SSE handling to read `file_system`
  - File: `frontend/src/components/panels/FileEditorPanel.tsx`
  - Lines: ~290-292
  - Change:
    ```typescript
    // Before: if (streamType === "values" && payload?.files)
    // After:
    const fileData = payload?.file_system ?? payload?.files;
    if (streamType === "values" && fileData) {
        Object.entries(fileData).forEach(...)
    }
    ```
  - Acceptance: SSE values events update files correctly

### Task 3.3: Update Agent Create Form
- [ ] Change `files` to `file_system` in submission
  - File: `frontend/src/components/forms/agents/agent-create-form.tsx`
  - Lines: ~134-137
  - Change:
    ```typescript
    // Before: files: fileSystemData,
    // After:
    file_system: fileSystemData,
    ```
  - Acceptance: Agent creation sends `file_system` field

---

## Phase 4: Agent Pages Update

### Task 4.1: Update Agent Edit Page
- [ ] Read `file_system` with fallback to `files`
  - File: `frontend/src/pages/agents/edit.tsx`
  - Lines: ~70-75
  - Change:
    ```typescript
    // Before: if (agent?.files && Object.keys(agent.files).length > 0)
    // After:
    const agentFiles = agent?.file_system ?? agent?.files;
    if (agentFiles && Object.keys(agentFiles).length > 0) {
        fromBackendFormat(agentFiles);
    }
    ```
  - Acceptance: Agents with `files` or `file_system` load correctly

### Task 4.2: Update Agent Thread Page
- [ ] Read `file_system` with fallback to `files`
  - File: `frontend/src/pages/agents/thread.tsx`
  - Lines: ~89-93
  - Change:
    ```typescript
    // Before: if (agent?.files && Object.keys(agent.files).length > 0)
    // After:
    const agentFiles = agent?.file_system ?? agent?.files;
    if (agentFiles && Object.keys(agentFiles).length > 0) {
        fromBackendFormat(agentFiles);
    }
    ```
  - Acceptance: Agent threads load files correctly

### Task 4.3: Update SharedThreadPage (if applicable)
- [ ] Read `file_system` with fallback to `files`
  - File: `frontend/src/pages/share/SharedThreadPage.tsx`
  - Lines: ~50-58
  - Change:
    ```typescript
    // Before: if (data.thread.files && data.config.show_files)
    // After:
    const threadFiles = data.thread.file_system ?? data.thread.files;
    if (threadFiles && data.config.show_files) {
        // ... use threadFiles
    }
    ```
  - Acceptance: Shared threads display files correctly

---

## Testing

### Task 5.1: Run Frontend Test Suite
- [ ] Execute all frontend tests
  - Command: `cd frontend && npm run test`
  - Acceptance: All tests pass

### Task 5.2: Update Test Mocks (if needed)
- [ ] Update any tests that mock API responses with `files`
  - Files: `frontend/src/tests/components/FileEditorPanel.test.tsx`
  - Change: Add `file_system` to mock data or update assertions
  - Acceptance: Tests cover both field names

### Task 5.3: Add Backwards Compatibility Test
- [ ] Add test verifying `files` fallback still works
  - File: New test or update existing
  - Acceptance: Test passes with old `files`-only format

---

## Documentation

- [ ] Update any inline code comments for clarity
  - Acceptance: Comments explain the fallback pattern

---

## Verification

- [ ] Manual test: Create thread with files
  - Steps:
    1. Open chat
    2. Create/edit files in FileEditorPanel
    3. Send message
    4. Verify files appear in response
  - Acceptance: Files round-trip correctly

- [ ] Manual test: Load existing thread
  - Steps:
    1. Navigate to existing thread with files
    2. Verify files load in FileEditorPanel
  - Acceptance: Old threads still work

- [ ] Manual test: Agent create/edit
  - Steps:
    1. Create new agent with file system
    2. Edit existing agent
    3. Verify files persist
  - Acceptance: Agent file system works

- [ ] All tests passing
  - Command: `cd frontend && npm run test`
  - Acceptance: 0 failures

- [ ] TypeScript compiles
  - Command: `cd frontend && npm run build`
  - Acceptance: No type errors

- [ ] Self-review against REVIEW.md
  - Acceptance: All council recommendations implemented

- [ ] Ready for PR
  - Acceptance: All checkboxes complete

---

## Completion Signature

- **Total Tasks:** 21 core tasks + 7 verification
- **Dependencies:** Backend `file_system` support (already implemented on branch)
- **Files to Modify:**
  - `frontend/src/lib/entities/stream.ts`
  - `frontend/src/lib/entities/thread.ts`
  - `frontend/src/lib/services/agentService.ts`
  - `frontend/src/validations/stream.ts`
  - `frontend/src/hooks/useChat.ts`
  - `frontend/src/hooks/useThread.ts`
  - `frontend/src/components/panels/FileEditorPanel.tsx`
  - `frontend/src/components/forms/agents/agent-create-form.tsx`
  - `frontend/src/pages/agents/edit.tsx`
  - `frontend/src/pages/agents/thread.tsx`
  - `frontend/src/pages/share/SharedThreadPage.tsx` (if applicable)

---

## Progress Log

*(To be updated during implementation)*

---

## Notes

- Backend already supports `file_system` field with fallback to `files`
- Use nullish coalescing (`??`) for fallback, not logical OR (`||`)
- Internal state naming (`filesMap`, `fileSystem`) does NOT change
- Only API boundary naming changes from `files` to `file_system`
