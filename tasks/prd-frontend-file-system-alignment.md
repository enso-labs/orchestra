---
task: Frontend file_system alignment
test_command: "cd frontend && npm run test"
---

# PRD: Frontend `file_system` Alignment

## Introduction

Update the frontend to use `file_system` instead of `files` when communicating with the backend API. The backend has introduced a new `file_system` field alongside the deprecated `files` field in the `LLMInput` schema. This change aligns the frontend with the backend's preferred naming convention while maintaining backwards compatibility with existing threads and data.

**Branch:** `feat/685-simplify-llm-stream`
**Backend Status:** Already implemented - `file_system` field is supported with fallback to `files`

## Goals

- Update all API payload construction to use `file_system` instead of `files`
- Update all API response reading to prefer `file_system` with fallback to `files`
- Create a centralized utility function for consistent file extraction
- Maintain backwards compatibility with existing threads stored with `files` field
- Add comprehensive test coverage for the migration
- Ensure TypeScript types and Zod schemas support both field names

## User Stories

### US-001: Update TypeScript Type Definitions
**Description:** As a developer, I need TypeScript types to include the `file_system` field so that the codebase has proper type safety during the migration.

**Acceptance Criteria:**
- [ ] Add `file_system?: Record<string, unknown>` to `ValuesEvent` interface in `frontend/src/lib/entities/stream.ts`
- [ ] Add `file_system?: any` to `SemanticThread` interface in `frontend/src/lib/entities/thread.ts`
- [ ] Add `file_system?: Record<string, string>` to `Agent` type in `frontend/src/lib/services/agentService.ts`
- [ ] Keep existing `files` field marked as deprecated via comment
- [ ] TypeScript compiles without errors (`npm run build`)

### US-002: Update Zod Validation Schema
**Description:** As a developer, I need the Zod validation schema to accept `file_system` so that SSE stream events are validated correctly.

**Acceptance Criteria:**
- [ ] Add `file_system: z.record(z.unknown()).optional()` to `ValuesPayloadSchema` in `frontend/src/validations/stream.ts`
- [ ] Keep existing `files` field for backwards compatibility
- [ ] Schema validates payloads with either `files` or `file_system` or both
- [ ] TypeScript compiles without errors

### US-003: Create File System Compatibility Utility
**Description:** As a developer, I need a centralized utility function to extract files from payloads so that the fallback logic is consistent across the codebase.

**Acceptance Criteria:**
- [ ] Create `frontend/src/lib/utils/fileSystemCompat.ts` with `extractFiles()` function
- [ ] Function signature: `extractFiles(payload: Record<string, unknown> | null | undefined): Record<string, unknown>`
- [ ] Function returns `file_system` if present, falls back to `files`, returns `{}` if neither
- [ ] Add JSDoc comments explaining the priority logic
- [ ] TypeScript compiles without errors

### US-004: Add Unit Tests for Compatibility Utility
**Description:** As a developer, I need comprehensive tests for the `extractFiles()` utility to ensure edge cases are handled correctly.

**Acceptance Criteria:**
- [ ] Create `frontend/src/tests/utils/fileSystemCompat.test.ts`
- [ ] Test: returns `file_system` when both fields present
- [ ] Test: falls back to `files` when `file_system` missing
- [ ] Test: returns empty object when both missing
- [ ] Test: handles null/undefined input gracefully
- [ ] Test: rejects arrays (non-object values)
- [ ] All tests pass (`npm run test`)

### US-005: Update useChat SSE Handling
**Description:** As a user, I want files from SSE stream events to be processed correctly regardless of whether the backend sends `files` or `file_system`.

**Acceptance Criteria:**
- [ ] Update `handleMessages` in `frontend/src/hooks/useChat.ts` (~line 466-483)
- [ ] Use `extractFiles()` utility or inline `valuesData.file_system ?? valuesData.files`
- [ ] Files are correctly associated with AI messages in `filesMap`
- [ ] Existing functionality preserved for old `files`-only responses
- [ ] TypeScript compiles without errors

### US-006: Update useChat Payload Construction
**Description:** As a user, I want my file submissions to use the `file_system` field so that the backend processes them with the preferred field name.

**Acceptance Criteria:**
- [ ] Update `handleSSEUnified` in `frontend/src/hooks/useChat.ts` (~line 197-201)
- [ ] Change `files: filesToSubmit` to `file_system: filesToSubmit`
- [ ] Update `handleSSE` in `frontend/src/hooks/useChat.ts` (~line 305-308)
- [ ] Change `files: filesToSubmit` to `file_system: filesToSubmit`
- [ ] API requests include `file_system` field (verify in network tab)
- [ ] TypeScript compiles without errors

### US-007: Update useThread Loading
**Description:** As a user, I want to load existing threads correctly whether they were saved with `files` or `file_system`.

**Acceptance Criteria:**
- [ ] Update `loadThread` in `frontend/src/hooks/useThread.ts` (~line 100-114)
- [ ] Use `extractFiles()` utility or inline `threadData.file_system ?? threadData.files`
- [ ] Existing threads with `files` field load correctly
- [ ] New threads with `file_system` field load correctly
- [ ] TypeScript compiles without errors

### US-008: Update FileEditorPanel
**Description:** As a user, I want the FileEditorPanel to send files using `file_system` and receive updates from either field format.

**Acceptance Criteria:**
- [ ] Update payload construction in `frontend/src/components/panels/FileEditorPanel.tsx` (~line 257-262)
- [ ] Change `files:` to `file_system:` in inference payload
- [ ] Update SSE handling (~line 290-292) to use `payload?.file_system ?? payload?.files`
- [ ] Inference dictation works with files
- [ ] TypeScript compiles without errors
- [ ] Verify in browser using dev-browser skill: FileEditorPanel displays and updates files correctly

### US-009: Update Agent Create Form
**Description:** As a user, I want to create agents with file systems using the correct `file_system` field.

**Acceptance Criteria:**
- [ ] Update `frontend/src/components/forms/agents/agent-create-form.tsx` (~line 134-137)
- [ ] Change `files: fileSystemData` to `file_system: fileSystemData`
- [ ] Agent creation API request includes `file_system` field
- [ ] TypeScript compiles without errors
- [ ] Verify in browser using dev-browser skill: Agent creation form works with files

### US-010: Update Agent Edit Page
**Description:** As a user, I want to edit agents and have their file systems load correctly from either field format.

**Acceptance Criteria:**
- [ ] Update `frontend/src/pages/agents/edit.tsx` (~line 70-75)
- [ ] Use `agent?.file_system ?? agent?.files` for reading
- [ ] Agents saved with `files` field load correctly
- [ ] Agents saved with `file_system` field load correctly
- [ ] TypeScript compiles without errors
- [ ] Verify in browser using dev-browser skill: Agent edit page loads and displays files

### US-011: Update Agent Thread Page
**Description:** As a user, I want agent thread pages to load file systems correctly from either field format.

**Acceptance Criteria:**
- [ ] Update `frontend/src/pages/agents/thread.tsx` (~line 89-93)
- [ ] Use `agent?.file_system ?? agent?.files` for reading
- [ ] Agent threads with files load correctly
- [ ] TypeScript compiles without errors
- [ ] Verify in browser using dev-browser skill: Agent thread page loads files

### US-012: Update SharedThreadPage
**Description:** As a user, I want shared thread links to display files correctly regardless of field format.

**Acceptance Criteria:**
- [ ] Update `frontend/src/pages/share/SharedThreadPage.tsx` (~line 50-58)
- [ ] Use `data.thread.file_system ?? data.thread.files` for reading
- [ ] Shared threads with `files` field display correctly
- [ ] Shared threads with `file_system` field display correctly
- [ ] TypeScript compiles without errors

### US-013: Add Backwards Compatibility Tests
**Description:** As a developer, I need tests to verify the fallback pattern works correctly for legacy data.

**Acceptance Criteria:**
- [ ] Add tests to `frontend/src/tests/utils/fileSystemCompat.test.ts` for edge cases:
  - Empty `file_system` with populated `files`
  - Both fields populated (verify `file_system` takes priority)
  - Nested content arrays in file data
  - Large file content handling
- [ ] Update `frontend/src/tests/components/FileEditorPanel.test.tsx` mocks to use `file_system`
- [ ] Add test verifying SSE with `files`-only format still works
- [ ] All tests pass (`npm run test`)

### US-014: Run Full Test Suite and Verify
**Description:** As a developer, I need to verify all changes work together and don't break existing functionality.

**Acceptance Criteria:**
- [ ] Frontend tests pass: `cd frontend && npm run test`
- [ ] Backend tests pass: `cd backend && make test`
- [ ] TypeScript build succeeds: `cd frontend && npm run build`
- [ ] Manual test: Create thread with files, verify round-trip
- [ ] Manual test: Load existing thread with files
- [ ] Manual test: Agent create/edit with file system

## Functional Requirements

- **FR-1:** The frontend MUST send `file_system` (not `files`) in all API request payloads
- **FR-2:** The frontend MUST read `file_system` first, falling back to `files` if not present
- **FR-3:** TypeScript types MUST include both `files` and `file_system` fields during transition
- **FR-4:** Zod validation schemas MUST accept both `files` and `file_system` fields
- **FR-5:** The `extractFiles()` utility MUST return `file_system` when both fields are present
- **FR-6:** The `extractFiles()` utility MUST return an empty object for null/undefined input
- **FR-7:** Internal state naming (`filesMap`, `fileSystem`) MUST NOT change
- **FR-8:** All file-related UI components MUST continue to function with either field format

## Non-Goals

- Renaming internal state variables (`filesMap` stays as `filesMap`)
- Changing the `useFileSystem` hook implementation
- Modifying backend code (already done on branch)
- Removing the `files` field entirely (deprecation only, keep for backwards compat)
- Adding new file system features
- Changing the SSE wire format

## Technical Considerations

### File Priority Pattern
Use nullish coalescing (`??`) not logical OR (`||`):
```typescript
// Correct - handles empty objects properly
const fileData = payload.file_system ?? payload.files;

// Incorrect - empty object {} is truthy, won't fallback
const fileData = payload.file_system || payload.files;
```

### Files to Modify
| File | Change Type |
|------|-------------|
| `frontend/src/lib/entities/stream.ts` | Add type |
| `frontend/src/lib/entities/thread.ts` | Add type |
| `frontend/src/lib/services/agentService.ts` | Add type |
| `frontend/src/validations/stream.ts` | Add schema field |
| `frontend/src/lib/utils/fileSystemCompat.ts` | **NEW** |
| `frontend/src/hooks/useChat.ts` | Update logic |
| `frontend/src/hooks/useThread.ts` | Update logic |
| `frontend/src/components/panels/FileEditorPanel.tsx` | Update logic |
| `frontend/src/components/forms/agents/agent-create-form.tsx` | Update field |
| `frontend/src/pages/agents/edit.tsx` | Update reading |
| `frontend/src/pages/agents/thread.tsx` | Update reading |
| `frontend/src/pages/share/SharedThreadPage.tsx` | Update reading |
| `frontend/src/tests/utils/fileSystemCompat.test.ts` | **NEW** |

### Backend Reference
The backend prioritizes `file_system` over `files`:
```python
# backend/src/utils/stream.py:60
files_map = metadata.get("files", {}) or input.file_system or {}
```

## Success Metrics

- All frontend tests pass
- All backend tests pass
- TypeScript compiles without errors
- Files round-trip correctly through chat (create, send, receive)
- Existing threads with `files` field load correctly
- New threads use `file_system` field in API requests
- No console errors related to file handling

## Open Questions

- ~~Should we create a utility file for the extraction logic?~~ **Resolved: Yes, create `fileSystemCompat.ts`**
- ~~What level of backwards compatibility testing?~~ **Resolved: Comprehensive with dedicated test file**
- When can the `files` field be fully removed from types? (Suggest: after 2-4 weeks of stable operation)

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes (`make test`)
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`