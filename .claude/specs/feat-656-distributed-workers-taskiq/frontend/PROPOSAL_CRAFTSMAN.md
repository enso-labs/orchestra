# PROPOSAL: CRAFTSMAN — Clean Code Perspective

**Agent**: CRAFTSMAN
**Specialization**: Clean code, maintainability, SOLID principles
**Feature**: Frontend integration for Distributed Workers (TaskIQ)

---

## Executive Summary

Focus on **minimal, surgical changes** that maintain existing code patterns. The distributed mode should feel like a natural extension of the current streaming architecture, not a parallel system. Prioritize readability and single-responsibility.

---

## Architectural Analysis

### Current Code Patterns Observed

1. **Service Layer Pattern**: `threadService.ts` handles all thread API calls
2. **Hook Composition**: `ChatContext` composes multiple hooks (`useChat`, `useThread`)
3. **Event Handling**: `handleMessages()` in `useChat.ts` already handles SSE event types
4. **State Management**: Uses React state with refs for streaming data

### Code Quality Assessment

The existing `useChat.ts` is large (~585 lines). Adding distributed logic directly would:
- Violate Single Responsibility Principle
- Increase cognitive load
- Make testing harder

**Recommendation**: Extract stream handling into a dedicated hook.

---

## Implementation Strategy

### Principle 1: Extract, Don't Extend

Create a focused hook for stream management:

```typescript
// hooks/useStreamHandler.ts
export function useStreamHandler(options: StreamOptions) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const startStream = useCallback((endpoint: string, payload: any) => {
    // Handle both sync and distributed modes
  }, []);
  
  const stopStream = useCallback(() => {
    // Cleanup logic
  }, []);
  
  return { status, error, startStream, stopStream };
}
```

### Principle 2: Type Safety First

```typescript
// lib/entities/stream.ts
export interface StreamEvent {
  type: 'metadata' | 'messages' | 'values' | 'done' | 'error';
  payload: unknown;
}

export interface DistributedModeResponse {
  thread_id: string;
  distributed: true;
}

export interface StreamOptions {
  onEvent: (event: StreamEvent) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

// Type guard
export function isDistributedResponse(response: any): response is DistributedModeResponse {
  return response?.distributed === true && typeof response?.thread_id === 'string';
}
```

### Principle 3: Preserve Existing Contracts

The `handleMessages()` function in `useChat.ts` should remain unchanged. Instead, adapt the stream source to emit the same event format:

```typescript
// Both sync and distributed modes should call:
handleMessages(payload, history);

// The only difference is WHERE the events come from:
// - Sync: SSE from POST response
// - Distributed: EventSource from GET endpoint
```

### Principle 4: Single Point of Entry

```typescript
// threadService.ts - Add unified stream function
export async function initiateStream(payload: StreamThreadPayload): Promise<StreamSource> {
  const response = await fetch(`${VITE_API_URL}/llm/stream`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (response.status === 202) {
    const { thread_id } = await response.json();
    return createDistributedSource(thread_id);
  }
  
  return createSyncSource(response);
}

// Both return same interface:
interface StreamSource {
  onMessage(handler: (event: StreamEvent) => void): void;
  close(): void;
}
```

---

## File Changes

### 1. `lib/entities/stream.ts` (NEW)
- Type definitions for stream events
- Type guards for response detection
- Clean separation of concerns

### 2. `lib/services/threadService.ts` (MODIFY)
- Add `initiateStream()` function
- Add `pollThreadStream()` for GET endpoint
- Keep existing functions unchanged

### 3. `hooks/useChat.ts` (MODIFY - minimal)
- Replace direct SSE creation with `initiateStream()`
- Keep all event handling logic unchanged
- ~20 lines changed

---

## Design Decisions

### 1. Why Not a New Hook?
**Decision**: Modify `useChat` minimally rather than creating `useDistributedChat`
**Rationale**: 
- Avoids duplicate state management
- Consumers don't need to know about distributed mode
- Single source of truth for chat state

### 2. Why Type Guards?
**Decision**: Use explicit type guards over duck typing
**Rationale**: 
- Compile-time safety
- Self-documenting code
- Easier debugging

### 3. Why Preserve handleMessages?
**Decision**: Keep event handler unchanged, adapt stream source
**Rationale**: 
- handleMessages is well-tested
- Same event format in both modes
- Minimal blast radius

---

## Testing Strategy

```typescript
// tests/services/threadService.test.ts
describe('initiateStream', () => {
  it('returns sync source for 200 response', async () => {
    mockFetch({ status: 200 });
    const source = await initiateStream(payload);
    expect(source.type).toBe('sync');
  });
  
  it('returns distributed source for 202 response', async () => {
    mockFetch({ status: 202, json: { thread_id: 'abc', distributed: true } });
    const source = await initiateStream(payload);
    expect(source.type).toBe('distributed');
  });
});

// tests/hooks/useChat.test.ts
describe('useChat with distributed mode', () => {
  it('handles distributed response transparently', async () => {
    // Mock 202 response
    // Verify polling starts
    // Verify events are processed
  });
});
```

---

## Estimated Complexity

- **Scope**: Small-Medium
- **Risk Level**: Low
- **Lines Changed**: ~100 (new) + ~30 (modified)
- **Priority Order**:
  1. Add type definitions
  2. Add type guards
  3. Implement stream abstraction
  4. Update useChat
  5. Add tests
