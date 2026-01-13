# Council Review: Site Title Status Indicator

**Feature:** GitHub Issue #658: FEAT: Site Title Provide Status of idle|stream|done for tab
**Review Date:** 2026-01-13
**Proposals Reviewed:** ARCHITECT, CRAFTSMAN, GUARDIAN

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| Hook Name | `useDocumentTitle` | `useDocumentTitle` | `useDocumentTitle` | **CONSENSUS**: `useDocumentTitle` |
| Hook Location | `frontend/src/hooks/` | `frontend/src/hooks/` | `frontend/src/hooks/` | **CONSENSUS**: `frontend/src/hooks/useDocumentTitle.ts` |
| Integration Point | App.tsx | ChatContext.tsx | AppContext.tsx (via DocumentTitleManager) | **VERDICT**: App.tsx (simplest, direct context access) |
| API Design | Context consumer (internal) | Props-based (status param) | Context consumer (internal) | **VERDICT**: Context consumer - simpler integration |
| Status Format | `Streaming... - Ruska AI` | `[...] Ruska AI - Orchestra` | `[Streaming...] Ruska AI - Orchestra` | **VERDICT**: `[Streaming...] Ruska AI` (prefix for visibility) |
| Done Timeout | 3 seconds | Deferred | 2 seconds | **VERDICT**: 3 seconds (noticeable but not stale) |
| Test Location | Co-located | `tests/hooks/` | Co-located | **VERDICT**: Co-located `useDocumentTitle.test.ts` |
| Complexity | LOW | LOW | LOW | **CONSENSUS**: LOW |

---

## 2. Consensus Points

All three proposals agree on:

1. **Dedicated hook pattern** - Create a standalone `useDocumentTitle` hook
2. **Tri-state model** - idle, streaming, done states
3. **Derive from existing loading state** - No new state in AppContext
4. **Proper cleanup** - Restore title on unmount, clear timeouts
5. **Comprehensive testing** - Unit tests with Vitest and fake timers
6. **Low complexity** - 2-4 hours implementation time
7. **Low risk** - Isolated feature, easy rollback

---

## 3. Divergence Analysis

### 3.1 Integration Point

| Agent | Location | Rationale |
|-------|----------|-----------|
| ARCHITECT | App.tsx | Global scope, simple |
| CRAFTSMAN | ChatContext.tsx | Access to messages for "done" logic |
| GUARDIAN | AppContext.tsx (child component) | Early mounting, single instance |

**Council Decision:** **App.tsx**
- Simplest approach
- App.tsx is inside AppProvider (has context access)
- No need for messages.length - done is triggered by loading transition
- Single line addition: `useDocumentTitle();`

### 3.2 API Design (Props vs Context Consumer)

| Agent | Design | Rationale |
|-------|--------|-----------|
| ARCHITECT | Internal context | Encapsulated, simpler to use |
| CRAFTSMAN | Props-based `(status)` | Testable, flexible, DI |
| GUARDIAN | Internal context | Self-contained |

**Council Decision:** **Internal context consumer with exported status**
- Hook consumes context internally (simpler integration)
- Returns status for observability: `{ status }`
- Tests can mock `useAppContext`

### 3.3 Title Format

| Agent | Streaming | Done |
|-------|-----------|------|
| ARCHITECT | `Streaming... - Ruska AI` | `Done! - Ruska AI` |
| CRAFTSMAN | `[...] Ruska AI - Orchestra` | `[Done] Ruska AI - Orchestra` |
| GUARDIAN | `[Streaming...] Ruska AI - Orchestra` | `[Done] Ruska AI - Orchestra` |

**Council Decision:** **GUARDIAN's format with shortened base**
- Prefix format: Status visible even with many tabs
- Short format: `[Streaming...] Ruska AI` (not full "Orchestra" suffix)
- Bracket notation: ASCII-safe, clear, no emojis

**Final Title Formats:**
- idle: `Ruska AI`
- streaming: `[Streaming...] Ruska AI`
- done: `[Done] Ruska AI`

### 3.4 Done Timeout Duration

| Agent | Duration |
|-------|----------|
| ARCHITECT | 3000ms |
| CRAFTSMAN | Deferred |
| GUARDIAN | 2000ms |

**Council Decision:** **3000ms (3 seconds)**
- Long enough for users to notice
- Short enough to feel responsive
- Matches ARCHITECT's recommended duration

---

## 4. Unified Implementation Plan

### 4.1 Architecture

```
App.tsx
  └── useDocumentTitle()
        ├── reads: useAppContext().loading
        ├── derives: status (idle | streaming | done)
        ├── manages: document.title
        └── handles: timeout, cleanup
```

### 4.2 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/hooks/useDocumentTitle.ts` | CREATE | Hook implementation |
| `frontend/src/hooks/useDocumentTitle.test.ts` | CREATE | Unit tests |
| `frontend/src/App.tsx` | MODIFY | Add hook invocation |

### 4.3 Implementation Sequence

1. Create hook with full implementation
2. Create comprehensive tests
3. Integrate into App.tsx
4. Run test suite
5. Manual verification
6. Format code

---

## 5. Risk Consolidation

### Combined Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Title not updating | LOW | LOW | Tests verify behavior |
| Title stuck in wrong state | LOW | MEDIUM | Timeout fallback, cleanup |
| Memory leak (timeout) | LOW | LOW | Proper cleanup in useEffect |
| Multiple hook instances | VERY LOW | LOW | Single invocation in App.tsx |
| undefined/null loading | LOW | LOW | Strict equality check |
| Breaking existing features | VERY LOW | MEDIUM | Isolated hook, no core changes |

### Mitigation Strategies

1. **Defensive coding**: `const isLoading = loading === true`
2. **Cleanup on unmount**: Restore default title, clear timeouts
3. **Timeout cancellation**: Clear pending timeout on state change
4. **Single invocation**: Hook called only in App.tsx

---

## 6. Final Verdict

### Recommendation: **GO**

**Confidence Level:** HIGH

**Conditions:** None - proceed with implementation

### Summary

The Council unanimously recommends implementing a `useDocumentTitle` hook that:

1. **Follows ARCHITECT's architecture** - Hook in `frontend/src/hooks/`, invoked in App.tsx
2. **Applies CRAFTSMAN's simplicity** - Single-purpose hook, ~60 LOC
3. **Incorporates GUARDIAN's defensive patterns** - Edge case handling, comprehensive tests
4. **Uses hybrid title format** - Bracket prefix for visibility, shorter base title

### Approved Implementation Details

| Aspect | Decision |
|--------|----------|
| Hook file | `frontend/src/hooks/useDocumentTitle.ts` |
| Test file | `frontend/src/hooks/useDocumentTitle.test.ts` |
| Integration | `App.tsx` - single line: `useDocumentTitle()` |
| Status type | `'idle' \| 'streaming' \| 'done'` |
| Idle title | `Ruska AI` |
| Streaming title | `[Streaming...] Ruska AI` |
| Done title | `[Done] Ruska AI` |
| Done timeout | 3000ms |
| Return value | `{ status: TitleStatus }` |

---

**Council Review Complete**
**Status:** APPROVED FOR IMPLEMENTATION
**Next Step:** Generate TASKS.md
