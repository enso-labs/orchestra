# Council Review: Frontend Distributed Workers Integration

**Feature**: Frontend integration for Distributed Workers (TaskIQ)
**Date**: 2026-01-12
**Proposals Reviewed**: 5 (ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR)

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR | **Council Verdict** |
|--------|-----------|-----------|----------|-----------|------------|---------------------|
| **Primary Focus** | System design | Code quality | Security/Errors | Performance | API contracts | Balanced approach |
| **StreamSource Abstraction** | ✅ Unified interface | ✅ Unified interface | — | — | ✅ Unified interface | **Adopt** |
| **Custom fetch-based SSE** | ⚠️ Mentioned | — | ✅ Recommended | — | ✅ Recommended | **Adopt** |
| **Type Safety** | ⚠️ Basic | ✅ Zod + guards | ✅ Zod schemas | — | ✅ Full types | **Adopt with Zod** |
| **Error Handling** | ⚠️ Basic | ⚠️ Basic | ✅ Comprehensive | — | ✅ Good | **Adopt from GUARDIAN** |
| **Optimistic UI** | — | — | — | ✅ Recommended | — | **Adopt** |
| **Render Batching** | — | — | — | ✅ Recommended | — | **Consider** |
| **Backward Compatible** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | **Required** |
| **Test Strategy** | ⚠️ Basic | ✅ Good | ✅ Comprehensive | — | — | **Adopt from GUARDIAN** |

---

## 2. Consensus Points

All proposals agree on:

1. **Unified StreamSource Interface**: Abstract sync vs distributed behind a common interface
2. **Preserve handleMessages()**: Existing event handler works for both modes
3. **Minimal useChat Changes**: Adapt at the service layer, not the hook
4. **Thread ID Management**: Store from both modes, reuse for multi-turn
5. **Backward Compatibility**: Sync mode must continue working unchanged

---

## 3. Divergence Analysis

### 3.1 Authentication for GET Polling

| Proposal | Approach |
|----------|----------|
| ARCHITECT | Query param token or cookie |
| GUARDIAN | Custom fetch-based SSE (recommended) |
| INTEGRATOR | Custom fetch with auth headers |

**Council Decision**: Use **custom fetch-based SSE reader**. Reasons:
- Full header control (Authorization: Bearer)
- No token exposure in URLs
- Works with existing auth infrastructure
- Already have AbortController pattern

### 3.2 Error Handling Depth

| Proposal | Approach |
|----------|----------|
| CRAFTSMAN | Type guards only |
| GUARDIAN | Full error classification + retry logic |
| INTEGRATOR | HTTP status-based classification |

**Council Decision**: Adopt **GUARDIAN's error classification** with INTEGRATOR's HTTP patterns:
- Classify errors by type (NETWORK, AUTH, TIMEOUT, SERVER)
- Implement exponential backoff for retryable errors
- Max 3 retries before surfacing to user

### 3.3 Performance Optimizations

| Optimization | Source | Priority |
|--------------|--------|----------|
| Optimistic UI | OPTIMIZER | **High** |
| Render batching | OPTIMIZER | Medium |
| Connection caching | OPTIMIZER | Low |
| Metrics hooks | OPTIMIZER | Low |

**Council Decision**: 
- **Adopt**: Optimistic UI (immediate user feedback)
- **Defer**: Render batching (current performance acceptable)
- **Skip**: Connection caching (adds complexity, minimal gain)

---

## 4. Unified Implementation Plan

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        useChat Hook                              │
│  (unchanged handleMessages, minimal submission changes)          │
├─────────────────────────────────────────────────────────────────┤
│                    initiateStream()                              │
│              (threadService.ts - NEW)                            │
├─────────────────────────────────────────────────────────────────┤
│         ┌─────────────────┐  ┌─────────────────┐                │
│         │ SyncStreamSource│  │DistributedSource│                │
│         │   (200 + SSE)   │  │ (202 + polling) │                │
│         └────────┬────────┘  └────────┬────────┘                │
│                  │                    │                          │
│                  └────────┬───────────┘                          │
│                           │                                      │
│                  ┌────────▼────────┐                             │
│                  │  StreamSource   │ (common interface)          │
│                  │  Interface      │                             │
│                  └─────────────────┘                             │
├─────────────────────────────────────────────────────────────────┤
│                  FetchStreamReader                               │
│           (custom SSE parser with auth headers)                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
frontend/src/
├── lib/
│   ├── entities/
│   │   └── stream.ts           # NEW: Type definitions
│   ├── services/
│   │   └── threadService.ts    # MODIFY: Add initiateStream()
│   └── utils/
│       ├── streamSource.ts     # NEW: StreamSource classes
│       └── fetchStreamReader.ts # NEW: Custom SSE parser
├── hooks/
│   └── useChat.ts              # MODIFY: Use initiateStream()
└── validations/
    └── stream.ts               # NEW: Zod schemas
```

### Implementation Sequence

1. **Phase 1: Foundation**
   - Add type definitions (`lib/entities/stream.ts`)
   - Add Zod validation schemas (`validations/stream.ts`)

2. **Phase 2: Infrastructure**
   - Implement FetchStreamReader (`lib/utils/fetchStreamReader.ts`)
   - Implement StreamSource interface + classes (`lib/utils/streamSource.ts`)

3. **Phase 3: Integration**
   - Add `initiateStream()` to threadService
   - Update `useChat.handleSSE()` to use new abstraction

4. **Phase 4: Polish**
   - Add optimistic UI updates
   - Add error handling with retry logic
   - Add loading states for distributed mode

5. **Phase 5: Testing**
   - Unit tests for stream sources
   - Integration tests for full flow
   - Edge case coverage

---

## 5. Risk Consolidation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Auth header not supported | Low | High | Custom fetch-based SSE (not native EventSource) |
| Stream timeout (>60s) | Medium | Medium | Keep-alive handling, timeout warnings |
| Duplicate [DONE] events | Medium | Low | State flag to ignore subsequent |
| Component unmount during stream | Medium | Low | AbortController cleanup in useEffect |
| Race condition on rapid submit | Low | Medium | Submission lock pattern |

---

## 6. Final Verdict

| Criterion | Status |
|-----------|--------|
| **Recommendation** | ✅ **GO** |
| **Confidence Level** | High |
| **Estimated Effort** | 2-3 days |
| **Breaking Changes** | None |

### Conditions
1. Must implement custom fetch-based SSE reader (not native EventSource)
2. Must preserve backward compatibility with sync mode
3. Must include comprehensive error handling
4. Must include unit and integration tests

---

## 7. Deliverables

### Required Files

| File | Type | Purpose |
|------|------|---------|
| `lib/entities/stream.ts` | New | Type definitions |
| `lib/utils/fetchStreamReader.ts` | New | Custom SSE parser |
| `lib/utils/streamSource.ts` | New | Stream abstraction classes |
| `validations/stream.ts` | New | Zod schemas |
| `lib/services/threadService.ts` | Modify | Add initiateStream() |
| `hooks/useChat.ts` | Modify | Use new abstraction |
| `tests/services/streamSource.test.ts` | New | Unit tests |
| `tests/integration/distributedStream.test.ts` | New | Integration tests |

### Success Criteria

- [ ] POST to `/api/llm/stream` works in both modes
- [ ] 200 response → direct SSE handling
- [ ] 202 response → JSON parse → poll GET endpoint
- [ ] Multi-turn conversations work (thread_id preserved)
- [ ] Abort functionality works in both modes
- [ ] Error states display correctly
- [ ] No console errors in browser
- [ ] All tests pass
