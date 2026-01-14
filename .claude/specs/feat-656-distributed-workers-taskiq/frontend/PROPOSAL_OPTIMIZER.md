# PROPOSAL: OPTIMIZER — Performance Perspective

**Agent**: OPTIMIZER
**Specialization**: Performance, efficiency, resource management
**Feature**: Frontend integration for Distributed Workers (TaskIQ)

---

## Executive Summary

The distributed mode introduces a **two-phase request pattern** (POST → GET). Optimize for perceived performance through **optimistic UI updates**, **efficient polling**, and **minimal re-renders** during streaming.

---

## Performance Analysis

### Current Performance Characteristics

| Metric | Current (Sync) | Distributed (Projected) |
|--------|----------------|------------------------|
| Time to First Token | ~500-2000ms | ~1000-3000ms (+POST round-trip) |
| Connection Overhead | 1 request | 2 requests |
| Memory (streaming) | ~O(message length) | Same |
| Re-renders per chunk | 1-2 | Same (if optimized) |

### Optimization Targets

1. **Reduce perceived TTFT** with optimistic UI
2. **Minimize unnecessary re-renders** during streaming
3. **Efficient AbortController management**
4. **Optimal EventSource lifecycle**

---

## Implementation Strategy

### 1. Optimistic UI for Distributed Mode

```typescript
// When we get 202, immediately show a loading state
const handleSubmit = async (query: string) => {
  // Optimistic: Add user message immediately
  const userMessage = createUserMessage(query);
  setMessages(prev => [...prev, userMessage]);
  
  // Optimistic: Add placeholder AI message
  const placeholderMessage = createPlaceholderMessage();
  setMessages(prev => [...prev, placeholderMessage]);
  
  const response = await postToStream(query);
  
  if (response.distributed) {
    // Update placeholder with "processing" state
    updateMessageStatus(placeholderMessage.id, 'processing');
    
    // Start polling
    pollForStream(response.thread_id);
  }
};
```

### 2. Efficient Re-render Strategy

```typescript
// Problem: Each chunk triggers setMessages → full list re-render
// Solution: Use refs for streaming content, batch updates

const streamingContentRef = useRef<string>('');
const updateBatcher = useRef<ReturnType<typeof setTimeout>>();

const handleStreamChunk = useCallback((chunk: string) => {
  streamingContentRef.current += chunk;
  
  // Batch UI updates (debounce to 16ms = 60fps)
  if (updateBatcher.current) return;
  
  updateBatcher.current = setTimeout(() => {
    setMessages(prev => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      updated[lastIndex] = {
        ...updated[lastIndex],
        content: streamingContentRef.current
      };
      return updated;
    });
    updateBatcher.current = undefined;
  }, 16);
}, []);
```

### 3. Connection Pooling Pattern

```typescript
// Reuse EventSource for same thread across turns
const eventSourceCache = new Map<string, EventSource>();

function getOrCreateEventSource(threadId: string): EventSource {
  const cached = eventSourceCache.get(threadId);
  if (cached && cached.readyState !== EventSource.CLOSED) {
    return cached;
  }
  
  const newSource = new EventSource(`/api/threads/${threadId}/stream`);
  eventSourceCache.set(threadId, newSource);
  
  newSource.addEventListener('close', () => {
    eventSourceCache.delete(threadId);
  });
  
  return newSource;
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    eventSourceCache.forEach(source => source.close());
    eventSourceCache.clear();
  };
}, []);
```

### 4. Memory-Efficient Event Parsing

```typescript
// Avoid creating intermediate strings/objects
const parseSSEEvent = (line: string): ParsedEvent | null => {
  // Fast path: check prefix without substring
  if (line.charCodeAt(0) !== 100) return null; // 'd' = 100
  if (!line.startsWith('data: ')) return null;
  
  // Direct slice, no intermediate variables
  const dataStart = 6; // 'data: '.length
  
  if (line === 'data: [DONE]') {
    return { type: 'done' };
  }
  
  try {
    // Parse directly from substring view
    return JSON.parse(line.slice(dataStart));
  } catch {
    return null;
  }
};
```

### 5. AbortController Optimization

```typescript
// Single AbortController for entire submission lifecycle
const useSubmissionController = () => {
  const controllerRef = useRef<AbortController | null>(null);
  
  const startSubmission = useCallback(() => {
    // Abort any existing submission
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);
  
  const abortSubmission = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);
  
  return { startSubmission, abortSubmission };
};
```

---

## Performance Metrics

### Before/After Comparison (Estimated)

| Metric | Before | After Optimization |
|--------|--------|-------------------|
| Perceived TTFT | 1000-3000ms | 200ms (optimistic) |
| Re-renders per chunk | 1-2 | 0-1 (batched) |
| Memory overhead | O(n) objects | O(1) refs |
| Connection cleanup | Manual | Automatic |

### Monitoring Hooks

```typescript
// hooks/useStreamMetrics.ts
export function useStreamMetrics() {
  const metricsRef = useRef({
    ttft: null as number | null,
    totalTokens: 0,
    streamStart: null as number | null,
    chunksReceived: 0
  });
  
  const recordFirstToken = useCallback(() => {
    if (!metricsRef.current.ttft && metricsRef.current.streamStart) {
      metricsRef.current.ttft = Date.now() - metricsRef.current.streamStart;
    }
  }, []);
  
  const recordChunk = useCallback((tokenCount: number) => {
    metricsRef.current.totalTokens += tokenCount;
    metricsRef.current.chunksReceived++;
  }, []);
  
  return { recordFirstToken, recordChunk, getMetrics: () => metricsRef.current };
}
```

---

## Bundle Size Considerations

### Don't Add:
- Large SSE libraries (already have `sse.js`)
- Polling libraries (use native fetch + AbortController)
- State management libraries (React state sufficient)

### Do Add:
- Type definitions (~0kb, dev only)
- Minimal utility functions (~1-2kb)

---

## Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Low
- **Performance Gain**: Significant (perceived TTFT, render efficiency)
- **Priority Order**:
  1. Optimistic UI (biggest perceived impact)
  2. Render batching (smoothest streaming)
  3. AbortController optimization (resource cleanup)
  4. Connection caching (optional, for multi-turn)
  5. Metrics hooks (for monitoring)
