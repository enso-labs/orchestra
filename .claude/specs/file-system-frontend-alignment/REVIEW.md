# Council Review: Frontend `file_system` Alignment

**Feature Under Review:** Update frontend to use `file_system` instead of `files` to align with backend changes

**Date:** 2026-01-17
**Branch:** `feat/685-simplify-llm-stream`

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Core Approach** | API boundary translation | Phased migration | Dual-read/write with utilities | **Hybrid: API boundary translation with centralized utilities** |
| **Internal State Naming** | Keep `filesMap` unchanged | Keep `filesMap` unchanged | Keep `filesMap` unchanged | **Keep unchanged - unanimous agreement** |
| **Read Strategy** | `file_system ?? files` fallback | `file_system \|\| files` fallback | Centralized `extractFiles()` utility | **Centralized utility with priority-based extraction** |
| **Write Strategy** | Send `file_system` only | Send `file_system` only | Dual-write both fields | **Dual-write during transition, single field after** |
| **New Files** | None | None | `fileSystemCompat.ts` utility | **Add utility file for consistency** |
| **Risk Assessment** | Low-Medium | Low | Medium | **Medium (due to many integration points)** |
| **Scope** | Medium (10 files) | Small (~50 lines) | Medium (10+ files, 15+ tests) | **Medium** |
| **Estimated Effort** | 1-2 days | 2-4 hours | 4-5 days | **2-3 days (implementation + testing)** |

---

## 2. Consensus Points

All three proposals agree on the following:

### 2.1 Keep Internal State Naming Unchanged
- `filesMap` stays as `filesMap`
- `fileSystem` hook state stays as `fileSystem`
- Only API boundary changes to `file_system`

**Rationale:** The internal camelCase naming follows React/TypeScript conventions and changing it would create unnecessary churn across 30+ files.

### 2.2 Priority-Based Reading
All proposals agree on reading `file_system` first, falling back to `files`:

```typescript
const fileData = payload.file_system ?? payload.files;
```

This matches backend behavior:
```python
files_map = metadata.get("files", {}) or input.file_system or {}
```

### 2.3 Files Requiring Updates
All proposals identify the same core files:
- `useChat.ts` - SSE handling and payload construction
- `useThread.ts` - Thread loading
- `validations/stream.ts` - Zod schema
- `lib/entities/stream.ts` - TypeScript types
- Agent pages (`edit.tsx`, `thread.tsx`)

### 2.4 Type Definition Updates
All proposals agree types should support both fields during transition:
```typescript
interface DataWithFiles {
    files?: Record<string, unknown>;      // Deprecated
    file_system?: Record<string, unknown>; // Preferred
}
```

---

## 3. Divergence Analysis

### 3.1 Utility File Creation

| Approach | ARCHITECT | CRAFTSMAN | GUARDIAN |
|----------|-----------|-----------|----------|
| New utility file | No | No | Yes (`fileSystemCompat.ts`) |

**Council Decision:** **Create the utility file**

**Reasoning:**
- Centralizes the `file_system ?? files` logic
- Enables consistent path validation
- Provides structured logging for debugging
- GUARDIAN's approach is more maintainable long-term

### 3.2 Write Strategy

| Approach | ARCHITECT | CRAFTSMAN | GUARDIAN |
|----------|-----------|-----------|----------|
| Outbound payload | `file_system` only | `file_system` only | Both `files` AND `file_system` |

**Council Decision:** **Single-write `file_system` only**

**Reasoning:**
- Backend already accepts `file_system` as preferred field
- Backend code shows: `files_map = metadata.get("files", {}) or input.file_system or {}`
- No evidence of old backend versions still in production
- Dual-write adds complexity without clear benefit since this is on the same branch

### 3.3 Test Coverage Depth

| Approach | ARCHITECT | CRAFTSMAN | GUARDIAN |
|----------|-----------|-----------|----------|
| Test detail | General mentions | Medium (5 files) | Comprehensive (15+ test cases) |

**Council Decision:** **Adopt GUARDIAN's test matrix** (but scoped to realistic coverage)

**Reasoning:**
- Edge case matrix is valuable
- Unit tests for utility functions are essential
- Skip some integration tests if time-constrained

---

## 4. Unified Implementation Plan

### Phase 1: Type Definitions and Validation (Day 1 - Morning)

**No behavior change, foundation only**

1. **Update TypeScript types:**
   - `frontend/src/lib/entities/stream.ts` - Add `file_system` to `ValuesEvent`
   - `frontend/src/lib/entities/thread.ts` - Add `file_system` to `SemanticThread`
   - `frontend/src/lib/services/agentService.ts` - Add `file_system` to `Agent` type

2. **Update validation schema:**
   - `frontend/src/validations/stream.ts` - Add `file_system` field to `ValuesPayloadSchema`

### Phase 2: Utility Creation (Day 1 - Afternoon)

**Add helper functions**

1. **Create utility file:**
   - `frontend/src/lib/utils/fileSystemCompat.ts`
   - Functions: `extractFiles()`, `isValidFilePath()` (optional)

2. **Add unit tests:**
   - `frontend/src/tests/utils/fileSystemCompat.test.ts`

### Phase 3: Core Logic Updates (Day 2)

**Main implementation**

1. **Update `useChat.ts`:**
   - Payload construction: Change `files` to `file_system` (2 locations)
   - SSE handling: Use `extractFiles()` or inline fallback

2. **Update `useThread.ts`:**
   - Thread loading: Use `extractFiles()` or inline fallback

3. **Update `SharedThreadPage.tsx`:** (if shared thread feature is used)
   - Read `file_system ?? files`

### Phase 4: Agent Forms (Day 2 - Continued)

**Secondary implementation**

1. **Update `pages/agents/edit.tsx`:**
   - Read `agent.file_system ?? agent.files`

2. **Update `pages/agents/thread.tsx`:**
   - Read `agent.file_system ?? agent.files`

3. **Update `FileEditorPanel.tsx`:**
   - Payload construction: Change `files` to `file_system`

4. **Verify `agent-create-form.tsx`:**
   - Already sends `files: fileSystemData` - change to `file_system`

### Phase 5: Testing and Validation (Day 3)

1. **Run existing tests:**
   ```bash
   cd frontend && npm run test
   ```

2. **Update test mocks if needed:**
   - Any test asserting on `files` field in payloads

3. **Manual testing:**
   - Create thread with files
   - Load existing thread with files
   - Agent create/edit with file system

---

## 5. Risk Consolidation

### High Priority Risks

| Risk | Mitigation |
|------|------------|
| SSE parsing errors | Update validation schema FIRST (Phase 1) |
| Thread loading breaks | Fallback pattern handles both formats |
| Type mismatches | Update types BEFORE logic changes |

### Medium Priority Risks

| Risk | Mitigation |
|------|------------|
| Backend not sending `file_system` | Fallback to `files` - backend already supports both |
| Existing tests fail | Tests use internal state which doesn't change |
| Shared thread links break | Fallback pattern covers old data |

### Low Priority Risks

| Risk | Mitigation |
|------|------------|
| Performance impact | Minimal - single object property access |
| Browser cache issues | Not caching API responses |

---

## 6. Final Verdict

### Recommendation: **GO**

### Conditions:
1. Update types/validation BEFORE logic changes
2. Keep fallback pattern (`file_system ?? files`) for all read paths
3. Create utility file for consistency
4. Run full test suite before merge

### Confidence Level: **High**

**Rationale:**
- Backend already supports `file_system` field
- Fallback pattern ensures backwards compatibility
- Changes are isolated to API boundary
- Internal state remains stable
- All three proposals converge on the same core approach

---

## 7. Implementation Priority Order

1. **P0 (Critical Path):** Type definitions + validation schema
2. **P1 (Core):** `useChat.ts` (SSE handling + payload)
3. **P1 (Core):** `useThread.ts` (thread loading)
4. **P2 (Supporting):** Agent pages (`edit.tsx`, `thread.tsx`)
5. **P2 (Supporting):** `FileEditorPanel.tsx`
6. **P3 (Cleanup):** Test updates

---

## 8. Success Criteria Checklist

- [ ] TypeScript types updated with `file_system` field
- [ ] Zod validation schema includes `file_system`
- [ ] `useChat.ts` sends `file_system` in payload
- [ ] `useChat.ts` reads `file_system ?? files` from SSE
- [ ] `useThread.ts` reads `file_system ?? files`
- [ ] Agent pages read `file_system ?? files`
- [ ] `FileEditorPanel.tsx` sends `file_system` in payload
- [ ] `agent-create-form.tsx` sends `file_system` in payload
- [ ] All tests pass
- [ ] Manual testing verified

---

**Document Status:** Ready for Implementation
**Council Session:** 2026-01-17
**Verdict:** GO with High Confidence
