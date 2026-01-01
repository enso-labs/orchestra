# PROPOSAL_BETA.md

## Agent Beta: The Clean Code Purist

**Focus**: Modularity, DRY principles, and seamless integration into the existing CLI structure without technical debt.

---

## High-Level Design Pattern

**Pattern**: **Repository + Adapter with Dependency Injection**

The design prioritizes:
1. **Single Responsibility**: Each module handles one concern
2. **Open/Closed Principle**: Extend via adapters, not modifications
3. **Dependency Inversion**: Core logic depends on abstractions, not concrete implementations
4. **Consistent Patterns**: Follow existing CLI conventions exactly

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI Layer                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │  chat.tsx   │   │  ask.tsx    │   │ stream.tsx  │               │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘               │
│         │                 │                 │                       │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                         │
│                  ┌─────────────────┐                               │
│                  │  useStream()    │  ← React Hook                 │
│                  └────────┬────────┘                               │
└───────────────────────────┼─────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Service Layer                                 │
│         ┌─────────────────────────────────────┐                     │
│         │         StreamService               │                     │
│         │  - connect(request): StreamHandle   │                     │
│         │  - abort(): void                    │                     │
│         └─────────────────┬───────────────────┘                     │
│                           │ implements                              │
│                           ▼                                         │
│         ┌─────────────────────────────────────┐                     │
│         │       IStreamService (interface)    │                     │
│         └─────────────────────────────────────┘                     │
└───────────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Adapter Layer                                 │
│  ┌────────────────────┐        ┌────────────────────┐              │
│  │   SSEAdapter       │        │   MockAdapter      │              │
│  │   (production)     │        │   (testing)        │              │
│  └────────────────────┘        └────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### 1. Type Definitions (Extending Existing Types)

```typescript
// cli/source/types/stream.ts

import type { Config } from './index.js';

/**
 * Stream event types matching backend SSE format
 * @see backend/src/utils/stream.py:handle_multi_mode
 */
export type StreamEventType = 'messages' | 'values' | 'error';

/**
 * Message chunk payload from 'messages' events
 */
export interface MessagePayload {
  id?: string;
  type: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  response_metadata?: Record<string, unknown>;
}

/**
 * Values chunk payload from 'values' events
 */
export interface ValuesPayload {
  messages: Array<Record<string, unknown>>;
  files?: Record<string, unknown>;
  todos?: Array<Record<string, unknown>>;
}

/**
 * Discriminated union for stream events
 */
export type StreamEvent =
  | { type: 'messages'; payload: MessagePayload; metadata?: unknown }
  | { type: 'values'; payload: ValuesPayload }
  | { type: 'error'; payload: { message: string } };

/**
 * Request body for /llm/stream endpoint
 * @see backend/src/schemas/entities/llm.py:LLMRequest
 */
export interface StreamRequest {
  input: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    files?: Record<string, unknown>;
  };
  model?: string;
  tools?: string[];
  metadata?: {
    assistant_id?: string;
    thread_id?: string;
    project_id?: string;
  };
}

/**
 * Stream handle for controlling active stream
 */
export interface StreamHandle {
  events: AsyncIterable<StreamEvent>;
  abort: () => void;
}
```

### 2. Service Interface (Dependency Inversion)

```typescript
// cli/source/lib/services/stream-service.interface.ts

import type { StreamRequest, StreamHandle } from '../../types/stream.js';

/**
 * Abstract interface for stream services.
 * Allows swapping implementations for testing or alternative backends.
 */
export interface IStreamService {
  /**
   * Establish a streaming connection to the LLM endpoint
   */
  connect(request: StreamRequest): Promise<StreamHandle>;
}
```

### 3. Concrete Service Implementation

```typescript
// cli/source/lib/services/stream-service.ts

import type { Config } from '../../types/index.js';
import type { StreamRequest, StreamHandle, StreamEvent } from '../../types/stream.js';
import type { IStreamService } from './stream-service.interface.js';

/**
 * Production stream service using SSE
 */
export class StreamService implements IStreamService {
  constructor(private readonly config: Config) {}

  async connect(request: StreamRequest): Promise<StreamHandle> {
    const controller = new AbortController();

    const response = await this.fetchStream(request, controller.signal);
    const events = this.parseEventStream(response.body!);

    return {
      events,
      abort: () => controller.abort(),
    };
  }

  private async fetchStream(
    request: StreamRequest,
    signal: AbortSignal
  ): Promise<Response> {
    const url = `${this.config.host.replace(/\/$/, '')}/api/llm/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new StreamConnectionError(error, response.status);
    }

    if (!response.body) {
      throw new StreamConnectionError('No response body', 0);
    }

    return response;
  }

  private async *parseEventStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<StreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = this.extractEvents(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private extractEvents(buffer: string): {
    parsed: StreamEvent[];
    remaining: string;
  } {
    const parsed: StreamEvent[] = [];
    const lines = buffer.split('\n');
    let remaining = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Incomplete line at end
      if (i === lines.length - 1 && !buffer.endsWith('\n')) {
        remaining = line;
        break;
      }

      if (line.startsWith('data: ')) {
        const event = this.parseEvent(line.slice(6));
        if (event) parsed.push(event);
      }
    }

    return { parsed, remaining };
  }

  private parseEvent(data: string): StreamEvent | null {
    try {
      const [type, payload] = JSON.parse(data) as [string, unknown];
      return { type, payload } as StreamEvent;
    } catch {
      return null;
    }
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const text = await response.text();
      const json = JSON.parse(text) as { detail?: string };
      return json.detail ?? `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

/**
 * Custom error for stream connection failures
 */
export class StreamConnectionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'StreamConnectionError';
  }
}
```

### 4. React Hook (Following CLI Patterns)

```typescript
// cli/source/hooks/useStream.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Config } from '../types/index.js';
import type { StreamRequest, StreamEvent, StreamHandle } from '../types/stream.js';
import { StreamService, StreamConnectionError } from '../lib/services/stream-service.js';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

export interface UseStreamResult {
  status: StreamStatus;
  events: StreamEvent[];
  error: string | null;
  abort: () => void;
}

/**
 * React hook for consuming LLM streams.
 * Follows existing CLI hook patterns (useEffect + state).
 */
export function useStream(
  config: Config | undefined,
  request: StreamRequest | undefined
): UseStreamResult {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<StreamHandle | null>(null);

  const abort = useCallback(() => {
    handleRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!config || !request) return;

    const service = new StreamService(config);
    let cancelled = false;

    const run = async () => {
      setStatus('connecting');
      setEvents([]);
      setError(null);

      try {
        const handle = await service.connect(request);
        handleRef.current = handle;

        if (cancelled) {
          handle.abort();
          return;
        }

        setStatus('streaming');

        for await (const event of handle.events) {
          if (cancelled) break;
          setEvents(prev => [...prev, event]);
        }

        setStatus('done');
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof StreamConnectionError
              ? err.message
              : 'Stream failed'
          );
          setStatus('error');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      handleRef.current?.abort();
    };
  }, [config, request]);

  return { status, events, error, abort };
}
```

### 5. Command Component (Consistent with Existing Commands)

```typescript
// cli/source/commands/chat.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { render, Text, Box, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { loadConfig } from '../lib/config.js';
import { useStream, type StreamStatus } from '../hooks/useStream.js';
import type { Config } from '../types/index.js';
import type { StreamRequest, StreamEvent } from '../types/stream.js';

// --- Component Props ---
interface ChatCommandProps {
  readonly assistantId: string;
  readonly message: string;
}

// --- Status Display Component ---
function StatusIndicator({ status }: { status: StreamStatus }) {
  switch (status) {
    case 'connecting':
      return (
        <Box>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text> Connecting...</Text>
        </Box>
      );
    case 'streaming':
      return (
        <Box>
          <Text color="green"><Spinner type="dots" /></Text>
          <Text> Streaming...</Text>
        </Box>
      );
    default:
      return null;
  }
}

// --- Content Extractor ---
function extractContent(events: StreamEvent[]): string {
  return events
    .filter((e): e is StreamEvent & { type: 'messages' } => e.type === 'messages')
    .map(e => e.payload.content ?? '')
    .join('');
}

// --- Main Command ---
function ChatCommand({ assistantId, message }: ChatCommandProps) {
  const { exit } = useApp();
  const [config, setConfig] = useState<Config | undefined>();
  const [authError, setAuthError] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig().then(cfg => {
      if (!cfg) {
        setAuthError(true);
        setTimeout(() => exit(), 100);
      } else {
        setConfig(cfg);
      }
    });
  }, [exit]);

  // Build request
  const request = useMemo<StreamRequest | undefined>(
    () =>
      config
        ? {
            input: { messages: [{ role: 'user', content: message }] },
            metadata: { assistant_id: assistantId },
          }
        : undefined,
    [config, assistantId, message]
  );

  // Stream
  const { status, events, error } = useStream(config, request);

  // Exit on completion
  useEffect(() => {
    if (status === 'done' || status === 'error') {
      setTimeout(() => exit(), 100);
    }
  }, [status, exit]);

  // Auth error
  if (authError) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Not authenticated.</Text>
        <Text>Run <Text bold>ruska auth</Text> to configure.</Text>
      </Box>
    );
  }

  // Stream error
  if (status === 'error') {
    return <Text color="red">Error: {error}</Text>;
  }

  // Render
  return (
    <Box flexDirection="column">
      <StatusIndicator status={status} />
      <Text>{extractContent(events)}</Text>
    </Box>
  );
}

// --- Export Runner (Following CLI Pattern) ---
export async function runChatCommand(
  assistantId: string,
  message: string
): Promise<void> {
  const { waitUntilExit } = render(
    <ChatCommand assistantId={assistantId} message={message} />
  );
  await waitUntilExit();
}
```

### 6. CLI Integration (Minimal Changes)

```typescript
// cli/source/cli.tsx (additions to switch statement)

import { runChatCommand } from './commands/chat.js';

// Add to meow config:
//   chat <id> <message>   Chat with an assistant

// Add to switch:
case 'chat': {
  const [assistantId, ...messageParts] = args;
  const message = messageParts.join(' ');

  if (!assistantId || !message) {
    console.error('Usage: ruska chat <assistant-id> "<message>"');
    process.exit(1);
  }

  await runChatCommand(assistantId, message);
  break;
}
```

---

## Code Quality Principles Applied

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | `StreamService` handles connection, `useStream` manages React state |
| **Open/Closed** | Add new stream adapters without modifying core |
| **Liskov Substitution** | `IStreamService` allows mock injection |
| **Interface Segregation** | Minimal `StreamHandle` interface |
| **Dependency Inversion** | Hook depends on interface, not concrete class |
| **DRY** | Shared types, reusable hook, existing patterns |

---

## File Structure

```
cli/source/
├── commands/
│   └── chat.tsx                 # New command (follows assistant.tsx pattern)
├── hooks/
│   └── useStream.ts             # Reusable stream hook
├── lib/
│   ├── services/
│   │   ├── stream-service.interface.ts
│   │   └── stream-service.ts
│   ├── api.ts                   # Existing (unchanged)
│   └── config.ts                # Existing (unchanged)
└── types/
    ├── index.ts                 # Existing (unchanged)
    └── stream.ts                # New stream types
```

---

## Testing Strategy

```typescript
// cli/source/__tests__/stream-service.test.ts

import { describe, it, expect, vi } from 'vitest';
import { StreamService } from '../lib/services/stream-service.js';

describe('StreamService', () => {
  it('should parse SSE events correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createMockStream([
        'data: ["messages", {"content": "Hello"}]\n\n',
        'data: ["values", {"messages": []}]\n\n',
      ]),
    });

    global.fetch = mockFetch;

    const service = new StreamService({ host: 'http://test', apiKey: 'key' });
    const { events } = await service.connect({ input: { messages: [] } });

    const collected = [];
    for await (const event of events) {
      collected.push(event);
    }

    expect(collected).toHaveLength(2);
    expect(collected[0].type).toBe('messages');
  });
});
```

---

## Summary

This proposal prioritizes **maintainability** and **consistency** by:
1. Following existing CLI patterns exactly (React hooks, render/waitUntilExit)
2. Using dependency injection for testability
3. Separating concerns into discrete, focused modules
4. Extending the type system rather than creating parallel structures
5. Minimizing changes to existing files

The design ensures the new streaming functionality integrates seamlessly without introducing technical debt or divergent patterns.
