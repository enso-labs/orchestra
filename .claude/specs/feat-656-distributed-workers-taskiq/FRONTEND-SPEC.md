# Frontend Specification: Distributed Workers Integration

**Feature**: Distributed Workers for LLM Streaming
**Version**: 1.0
**Date**: 2026-01-12
**Status**: Ready for Implementation

---

## Overview

When `DISTRIBUTED_WORKERS=true` on the backend, the `/api/llm/stream` endpoint returns a `202 Accepted` response with a `thread_id` instead of an immediate SSE stream. The frontend must detect this mode and poll a separate endpoint for results.

### Behavior Summary

| Backend Mode | POST Response | Next Step |
|--------------|---------------|-----------|
| Sync (`DISTRIBUTED_WORKERS=false`) | `200 OK` + SSE stream | Read stream directly |
| Distributed (`DISTRIBUTED_WORKERS=true`) | `202 Accepted` + JSON | Poll `GET /api/threads/{id}/stream` |

---

## API Contract

### 1. POST `/api/llm/stream` - Send Message

**Request** (unchanged):
```typescript
interface StreamRequest {
  input: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    files?: Record<string, { content: string[]; created_at: string; modified_at: string }>;
  };
  model: string;
  metadata?: {
    thread_id?: string;  // Include for multi-turn
    project_id?: string;
    [key: string]: unknown;
  };
  system_prompt?: string;
  tools?: string[];
  subagents?: Agent[];
  mcp?: Record<string, unknown>;
  a2a?: Record<string, unknown>;
  presidio?: { analyze?: boolean; anonymize?: boolean };
}
```

**Response - Distributed Mode** (`DISTRIBUTED_WORKERS=true`):
```typescript
// HTTP 202 Accepted
// Content-Type: application/json
interface DistributedResponse {
  thread_id: string;   // UUID
  distributed: true;   // Always true
}
```

**Response - Sync Mode** (`DISTRIBUTED_WORKERS=false`):
```
HTTP 200 OK
Content-Type: text/event-stream

data: ["metadata",{"thread_id":"abc-123",...}]
data: ["messages",[{...}]]
data: [DONE]
```

### 2. GET `/api/threads/{thread_id}/stream` - Poll Results

**Request**:
```
GET /api/threads/{thread_id}/stream
Authorization: Bearer {token}
Accept: text/event-stream
```

**Response**:
```
HTTP 200 OK
Content-Type: text/event-stream

data: ["metadata",{"thread_id":"abc-123","assistant_id":null,"project_id":null}]
data: ["messages",[{"content":"Hello","type":"AIMessageChunk",...},{"thread_id":"abc-123"}]]
data: ["values",{"messages":[...]}]
data: [DONE]
```

---

## SSE Event Types

All events are JSON arrays: `["type", payload]`

| Type | Payload | Purpose |
|------|---------|---------|
| `metadata` | `{thread_id, assistant_id, project_id}` | Thread info (first event) |
| `messages` | `[message, metadata]` | Streaming chunks |
| `values` | `{messages: [...], files?: {...}}` | Final state |
| `error` | `{error: "message"}` | Error occurred |
| `[DONE]` | — | Stream complete (raw string, not JSON) |

### Keep-Alive Comments

The stream may include SSE comments during long operations:
```
: keep-alive
```
These start with `:` and should be ignored by the parser.

---

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chat Submission Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User clicks Send                                               │
│         │                                                        │
│         ▼                                                        │
│   POST /api/llm/stream                                           │
│         │                                                        │
│         ├──────────────────────┬─────────────────────────────┐   │
│         │                      │                             │   │
│    200 OK (sync)          202 Accepted (distributed)         │   │
│         │                      │                             │   │
│         ▼                      ▼                             │   │
│   Read SSE from POST     Parse JSON → Get thread_id          │   │
│         │                      │                             │   │
│         │                      ▼                             │   │
│         │              GET /threads/{id}/stream              │   │
│         │                      │                             │   │
│         │                      ▼                             │   │
│         │              Read SSE from GET                     │   │
│         │                      │                             │   │
│         └──────────┬───────────┘                             │   │
│                    │                                         │   │
│                    ▼                                         │   │
│         Unified Event Handler (handleMessages)               │   │
│                    │                                         │   │
│                    ▼                                         │   │
│         [DONE] → Close stream, update UI                     │   │
│                                                              │   │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Files

### 1. `src/lib/entities/stream.ts`

Type definitions for stream handling.

```typescript
// Response type from POST in distributed mode
export interface DistributedStreamResponse {
  thread_id: string;
  distributed: true;
}

// Type guard for response detection
export function isDistributedResponse(response: unknown): response is DistributedStreamResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'distributed' in response &&
    (response as DistributedStreamResponse).distributed === true &&
    'thread_id' in response &&
    typeof (response as DistributedStreamResponse).thread_id === 'string'
  );
}

// SSE Event types
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
  data: [message: Record<string, unknown>, metadata: { thread_id: string }];
}

export interface ValuesEvent {
  type: 'values';
  data: {
    messages: Array<Record<string, unknown>>;
    files?: Record<string, unknown>;
  };
}

export interface ErrorEvent {
  type: 'error';
  data: { error: string };
}

export type SSEEvent = MetadataEvent | MessagesEvent | ValuesEvent | ErrorEvent;

export interface DoneSignal {
  type: 'done';
}

export type StreamEvent = SSEEvent | DoneSignal;
```

### 2. `src/lib/utils/fetchStreamReader.ts`

Custom SSE reader with auth header support.

```typescript
export interface FetchStreamReaderOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class FetchStreamReader {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  private buffer = '';
  private eventHandler: ((event: StreamEvent) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  constructor(
    private url: string,
    private options: FetchStreamReaderOptions = {}
  ) {}

  onEvent(handler: (event: StreamEvent) => void): this {
    this.eventHandler = handler;
    return this;
  }

  onError(handler: (error: Error) => void): this {
    this.errorHandler = handler;
    return this;
  }

  onClose(handler: () => void): this {
    this.closeHandler = handler;
    return this;
  }

  async start(): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...this.options.headers,
        },
        signal: this.options.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      this.reader = response.body?.getReader() ?? null;
      if (!this.reader) {
        throw new Error('No response body');
      }

      await this.readLoop();
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.errorHandler?.(error);
      }
    } finally {
      this.closeHandler?.();
    }
  }

  close(): void {
    this.reader?.cancel();
    this.reader = null;
  }

  private async readLoop(): Promise<void> {
    if (!this.reader) return;

    while (true) {
      const { done, value } = await this.reader.read();
      if (done) break;

      this.buffer += this.decoder.decode(value, { stream: true });
      this.processBuffer();
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      // Skip keep-alive comments
      if (line.startsWith(':')) continue;
      // Skip empty lines
      if (!line.trim()) continue;

      if (line.startsWith('data: ')) {
        const data = line.slice(6); // Remove 'data: ' prefix

        if (data === '[DONE]') {
          this.eventHandler?.({ type: 'done' });
          continue;
        }

        try {
          const parsed = JSON.parse(data);
          const event = this.parseEvent(parsed);
          if (event) {
            this.eventHandler?.(event);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  private parseEvent(parsed: unknown): SSEEvent | null {
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;

    const [type, payload] = parsed;

    switch (type) {
      case 'metadata':
        return { type: 'metadata', data: payload };
      case 'messages':
        return { type: 'messages', data: payload };
      case 'values':
        return { type: 'values', data: payload };
      case 'error':
        return { type: 'error', data: payload };
      default:
        return null;
    }
  }
}
```

### 3. `src/lib/utils/streamSource.ts`

Unified stream abstraction.

```typescript
import { FetchStreamReader } from './fetchStreamReader';
import { StreamEvent, isDistributedResponse } from '@/lib/entities/stream';
import { VITE_API_URL } from '@/lib/config';
import { getAuthToken } from '@/lib/utils/auth';

export interface StreamSource {
  onEvent(handler: (event: StreamEvent) => void): void;
  onError(handler: (error: Error) => void): void;
  start(): void;
  close(): void;
}

/**
 * Sync mode: reads from POST response body directly
 */
export class SyncStreamSource implements StreamSource {
  private reader: FetchStreamReader;

  constructor(response: Response) {
    // Wrap response body in FetchStreamReader for consistent parsing
    this.reader = new ResponseBodyReader(response);
  }

  onEvent(handler: (event: StreamEvent) => void): void {
    this.reader.onEvent(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.reader.onError(handler);
  }

  start(): void {
    this.reader.start();
  }

  close(): void {
    this.reader.close();
  }
}

/**
 * Distributed mode: polls GET endpoint
 */
export class DistributedStreamSource implements StreamSource {
  private reader: FetchStreamReader;

  constructor(threadId: string) {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.reader = new FetchStreamReader(
      `${VITE_API_URL}/threads/${threadId}/stream`,
      { headers }
    );
  }

  onEvent(handler: (event: StreamEvent) => void): void {
    this.reader.onEvent(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.reader.onError(handler);
  }

  start(): void {
    this.reader.start();
  }

  close(): void {
    this.reader.close();
  }
}
```

---

## Modified Files

### 1. `src/lib/services/threadService.ts`

Add `initiateStream()` function:

```typescript
import { StreamSource, SyncStreamSource, DistributedStreamSource } from '@/lib/utils/streamSource';
import { isDistributedResponse } from '@/lib/entities/stream';

/**
 * Initiates a stream request. Handles both sync and distributed modes.
 * Returns a unified StreamSource interface.
 */
export async function initiateStream(payload: StreamThreadPayload): Promise<StreamSource> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (payload.system_prompt?.trim() === '') {
    delete payload.system_prompt;
  }

  const response = await fetch(`${VITE_API_URL}/llm/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // Distributed mode: 202 Accepted
  if (response.status === 202) {
    const data = await response.json();

    if (!isDistributedResponse(data)) {
      throw new Error('Invalid distributed response format');
    }

    return new DistributedStreamSource(data.thread_id);
  }

  // Sync mode: 200 OK
  if (response.status === 200) {
    return new SyncStreamSource(response);
  }

  // Error responses
  if (response.status === 401) {
    throw new Error('Authentication required');
  }

  if (response.status === 429) {
    throw new Error('Rate limit exceeded');
  }

  throw new Error(`Unexpected response: ${response.status}`);
}
```

### 2. `src/hooks/useChat.ts`

Update `handleSSE()` to use new abstraction:

```typescript
import { initiateStream } from '@/lib/services/threadService';
import { StreamEvent } from '@/lib/entities/stream';

// Inside useChat hook...

const handleSSE = async (
  query: string,
  images: File[],
  history: any[],
  model: string
) => {
  setLoading(true);
  setLoadingMessage('Sending message...');
  setSubmitStartTime(Date.now());
  submitStartTimeRef.current = Date.now();

  const controller = new AbortController();
  setController({ abort: () => controller.abort() });

  try {
    // Build payload (existing logic)
    const payload = buildPayload(query, images, model);

    // Get unified stream source
    const stream = await initiateStream(payload);

    // Handle events (works for both modes)
    stream.onEvent((event: StreamEvent) => {
      if (event.type === 'done') {
        setLoading(false);
        setController(null);
        return;
      }

      // Convert to legacy format for handleMessages()
      const legacyPayload = convertEventToLegacy(event);
      if (legacyPayload) {
        handleMessages(legacyPayload, history);
      }
    });

    stream.onError((error: Error) => {
      setLoading(false);
      setController(null);
      toast.error(error.message);
    });

    // Start the stream
    stream.start();

  } catch (error) {
    setLoading(false);
    setController(null);
    toast.error(error instanceof Error ? error.message : 'Stream failed');
  }
};

// Helper to convert new event format to existing handleMessages format
function convertEventToLegacy(event: StreamEvent): any[] | null {
  switch (event.type) {
    case 'metadata':
      return ['metadata', event.data];
    case 'messages':
      return ['messages', event.data];
    case 'values':
      return ['values', event.data];
    case 'error':
      return null; // Handled separately
    case 'done':
      return null; // Handled separately
    default:
      return null;
  }
}
```

---

## Multi-Turn Conversation Flow

### First Message (New Conversation)

```typescript
// No thread_id in metadata
const payload = {
  input: { messages: [{ role: 'user', content: 'My name is Alice' }] },
  model: 'openai:gpt-4.1-mini'
};

// POST returns 202 + { thread_id: 'abc-123', distributed: true }
// Poll GET /api/threads/abc-123/stream
// Store thread_id from metadata event
```

### Follow-up Messages

```typescript
// Include thread_id in metadata
const payload = {
  input: { messages: [{ role: 'user', content: 'What is my name?' }] },
  model: 'openai:gpt-4.1-mini',
  metadata: { thread_id: 'abc-123' }  // ← CRITICAL
};

// AI will remember "Alice" from first message
```

### Key Point

> **Always include `metadata.thread_id` for follow-up messages to maintain conversation context.**

---

## Error Handling

### Error Classification

| Error Code | HTTP Status | Retryable | User Message |
|------------|-------------|-----------|--------------|
| NETWORK | - | Yes | "Network error, retrying..." |
| AUTH | 401 | No | "Please log in again" |
| RATE_LIMIT | 429 | Yes (with delay) | "Too many requests, please wait" |
| SERVER | 500-503 | Yes | "Server error, retrying..." |
| TIMEOUT | - | Yes | "Response delayed, retrying..." |
| PARSE | - | No | "Unexpected response format" |

### Retry Strategy

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryable(error)) {
        throw error;
      }

      await delay(RETRY_DELAYS[attempt]);
    }
  }

  throw lastError!;
}
```

---

## Testing Checklist

### Unit Tests

- [ ] `isDistributedResponse()` type guard
- [ ] `FetchStreamReader` SSE parsing
- [ ] `SyncStreamSource` event handling
- [ ] `DistributedStreamSource` polling
- [ ] Error classification logic

### Integration Tests

- [ ] Full sync flow (POST → 200 → events → [DONE])
- [ ] Full distributed flow (POST → 202 → GET → events → [DONE])
- [ ] Multi-turn with thread_id preservation
- [ ] Error recovery with retry
- [ ] Abort mid-stream

### Manual Testing

- [ ] Send message in sync mode
- [ ] Send message in distributed mode
- [ ] Multi-turn conversation (context preserved)
- [ ] Network disconnect recovery
- [ ] Stop generation button works

---

## Configuration

No frontend configuration changes required. The frontend automatically detects distributed mode from the 202 response.

Backend configuration (for reference):

| Variable | Default | Description |
|----------|---------|-------------|
| `DISTRIBUTED_WORKERS` | `false` | Enable distributed mode |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `STREAM_TIMEOUT_MS` | `60000` | Stream polling timeout |

---

## Migration Notes

### Backward Compatibility

- ✅ Existing sync flow continues to work unchanged
- ✅ No breaking changes to request payload format
- ✅ Same event format in both modes
- ✅ handleMessages() logic unchanged

### Frontend Detection

The frontend should **never** assume which mode is active. Always check the HTTP status code:

```typescript
if (response.status === 202) {
  // Distributed mode
} else if (response.status === 200) {
  // Sync mode
}
```

---

## References

- Backend FINAL_REPORT: `.claude/specs/feature-656-distributed-workers-taskiq/FINAL_REPORT.md`
- Council Review: `.claude/specs/feature-656-distributed-workers-taskiq/frontend/REVIEW.md`
- Implementation Tasks: `.claude/specs/feature-656-distributed-workers-taskiq/frontend/TASKS.md`
