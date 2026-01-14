# PROPOSAL: GUARDIAN — Security & Error Handling Perspective

**Agent**: GUARDIAN
**Specialization**: Security, error handling, edge cases, testing
**Feature**: Frontend integration for Distributed Workers (TaskIQ)

---

## Executive Summary

The distributed workers feature introduces new failure modes and security considerations. This proposal focuses on **robust error handling**, **graceful degradation**, and **secure authentication** for the polling mechanism.

---

## Security Analysis

### Authentication Challenge

**Problem**: Native `EventSource` doesn't support custom headers.

**Current Auth Flow**:
```typescript
// threadService.ts
const token = getAuthToken();
if (token) headers.Authorization = `Bearer ${token}`;
```

**Options for EventSource**:

| Option | Security | Complexity | Recommendation |
|--------|----------|------------|----------------|
| Token in query param | ⚠️ Medium (URL logging) | Low | Acceptable with short TTL |
| Cookie-based auth | ✅ High | Medium | Preferred if available |
| Custom fetch-based SSE | ✅ High | High | Best for full control |

**Recommended Approach**: Custom fetch-based SSE implementation

```typescript
// lib/utils/fetchEventSource.ts
export async function fetchEventSource(
  url: string,
  options: {
    headers?: Record<string, string>;
    onMessage: (event: SSEEvent) => void;
    onError: (error: Error) => void;
    signal?: AbortSignal;
  }
) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/event-stream',
      ...options.headers
    },
    signal: options.signal
  });
  
  if (!response.ok) {
    throw new Error(`Stream failed: ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  // ... parse SSE format
}
```

---

## Error Handling Matrix

### New Failure Modes

| Scenario | Detection | Recovery | User Feedback |
|----------|-----------|----------|---------------|
| POST returns 202 but thread_id missing | Response validation | Retry POST | "Connection error, retrying..." |
| GET stream never receives [DONE] | Timeout (60s) | Retry GET | "Response delayed, please wait..." |
| GET stream returns error event | Parse error payload | Show error | Display error message |
| Network disconnect during poll | EventSource error | Auto-reconnect | "Reconnecting..." |
| Auth token expired during poll | 401 response | Refresh token, retry | Silent refresh |
| Thread not found (404) | Status check | Abort with error | "Conversation not found" |

### Implementation

```typescript
// hooks/useStreamError.ts
export interface StreamError {
  code: 'NETWORK' | 'AUTH' | 'TIMEOUT' | 'SERVER' | 'PARSE';
  message: string;
  retryable: boolean;
}

export function useStreamError() {
  const [error, setError] = useState<StreamError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  
  const handleError = useCallback((err: unknown) => {
    const streamError = classifyError(err);
    setError(streamError);
    
    if (streamError.retryable && retryCount < MAX_RETRIES) {
      setRetryCount(c => c + 1);
      return { shouldRetry: true, delay: exponentialBackoff(retryCount) };
    }
    
    return { shouldRetry: false };
  }, [retryCount]);
  
  return { error, handleError, clearError: () => setError(null) };
}

function classifyError(err: unknown): StreamError {
  if (err instanceof TypeError) {
    return { code: 'NETWORK', message: 'Network error', retryable: true };
  }
  // ... more classification
}

function exponentialBackoff(retry: number): number {
  return Math.min(1000 * Math.pow(2, retry), 10000);
}
```

---

## Edge Cases

### 1. Race Condition: Multiple Submissions
```typescript
// Problem: User submits while previous request is distributed
const submissionLock = useRef(false);

const handleSubmit = async () => {
  if (submissionLock.current) {
    toast.warning('Please wait for the current response');
    return;
  }
  
  submissionLock.current = true;
  try {
    await submitAndStream();
  } finally {
    submissionLock.current = false;
  }
};
```

### 2. Component Unmount During Stream
```typescript
// Problem: Component unmounts while polling
useEffect(() => {
  const controller = new AbortController();
  
  if (distributed && threadId) {
    pollStream(threadId, { signal: controller.signal });
  }
  
  return () => controller.abort();
}, [distributed, threadId]);
```

### 3. Stream TTL Expiry
```typescript
// Problem: Redis stream expires after 5 minutes
const STREAM_TTL_WARNING_MS = 4 * 60 * 1000; // 4 minutes

useEffect(() => {
  if (!distributed) return;
  
  const warningTimer = setTimeout(() => {
    toast.info('Stream may expire soon. If no response, please retry.');
  }, STREAM_TTL_WARNING_MS);
  
  return () => clearTimeout(warningTimer);
}, [distributed]);
```

### 4. Duplicate [DONE] Events (Multi-turn)
```typescript
// Problem: Polling after Turn 2 includes Turn 1's [DONE]
let doneReceived = false;

const onMessage = (event) => {
  if (event.data === '[DONE]') {
    if (doneReceived) return; // Ignore subsequent [DONE]
    doneReceived = true;
    cleanup();
    return;
  }
  // ... handle event
};
```

---

## Validation Schema

```typescript
// validations/stream.ts
import { z } from 'zod';

export const DistributedResponseSchema = z.object({
  thread_id: z.string().uuid(),
  distributed: z.literal(true)
});

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('metadata'), data: z.record(z.unknown()) }),
  z.object({ type: z.literal('messages'), data: z.array(z.unknown()) }),
  z.object({ type: z.literal('values'), data: z.record(z.unknown()) }),
  z.object({ type: z.literal('error'), data: z.object({ error: z.string() }) }),
]);

// Usage
function parseStreamEvent(raw: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(raw);
    return StreamEventSchema.parse(transformTuple(parsed));
  } catch {
    console.warn('Invalid stream event:', raw);
    return null;
  }
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Response type detection (200 vs 202)
- [ ] Error classification logic
- [ ] Retry backoff calculation
- [ ] Zod validation schemas

### Integration Tests
- [ ] Full distributed flow (POST → 202 → GET → events)
- [ ] Error recovery (network fail → retry → success)
- [ ] Auth refresh during stream
- [ ] Component unmount cleanup

### Edge Case Tests
- [ ] Multiple rapid submissions
- [ ] [DONE] deduplication
- [ ] Timeout handling
- [ ] Stream TTL expiry

---

## Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Medium (auth and error handling critical)
- **Files Changed**: 4-5
- **Priority Order**:
  1. Implement custom fetch-based SSE (security first)
  2. Add error classification and retry logic
  3. Add Zod validation schemas
  4. Implement edge case guards
  5. Comprehensive testing
