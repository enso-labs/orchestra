# PROPOSAL: ARCHITECT — System Design Perspective

**Agent**: ARCHITECT
**Specialization**: System design, scalability, architectural patterns
**Feature**: Frontend integration for Distributed Workers (TaskIQ)

---

## Executive Summary

The distributed workers feature requires a **branching strategy** in the chat submission flow: detect `distributed: true` in POST response, then switch to EventSource polling. This should be abstracted into a unified streaming interface that hides the complexity from consuming components.

---

## Architectural Analysis

### Current State
- `streamThread()` in `threadService.ts` creates SSE connection for POST
- `useChat.handleSSE()` manages the streaming response
- Single flow: POST → immediate SSE → handle events

### Proposed Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Chat Submission                           │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/llm/stream                                            │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │ Response?    │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│    ┌────┴────────────────────┐                                   │
│    │                         │                                   │
│    ▼                         ▼                                   │
│ distributed: false       distributed: true                       │
│ (200 OK + SSE)          (202 Accepted + JSON)                    │
│    │                         │                                   │
│    │                         ▼                                   │
│    │              GET /api/threads/{thread_id}/stream            │
│    │                         │                                   │
│    ▼                         ▼                                   │
│ ┌────────────────────────────────────────────┐                   │
│ │            Unified Event Handler            │                   │
│ │  (metadata, messages, values, [DONE])      │                   │
│ └────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **DistributedStreamClient** (new)
   - Wraps both modes (sync SSE, async polling)
   - Exposes unified event interface
   - Handles mode detection automatically

2. **threadService.ts** (modify)
   - Add `streamDistributedThread()` for polling mode
   - Add `detectDistributedMode()` helper

3. **useChat.ts** (modify)
   - Update `handleSSE()` to detect distributed response
   - Add polling logic with EventSource

---

## Implementation Strategy

### Step 1: Add Distributed Response Types
```typescript
// lib/entities/distributed.ts
interface DistributedResponse {
  thread_id: string;
  distributed: true;
}

interface SyncStreamResponse {
  // SSE stream (no JSON body)
  distributed?: false;
}

type StreamResponse = DistributedResponse | SyncStreamResponse;
```

### Step 2: Create Poll-Based Stream Function
```typescript
// threadService.ts
export const pollThreadStream = (threadId: string): EventSource => {
  const token = getAuthToken();
  const url = `${VITE_API_URL}/threads/${threadId}/stream`;
  
  // Native EventSource for GET requests (simpler than SSE library)
  const source = new EventSource(url, {
    // Note: EventSource doesn't support auth headers natively
    // May need custom implementation or query param token
  });
  
  return source;
};
```

### Step 3: Update Chat Submission Flow
```typescript
// useChat.ts - handleSSE modification
const handleSSE = async (query, images, history, callbacks) => {
  const payload = buildPayload(query, images);
  
  // Step 1: POST to /llm/stream
  const response = await fetch(`${VITE_API_URL}/llm/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload)
  });
  
  // Step 2: Check response type
  if (response.status === 202) {
    // Distributed mode
    const { thread_id } = await response.json();
    return handleDistributedStream(thread_id, history, callbacks);
  }
  
  // Sync mode - existing SSE handling
  return handleSyncStream(response, history, callbacks);
};
```

---

## Design Decisions

### 1. EventSource vs SSE Library for Polling
**Decision**: Use native `EventSource` for GET polling
**Rationale**: 
- GET requests work with native EventSource
- Simpler than `sse.js` for read-only streams
- Better browser support and automatic reconnection

### 2. Auth Header Challenge
**Decision**: Support both query param and cookie-based auth
**Rationale**: 
- EventSource doesn't support custom headers
- Options: Use cookie auth, token in query param, or custom fetch-based SSE

### 3. Unified Handler vs Separate Handlers
**Decision**: Unified event handler for both modes
**Rationale**: 
- Same event format (metadata, messages, values, [DONE])
- Reduces code duplication
- Easier to maintain

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auth token in URL (query param) | Medium | Use short-lived tokens or cookie fallback |
| EventSource reconnection spam | Low | Implement backoff and max retries |
| Race condition on thread_id | Low | Lock UI during transition |
| Network timeout on long operations | Medium | Keep-alive handling already in spec |

---

## Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Low
- **Files Changed**: 3-4
- **New Files**: 1-2
- **Priority Order**:
  1. Add types and response detection
  2. Implement polling stream function
  3. Update useChat flow
  4. Add error handling
  5. Testing
