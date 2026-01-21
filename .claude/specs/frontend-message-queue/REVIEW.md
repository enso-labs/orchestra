# ELITE COUNCIL REVIEW: Frontend Message Queue Implementation

**Feature Under Review**: Frontend-only message queue system for LLM calls
**Proposals Reviewed**: 5 (ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR)

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR | **Council Verdict** |
|--------|-----------|-----------|----------|-----------|-------------|---------------------|
| **Architecture** | Unified streaming interface | Separate queue hook via DI | State machine with error recovery | Ref + minimal state hybrid | Interface-driven additive design | **Separate hook with ref-based queue** |
| **Maintainability** | Good - clear separation | Excellent - follows SOLID | Good - comprehensive | Good - follows existing patterns | Excellent - backward compatible | **Follow CRAFTSMAN's SOLID approach** |
| **Risk Level** | Low | Medium | Medium-High | Low | Low | **Low to Medium** |
| **Completeness** | Medium - focused on stream | High - full implementation | Very High - edge cases | Medium - performance focus | High - integration focus | **Combine GUARDIAN + INTEGRATOR** |
| **Performance** | Not addressed | Basic memoization | Not primary focus | Excellent - ref patterns | Basic memoization | **Apply OPTIMIZER's ref pattern** |

---

## 2. Consensus Points

All 5 proposals agree on:

1. **New `useMessageQueue` hook**: All agents recommend a dedicated hook for queue logic
2. **Separation of concerns**: Queue management separate from stream execution
3. **`controller` as streaming indicator**: Using `controller !== null` to detect active stream
4. **Auto-processing on completion**: `useEffect` watching controller/isStreaming state
5. **FIFO queue processing**: First-in-first-out message handling
6. **Frontend-only implementation**: No backend changes required
7. **Dual UI elements during streaming**: Show both abort AND submit-to-queue

Universally recommended patterns:
- `useCallback` for stable function references
- `useState` for UI-reactive queue length
- Unique message IDs using timestamp + random suffix
- `QueuedMessage` interface with id, query, images, timestamp

---

## 3. Divergence Analysis

### 3.1 Queue State Storage

| Agent | Approach | Trade-off |
|-------|----------|-----------|
| ARCHITECT | `useState` for queue | Simple but re-renders on every change |
| CRAFTSMAN | `useState` with memoized return | Better performance via useMemo |
| OPTIMIZER | `useRef` for queue array, `useState` only for length | Best performance - minimal re-renders |
| INTEGRATOR | `useState` for queue | Simple implementation |

**Council Decision**: **OPTIMIZER's hybrid approach**
- Use `useRef` for the actual queue array (no re-renders on add/remove)
- Use `useState` only for `queueLength` (UI badge) and `isProcessing` (loading states)
- This follows the `in_mem_messages` pattern already in useChat.ts

### 3.2 Error Handling Depth

| Agent | Approach |
|-------|----------|
| ARCHITECT | Basic retry on network errors |
| CRAFTSMAN | Error status on QueuedMessage |
| GUARDIAN | Full state machine with recovery modes, watchdog timers |
| OPTIMIZER | Not addressed |
| INTEGRATOR | onQueueEmpty/onProcessStart callbacks |

**Council Decision**: **GUARDIAN's model, simplified for MVP**
- MVP: Basic error handling - pause queue on error, preserve messages
- V2: Full recovery modes with retry logic
- Key elements to include in MVP:
  - `beforeunload` warning when queue non-empty
  - Queue preservation on stream error (don't lose queued messages)
  - Clear queue when `clearMessages()` is called

### 3.3 Integration Point

| Agent | Integration Strategy |
|-------|---------------------|
| ARCHITECT | Modify useChat to call queue |
| CRAFTSMAN | Inject streamLLM into queue hook |
| GUARDIAN | Deep integration with stream lifecycle |
| OPTIMIZER | Minimal changes, ref-based |
| INTEGRATOR | Additive - queue wraps existing handleSubmit |

**Council Decision**: **INTEGRATOR's additive approach with CRAFTSMAN's DI pattern**
- Queue hook receives `executeSubmit` function as dependency
- Original `handleSubmit` remains available (backward compatibility)
- New `enqueueMessage` becomes the primary submit path
- No changes to internal stream handling in useChat

### 3.4 UI During Streaming

All agents agree on showing both abort and submit. Minor differences in layout:

| Agent | Layout |
|-------|--------|
| ARCHITECT | Side-by-side buttons with Plus icon for queue |
| CRAFTSMAN | Queue badge + submit button |
| INTEGRATOR | Badge + Plus button + Abort button |

**Council Decision**: **INTEGRATOR's complete UI**
- Show queue count badge when `queueLength > 0`
- Show submit-to-queue button (smaller, secondary style) when input has content
- Show abort button (primary, red) when streaming
- Clear input immediately after enqueue (not after stream completes)

---

## 4. Unified Implementation Plan

### Phase 1: Type Definitions
**File**: `frontend/src/lib/entities/queue.ts`

```typescript
export interface QueuedMessage {
  id: string;
  query: string;
  images: File[];
  queuedAt: number;
}

export interface UseMessageQueueConfig {
  isStreaming: boolean;
  executeSubmit: (query: string, images: File[]) => Promise<void>;
}

export interface UseMessageQueueReturn {
  // State (triggers re-renders only for UI needs)
  queueLength: number;
  isProcessing: boolean;

  // Actions (stable via useCallback)
  enqueue: (query: string, images?: File[]) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;

  // Computed
  hasQueuedMessages: boolean;
}
```

### Phase 2: Queue Hook Implementation
**File**: `frontend/src/hooks/useMessageQueue.ts`

Architecture (OPTIMIZER's hybrid pattern):
```typescript
// Ref for synchronous access - no re-renders
const queueRef = useRef<QueuedMessage[]>([]);

// State only for UI - minimal re-renders
const [queueLength, setQueueLength] = useState(0);
const [isProcessing, setIsProcessing] = useState(false);

// Track previous streaming state for edge detection
const prevStreamingRef = useRef(isStreaming);

// Stable enqueue operation
const enqueue = useCallback((query: string, images: File[] = []) => {
  const newMessage: QueuedMessage = {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    query,
    images,
    queuedAt: Date.now(),
  };
  queueRef.current = [...queueRef.current, newMessage];
  setQueueLength(queueRef.current.length);
}, []);

// Auto-process effect
useEffect(() => {
  const wasStreaming = prevStreamingRef.current;
  prevStreamingRef.current = isStreaming;

  // Stream just completed
  if (wasStreaming && !isStreaming && queueRef.current.length > 0) {
    processNext();
  }
}, [isStreaming]);
```

### Phase 3: Context Integration
**File**: `frontend/src/context/ChatContext.tsx`

```typescript
const queueHooks = useMessageQueue({
  isStreaming: !!chatHooks.controller,
  executeSubmit: chatHooks.handleSubmit,
});

return (
  <ChatContext.Provider
    value={{
      ...chatHooks,
      ...configHooks,
      ...imageHooks,
      ...threadHooks,
      ...modelsHooks,
      ...fileSystemHooks,
      ...queueHooks,  // NEW
    }}
  >
    {children}
  </ChatContext.Provider>
);
```

### Phase 4: ChatInput Modification
**File**: `frontend/src/components/inputs/ChatInput.tsx`

Key changes:
1. Import `enqueue` instead of relying solely on `handleSubmit`
2. Remove `!loading` check - queue handles timing
3. Clear input immediately after enqueue

```typescript
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey && !isRecording && query.length > 0) {
    e.preventDefault();
    if (!isLikelyMobile()) {
      enqueue(query, images);
      // Input clearing happens after enqueue, not after stream
    }
  }
}}
```

### Phase 5: ChatSubmitButton Modification
**File**: `frontend/src/components/buttons/ChatSubmitButton.tsx`

New UI logic when `controller` exists:
1. Queue badge (shows count when > 0)
2. Submit-to-queue button (Plus icon, secondary style)
3. Abort button (existing, red)

### Phase 6: Edge Case Handling (from GUARDIAN)
Essential for MVP:
- `beforeunload` warning when queue has items
- Clear queue when `clearMessages()` is called
- Preserve queue on stream error

---

## 5. Risk Consolidation

| Risk Category | Risks | Mitigation |
|---------------|-------|------------|
| **Race Conditions** | Rapid submits, concurrent state updates | Use functional setState, processingRef guard |
| **Memory Leaks** | Orphaned images, unbounded queue | MAX_QUEUE_SIZE (10), clear on unmount |
| **UI Stale State** | Queue badge showing wrong count | Derive from queueLength state, not ref |
| **Stream Lifecycle** | Processing next before stream fully done | Use prevStreamingRef for edge detection |
| **Error Recovery** | Stream errors losing queue | Preserve queue on error, pause processing |
| **Navigation** | Losing queue on page leave | beforeunload warning |

---

## 6. Final Verdict

### Recommendation: **GO**

**Confidence Level**: **High**

The unified plan synthesizes the best elements from all 5 proposals:
- ARCHITECT's clear system design
- CRAFTSMAN's SOLID principles and testability
- GUARDIAN's edge case coverage (simplified for MVP)
- OPTIMIZER's performance-conscious ref pattern
- INTEGRATOR's backward-compatible interface design

### Implementation Priority Order

1. **Type definitions** (`queue.ts`) - Foundation for type safety
2. **useMessageQueue hook** - Core logic with OPTIMIZER's pattern
3. **ChatContext integration** - Wire up the hook
4. **ChatInput changes** - Use enqueue instead of handleSubmit
5. **ChatSubmitButton changes** - Dual UI during streaming
6. **Edge case handling** - beforeunload, clear integration
7. **Unit tests** - Following CRAFTSMAN's test specifications
8. **Integration tests** - Following GUARDIAN's scenarios

### Files Changed Summary

| File | Change Type | Complexity |
|------|-------------|------------|
| `frontend/src/lib/entities/queue.ts` | NEW | Low |
| `frontend/src/lib/entities/index.ts` | MODIFY | Low |
| `frontend/src/hooks/useMessageQueue.ts` | NEW | Medium |
| `frontend/src/context/ChatContext.tsx` | MODIFY | Low |
| `frontend/src/components/inputs/ChatInput.tsx` | MODIFY | Low |
| `frontend/src/components/buttons/ChatSubmitButton.tsx` | MODIFY | Medium |
| `frontend/src/hooks/useChat.ts` | MODIFY (minor) | Low |
| `frontend/src/tests/hooks/useMessageQueue.test.ts` | NEW | Medium |

### Estimated Total Effort
- Implementation: 4-6 hours
- Testing: 2-3 hours
- **Total: 6-9 hours**
