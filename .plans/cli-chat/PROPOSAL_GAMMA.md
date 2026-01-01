# PROPOSAL_GAMMA.md

## Agent Gamma: The DX/UX Specialist

**Focus**: Output format, error handling, predictable JSON output, and downstream consumption patterns.

---

## High-Level Design Pattern

**Pattern**: **Progressive Disclosure with Machine-Readable Output Modes**

The design prioritizes:
1. **Dual output modes**: Human-friendly TUI vs machine-parseable NDJSON
2. **Structured error taxonomy**: Typed errors with actionable messages
3. **Predictable stream contract**: Well-defined output schema for piping
4. **Graceful degradation**: Partial output preservation on failure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Output Modes                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ruska chat <id> "prompt"                ruska chat <id> "prompt" --json   │
│         │                                           │                        │
│         ▼                                           ▼                        │
│   ┌─────────────┐                           ┌─────────────┐                 │
│   │  TUI Mode   │                           │  JSON Mode  │                 │
│   │  (default)  │                           │  (piping)   │                 │
│   └─────────────┘                           └─────────────┘                 │
│         │                                           │                        │
│         ▼                                           ▼                        │
│   ┌─────────────┐                           ┌─────────────┐                 │
│   │ • Spinner   │                           │ NDJSON      │                 │
│   │ • Colors    │                           │ One object  │                 │
│   │ • Progress  │                           │ per line    │                 │
│   └─────────────┘                           └─────────────┘                 │
│                                                                              │
│   Example:                                  Example:                         │
│   ⠋ Streaming...                            {"type":"chunk","content":"Hi"}  │
│   Hello! How can I help?                    {"type":"chunk","content":"!"}   │
│   ✓ Done                                    {"type":"done","final":"Hi!"}    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Output Schema Contract

### JSON Mode Output (NDJSON - Newline Delimited JSON)

Each line is a complete, parseable JSON object:

```typescript
// cli/source/types/output.ts

/**
 * Base envelope for all output events
 */
interface OutputEnvelope {
  timestamp: string;   // ISO 8601
  sequence: number;    // Monotonic counter
}

/**
 * Content chunk during streaming
 */
interface ChunkOutput extends OutputEnvelope {
  type: 'chunk';
  content: string;
  metadata?: {
    model?: string;
    finish_reason?: string;
  };
}

/**
 * Tool call event
 */
interface ToolCallOutput extends OutputEnvelope {
  type: 'tool_call';
  tool: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * Tool result event
 */
interface ToolResultOutput extends OutputEnvelope {
  type: 'tool_result';
  tool_call_id: string;
  content: string;
}

/**
 * Final aggregated response
 */
interface DoneOutput extends OutputEnvelope {
  type: 'done';
  final: string;           // Complete response text
  token_count?: number;
  duration_ms: number;
}

/**
 * Error event (stream continues after recoverable errors)
 */
interface ErrorOutput extends OutputEnvelope {
  type: 'error';
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
}

/**
 * Typed error codes for programmatic handling
 */
type ErrorCode =
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'STREAM_INTERRUPTED'
  | 'PARSE_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT';

/**
 * Union of all output types
 */
type StreamOutput =
  | ChunkOutput
  | ToolCallOutput
  | ToolResultOutput
  | DoneOutput
  | ErrorOutput;
```

### Example JSON Output Session

```bash
$ ruska chat abc-123 "What is 2+2?" --json

{"type":"chunk","content":"The","timestamp":"2024-01-01T12:00:00.000Z","sequence":1}
{"type":"chunk","content":" answer","timestamp":"2024-01-01T12:00:00.050Z","sequence":2}
{"type":"chunk","content":" is","timestamp":"2024-01-01T12:00:00.100Z","sequence":3}
{"type":"chunk","content":" 4.","timestamp":"2024-01-01T12:00:00.150Z","sequence":4}
{"type":"done","final":"The answer is 4.","duration_ms":150,"timestamp":"2024-01-01T12:00:00.151Z","sequence":5}
```

---

## Implementation Strategy

### 1. Output Formatter Module

```typescript
// cli/source/lib/output/formatter.ts

import type { StreamOutput, ErrorCode } from '../../types/output.js';

export class OutputFormatter {
  private sequence = 0;
  private startTime = Date.now();
  private accumulated = '';

  /**
   * Format a content chunk
   */
  chunk(content: string, metadata?: Record<string, unknown>): StreamOutput {
    this.accumulated += content;
    return {
      type: 'chunk',
      content,
      metadata,
      timestamp: this.timestamp(),
      sequence: ++this.sequence,
    };
  }

  /**
   * Format a tool call
   */
  toolCall(
    id: string,
    name: string,
    args: Record<string, unknown>
  ): StreamOutput {
    return {
      type: 'tool_call',
      tool: { id, name, arguments: args },
      timestamp: this.timestamp(),
      sequence: ++this.sequence,
    };
  }

  /**
   * Format the final done event
   */
  done(): StreamOutput {
    return {
      type: 'done',
      final: this.accumulated,
      duration_ms: Date.now() - this.startTime,
      timestamp: this.timestamp(),
      sequence: ++this.sequence,
    };
  }

  /**
   * Format an error
   */
  error(code: ErrorCode, message: string, recoverable = false): StreamOutput {
    return {
      type: 'error',
      code,
      message,
      recoverable,
      timestamp: this.timestamp(),
      sequence: ++this.sequence,
    };
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}
```

### 2. Error Handler with Taxonomy

```typescript
// cli/source/lib/output/error-handler.ts

import type { ErrorCode } from '../../types/output.js';

interface ErrorMapping {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  exitCode: number;
}

/**
 * Map raw errors to structured error responses
 */
export function classifyError(error: unknown): ErrorMapping {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch failed') ||
        error.message.includes('ECONNREFUSED')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Check your network and host configuration.',
        recoverable: false,
        exitCode: 1,
      };
    }

    // Auth errors
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return {
        code: 'AUTH_FAILED',
        message: 'Authentication failed. Run `ruska auth` to reconfigure.',
        recoverable: false,
        exitCode: 2,
      };
    }

    // Rate limiting
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please wait before retrying.',
        recoverable: true,
        exitCode: 3,
      };
    }

    // Timeout
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out. The server may be overloaded.',
        recoverable: true,
        exitCode: 4,
      };
    }

    // Server errors
    if (error.message.includes('5')) {
      return {
        code: 'SERVER_ERROR',
        message: `Server error: ${error.message}`,
        recoverable: true,
        exitCode: 5,
      };
    }
  }

  // Default
  return {
    code: 'STREAM_INTERRUPTED',
    message: error instanceof Error ? error.message : 'Unknown error',
    recoverable: false,
    exitCode: 1,
  };
}

/**
 * Exit codes for scripting
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  NETWORK_ERROR: 1,
  AUTH_FAILED: 2,
  RATE_LIMITED: 3,
  TIMEOUT: 4,
  SERVER_ERROR: 5,
} as const;
```

### 3. Stream-to-Output Transformer

```typescript
// cli/source/lib/output/stream-transformer.ts

import type { StreamEvent } from '../../types/stream.js';
import type { StreamOutput } from '../../types/output.js';
import { OutputFormatter } from './formatter.js';

/**
 * Transform backend SSE events to CLI output format
 */
export class StreamTransformer {
  private formatter = new OutputFormatter();

  /**
   * Transform a backend event to output event(s)
   */
  transform(event: StreamEvent): StreamOutput[] {
    const outputs: StreamOutput[] = [];

    switch (event.type) {
      case 'messages': {
        const payload = event.payload;

        // Handle text content
        if (payload.content && typeof payload.content === 'string') {
          outputs.push(this.formatter.chunk(payload.content));
        }

        // Handle tool calls
        if (payload.tool_calls) {
          for (const tc of payload.tool_calls) {
            outputs.push(this.formatter.toolCall(tc.id, tc.name, tc.args));
          }
        }
        break;
      }

      case 'values': {
        // Values events indicate completion - extract final state if needed
        // Usually followed by stream end
        break;
      }

      case 'error': {
        outputs.push(
          this.formatter.error('SERVER_ERROR', event.payload.message, false)
        );
        break;
      }
    }

    return outputs;
  }

  /**
   * Generate the final done event
   */
  finalize(): StreamOutput {
    return this.formatter.done();
  }
}
```

### 4. Output Writers

```typescript
// cli/source/lib/output/writers.ts

import type { StreamOutput } from '../../types/output.js';

/**
 * Write output in JSON mode (NDJSON to stdout)
 */
export function writeJson(output: StreamOutput): void {
  process.stdout.write(JSON.stringify(output) + '\n');
}

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
  return process.stdout.isTTY ?? false;
}
```

### 5. TUI Component with Progressive Display

```typescript
// cli/source/commands/chat.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { render, Text, Box, useApp, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { loadConfig } from '../lib/config.js';
import { StreamService } from '../lib/services/stream-service.js';
import { StreamTransformer } from '../lib/output/stream-transformer.js';
import { classifyError, EXIT_CODES } from '../lib/output/error-handler.js';
import { writeJson, isTTY } from '../lib/output/writers.js';
import type { Config } from '../types/index.js';
import type { StreamOutput } from '../types/output.js';

interface ChatCommandProps {
  readonly assistantId: string;
  readonly message: string;
  readonly jsonMode: boolean;
}

type Status = 'loading' | 'streaming' | 'done' | 'error';

function ChatCommand({ assistantId, message, jsonMode }: ChatCommandProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [status, setStatus] = useState<Status>('loading');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let exitCode = EXIT_CODES.SUCCESS;

    const run = async () => {
      // Load config
      const config = await loadConfig();
      if (!config) {
        if (jsonMode) {
          const transformer = new StreamTransformer();
          writeJson(transformer.formatter.error('AUTH_FAILED', 'Not authenticated', false));
        }
        setError('Not authenticated. Run `ruska auth` to configure.');
        setStatus('error');
        exitCode = EXIT_CODES.AUTH_FAILED;
        return;
      }

      const service = new StreamService(config);
      const transformer = new StreamTransformer();

      try {
        const handle = await service.connect({
          input: { messages: [{ role: 'user', content: message }] },
          metadata: { assistant_id: assistantId },
        });

        setStatus('streaming');

        for await (const event of handle.events) {
          const outputs = transformer.transform(event);

          for (const output of outputs) {
            if (jsonMode) {
              writeJson(output);
            } else if (output.type === 'chunk') {
              setContent(prev => prev + output.content);
            }
          }
        }

        // Finalize
        const done = transformer.finalize();
        if (jsonMode) {
          writeJson(done);
        }
        setStatus('done');

      } catch (err) {
        const classified = classifyError(err);

        if (jsonMode) {
          writeJson(
            transformer.formatter.error(
              classified.code,
              classified.message,
              classified.recoverable
            )
          );
        }

        setError(classified.message);
        setStatus('error');
        exitCode = classified.exitCode;
      }
    };

    run().finally(() => {
      setTimeout(() => {
        process.exitCode = exitCode;
        exit();
      }, 100);
    });
  }, [assistantId, message, jsonMode, exit]);

  // JSON mode: no UI
  if (jsonMode) {
    return null;
  }

  // TUI mode
  return (
    <Box flexDirection="column">
      {/* Status indicator */}
      {status === 'loading' && (
        <Box>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text> Connecting...</Text>
        </Box>
      )}

      {status === 'streaming' && (
        <Box>
          <Text color="green"><Spinner type="dots" /></Text>
          <Text> Streaming...</Text>
        </Box>
      )}

      {/* Content */}
      {content && (
        <Box marginTop={1}>
          <Text>{content}</Text>
        </Box>
      )}

      {/* Done indicator */}
      {status === 'done' && (
        <Box marginTop={1}>
          <Text color="green">✓ Done</Text>
        </Box>
      )}

      {/* Error display */}
      {status === 'error' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">✗ Error</Text>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}

export async function runChatCommand(
  assistantId: string,
  message: string,
  options: { json?: boolean } = {}
): Promise<void> {
  // Auto-detect: use JSON mode if not TTY (piped)
  const jsonMode = options.json ?? !isTTY();

  const { waitUntilExit } = render(
    <ChatCommand
      assistantId={assistantId}
      message={message}
      jsonMode={jsonMode}
    />
  );
  await waitUntilExit();
}
```

### 6. CLI Flags for Output Control

```typescript
// cli/source/cli.tsx (additions)

// Add to meow flags:
{
  json: {
    type: 'boolean',
    default: false,
    description: 'Output as newline-delimited JSON',
  },
  quiet: {
    type: 'boolean',
    shortFlag: 'q',
    default: false,
    description: 'Suppress progress indicators',
  },
}

// Help text addition:
`
  Chat Options
    --json            Output newline-delimited JSON (auto-enabled when piped)
    -q, --quiet       Suppress progress indicators

  Examples
    $ ruska chat abc-123 "Hello"                    # Interactive mode
    $ ruska chat abc-123 "Hello" --json             # JSON output
    $ ruska chat abc-123 "Hello" | jq '.content'    # Pipe to jq
    $ ruska chat abc-123 "Hello" 2>/dev/null        # Suppress errors
`
```

---

## Downstream Consumption Patterns

### Piping to jq

```bash
# Extract only content chunks
ruska chat abc-123 "Explain AI" --json | jq -r 'select(.type=="chunk") | .content'

# Get final response only
ruska chat abc-123 "Explain AI" --json | jq -r 'select(.type=="done") | .final'

# Monitor for errors
ruska chat abc-123 "Explain AI" --json | jq -c 'select(.type=="error")'
```

### Scripting with Exit Codes

```bash
#!/bin/bash
if ruska chat abc-123 "Test" --json > /tmp/output.json 2>&1; then
  echo "Success"
  jq '.final' /tmp/output.json
else
  case $? in
    2) echo "Auth failed - run: ruska auth" ;;
    3) echo "Rate limited - waiting..." && sleep 60 ;;
    *) echo "Unknown error" ;;
  esac
fi
```

### Integration with Other Tools

```bash
# Real-time processing with process substitution
while IFS= read -r line; do
  type=$(echo "$line" | jq -r '.type')
  case "$type" in
    chunk) echo -n "$(echo "$line" | jq -r '.content')" ;;
    done)  echo -e "\n--- Complete ---" ;;
    error) echo "ERROR: $(echo "$line" | jq -r '.message')" >&2 ;;
  esac
done < <(ruska chat abc-123 "Tell me a story" --json)
```

---

## Error UX Examples

### TUI Mode Errors

```
$ ruska chat abc-123 "Hello"

⠋ Connecting...
✗ Error
Authentication failed. Run `ruska auth` to reconfigure.
```

### JSON Mode Errors

```bash
$ ruska chat abc-123 "Hello" --json
{"type":"error","code":"AUTH_FAILED","message":"Authentication failed. Run `ruska auth` to reconfigure.","recoverable":false,"timestamp":"2024-01-01T12:00:00.000Z","sequence":1}
$ echo $?
2
```

---

## File Structure

```
cli/source/
├── commands/
│   └── chat.tsx               # Dual-mode chat command
├── lib/
│   ├── output/
│   │   ├── formatter.ts       # Output event formatting
│   │   ├── stream-transformer.ts  # SSE → Output conversion
│   │   ├── error-handler.ts   # Error classification
│   │   └── writers.ts         # stdout writers
│   └── services/
│       └── stream-service.ts  # SSE consumer
└── types/
    ├── output.ts              # Output schema types
    └── stream.ts              # Stream event types
```

---

## Summary

This proposal prioritizes **predictability** and **downstream usability** by:
1. Providing a strict NDJSON output contract for piping
2. Implementing typed error codes with meaningful exit codes
3. Auto-detecting TTY vs piped mode for appropriate output
4. Ensuring every output event has timestamps and sequence numbers
5. Separating human-readable TUI from machine-readable JSON

The design ensures the CLI output can be reliably consumed by scripts, monitoring tools, and other CLI utilities without parsing ambiguity.
