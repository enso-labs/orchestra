# PROPOSAL: INTEGRATOR — API & Interface Perspective

**Agent**: INTEGRATOR
**Specialization**: APIs, interfaces, system boundaries
**Feature**: Frontend integration for Distributed Workers (TaskIQ)

---

## Executive Summary

The distributed workers feature requires **seamless API integration** that preserves backward compatibility with sync mode. Focus on **clean API contracts**, **proper content-type handling**, and **consistent state updates** across both modes.

---

## API Contract Analysis

### Backend Endpoints

| Endpoint | Method | Request | Response (Sync) | Response (Distributed) |
|----------|--------|---------|-----------------|------------------------|
| `/api/llm/stream` | POST | `{input, model, metadata}` | `200` + SSE stream | `202` + `{thread_id, distributed}` |
| `/api/threads/{id}/stream` | GET | - | - | `200` + SSE stream |

### Content-Type Handling

```typescript
// The POST response content-type determines mode
const response = await fetch('/api/llm/stream', { method: 'POST', body });

if (response.status === 202) {
  // JSON response
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const { thread_id, distributed } = await response.json();
    // Switch to polling mode
  }
} else if (response.status === 200) {
  // SSE stream
  const reader = response.body?.getReader();
  // Handle stream directly
}
```

---

## Interface Definitions

### API Types

```typescript
// lib/entities/stream.ts

// Request types (unchanged from existing)
export interface StreamRequest {
  system_prompt?: string;
  input: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string | ContentPart[];
    }>;
    files?: FileMap;
  };
  model: string;
  metadata?: {
    thread_id?: string;
    project_id?: string;
    [key: string]: unknown;
  };
  tools?: string[];
  subagents?: Agent[];
  mcp?: Record<string, unknown>;
  a2a?: Record<string, unknown>;
  presidio?: {
    analyze?: boolean;
    anonymize?: boolean;
  };
}

// Response types (NEW)
export interface DistributedStreamResponse {
  thread_id: string;
  distributed: true;
}

export interface SyncStreamResponse {
  // No JSON body - direct SSE stream
  readonly _brand: unique symbol;
}

export type StreamInitResponse = DistributedStreamResponse | SyncStreamResponse;

// SSE Event types (matches backend)
export type SSEEventType = 'metadata' | 'messages' | 'values' | 'error';

export interface MetadataEvent {
  type: 'metadata';
  data: {
    thread_id: string;
    assistant_id: string | null;
    project_id: string | null;
  };
}

export interface MessagesEvent {
  type: 'messages';
  data: [
    message: {
      content: string;
      type: string;
      id: string;
      tool_call_chunks?: ToolCallChunk[];
      [key: string]: unknown;
    },
    metadata: {
      thread_id: string;
      [key: string]: unknown;
    }
  ];
}

export interface ValuesEvent {
  type: 'values';
  data: {
    messages: Message[];
    files?: FileMap;
    [key: string]: unknown;
  };
}

export interface ErrorEvent {
  type: 'error';
  data: {
    error: string;
  };
}

export type SSEEvent = MetadataEvent | MessagesEvent | ValuesEvent | ErrorEvent;

export interface DoneSignal {
  type: 'done';
}

export type StreamEvent = SSEEvent | DoneSignal;
```

---

## Service Layer Updates

### threadService.ts Modifications

```typescript
// lib/services/threadService.ts

/**
 * Initiates a stream request. Returns a StreamSource that works
 * identically for both sync and distributed modes.
 */
export async function initiateStream(
  payload: StreamRequest
): Promise<StreamSource> {
  const headers = getAuthHeaders();
  headers['Content-Type'] = 'application/json';
  headers['Accept'] = 'text/event-stream';

  const response = await fetch(`${VITE_API_URL}/llm/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 202) {
    // Distributed mode
    const data = await response.json();
    if (!isDistributedResponse(data)) {
      throw new Error('Invalid distributed response');
    }
    return new DistributedStreamSource(data.thread_id);
  }

  if (response.status === 200) {
    // Sync mode
    return new SyncStreamSource(response);
  }

  throw new Error(`Unexpected status: ${response.status}`);
}

/**
 * Creates a stream source for polling a thread.
 * Used internally by DistributedStreamSource.
 */
export function createThreadStream(threadId: string): FetchStreamReader {
  const headers = getAuthHeaders();
  headers['Accept'] = 'text/event-stream';

  return new FetchStreamReader(`${VITE_API_URL}/threads/${threadId}/stream`, {
    headers,
  });
}
```

### StreamSource Interface

```typescript
// lib/utils/streamSource.ts

export interface StreamSource {
  /**
   * Subscribe to stream events
   */
  onEvent(handler: (event: StreamEvent) => void): void;

  /**
   * Subscribe to errors
   */
  onError(handler: (error: Error) => void): void;

  /**
   * Start the stream (call after setting up handlers)
   */
  start(): void;

  /**
   * Close the stream and clean up resources
   */
  close(): void;
}

/**
 * Sync mode: reads from POST response body
 */
export class SyncStreamSource implements StreamSource {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private eventHandler: ((event: StreamEvent) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  constructor(private response: Response) {}

  onEvent(handler: (event: StreamEvent) => void) {
    this.eventHandler = handler;
  }

  onError(handler: (error: Error) => void) {
    this.errorHandler = handler;
  }

  start() {
    this.reader = this.response.body?.getReader() ?? null;
    this.readLoop();
  }

  close() {
    this.reader?.cancel();
    this.reader = null;
  }

  private async readLoop() {
    // ... SSE parsing logic
  }
}

/**
 * Distributed mode: polls GET endpoint
 */
export class DistributedStreamSource implements StreamSource {
  private source: FetchStreamReader | null = null;
  private eventHandler: ((event: StreamEvent) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  constructor(private threadId: string) {}

  onEvent(handler: (event: StreamEvent) => void) {
    this.eventHandler = handler;
  }

  onError(handler: (error: Error) => void) {
    this.errorHandler = handler;
  }

  start() {
    this.source = createThreadStream(this.threadId);
    this.source.onEvent(event => this.eventHandler?.(event));
    this.source.onError(err => this.errorHandler?.(err));
    this.source.start();
  }

  close() {
    this.source?.close();
    this.source = null;
  }
}
```

---

## State Integration

### Chat Context Updates

```typescript
// hooks/useChat.ts - Modified handleSSE

const handleSSE = async (
  query: string,
  images: File[],
  history: any[],
  callbacks: StreamCallbacks
) => {
  const payload = buildStreamPayload(query, images, metadata, agent);
  
  // Create unified stream source
  const stream = await initiateStream(payload);
  
  // Set up handlers (same for both modes)
  stream.onEvent((event) => {
    if (event.type === 'done') {
      setLoading(false);
      setController(null);
      return;
    }
    
    // Convert to existing format and delegate
    const legacyPayload = convertToLegacyFormat(event);
    handleMessages(legacyPayload, history);
  });
  
  stream.onError((error) => {
    setLoading(false);
    setController(null);
    toast.error(error.message);
  });
  
  // Store for abort capability
  setController({ abort: () => stream.close() });
  
  // Start streaming
  stream.start();
};
```

### Metadata Sync

```typescript
// Ensure thread_id is captured from both modes

stream.onEvent((event) => {
  if (event.type === 'metadata') {
    setMetadata(prev => ({
      ...prev,
      thread_id: event.data.thread_id,
    }));
  }
  // ...
});
```

---

## Backward Compatibility

### Preserved Behaviors

1. **Same request payload format** - No changes to `StreamRequest`
2. **Same event handling** - `handleMessages` unchanged
3. **Same abort mechanism** - `controller.abort()` still works
4. **Same metadata updates** - `thread_id` stored same way

### Transparent to Consumers

```typescript
// ChatPanel doesn't need to know about distributed mode
const { handleSubmit, messages, loading } = useChatContext();

// Just works - distributed or not
<button onClick={() => handleSubmit(query)}>Send</button>
```

---

## Error Response Handling

```typescript
// Handle various error scenarios consistently

async function initiateStream(payload: StreamRequest): Promise<StreamSource> {
  const response = await fetch(url, options);
  
  switch (response.status) {
    case 200:
      return new SyncStreamSource(response);
    
    case 202:
      const data = await response.json();
      return new DistributedStreamSource(data.thread_id);
    
    case 401:
      throw new AuthError('Session expired');
    
    case 429:
      throw new RateLimitError('Too many requests');
    
    case 500:
    case 502:
    case 503:
      throw new ServerError('Server unavailable');
    
    default:
      throw new Error(`Unexpected response: ${response.status}`);
  }
}
```

---

## Estimated Complexity

- **Scope**: Medium
- **Risk Level**: Low (backward compatible)
- **Files Changed**: 3-4
- **New Files**: 2
- **Priority Order**:
  1. Define type interfaces
  2. Implement StreamSource abstraction
  3. Implement SyncStreamSource
  4. Implement DistributedStreamSource
  5. Update threadService
  6. Integrate into useChat
