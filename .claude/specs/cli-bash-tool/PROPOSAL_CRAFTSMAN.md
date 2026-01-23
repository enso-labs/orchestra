# Implementation Proposal: Local Bash Tool for `ruska chat` CLI

**Author:** AGENT_2 (CRAFTSMAN)
**Expertise Lens:** Clean Code, Maintainability, SOLID Principles
**Date:** 2026-01-22

---

## 1. Executive Summary

Implement a `bash_tool` capability that executes shell commands locally on the user's machine when invoked through the `ruska chat` CLI. This requires intercepting tool call events from the backend's SSE stream, executing matching commands locally via Node.js child processes, and sending results back to the LLM for continued reasoning. The implementation follows a client-side tool execution pattern with explicit user opt-in for security.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Tool Execution Flow (Current):**
```
User Input --> CLI --> Backend API --> LLM --> Tool Calls
                                              |
                                              v
                                    Backend executes tools
                                              |
                                              v
                                    Tool results --> LLM --> Response
                                              |
                                              v
                            CLI displays streamed response
```

**Key Observations:**

1. **Tools are names, not implementations**: The CLI sends tool names (e.g., `web_search`, `python_sandbox`) to the backend via the `tools` field in `StreamRequest`. The backend resolves these names to actual tool implementations.

2. **Stream events include tool_calls**: The `MessagePayload` type already defines `tool_calls` with `id`, `name`, and `args` fields, but the CLI currently ignores them (see `chat.tsx:336`).

3. **Existing remote shell tool**: `backend/src/tools/shell.py` implements `shell_exec` as a remote tool requiring `SHELL_EXEC_SERVER_URL`. This is architecturally different from local execution.

4. **No client-side tool execution**: The CLI is purely a display layer; all tool execution happens server-side.

5. **Stream service is well-abstracted**: `StreamService` handles SSE parsing with clear event types (`messages`, `values`, `error`, `metadata`, `done`).

### 2.2 Proposed Changes

**New Tool Execution Flow:**
```
User Input --> CLI --> Backend API --> LLM --> Tool Calls
                                              |
                                              v
                                    Backend streams tool_call event
                                              |
                                              v
                        CLI intercepts bash_tool calls
                                              |
                                              v
                            Local execution via child_process
                                              |
                                              v
                        CLI sends tool result to backend
                                              |
                                              v
                                    LLM continues with result
```

**Architectural Decisions:**

1. **Client-side tool execution pattern**: Unlike backend tools, `bash_tool` executes on the user's machine. This requires the CLI to:
   - Detect `bash_tool` invocations in the stream
   - Execute commands locally
   - Submit results back to the LLM conversation

2. **Explicit opt-in required**: For security, local command execution must be explicitly enabled via a new `--local-tools` or `--bash` flag.

3. **Hybrid tool model**: The CLI will support both:
   - Server-side tools (existing behavior)
   - Client-side tools (new `bash_tool`)

### 2.3 Integration Points

| Component | Integration Type | Description |
|-----------|-----------------|-------------|
| `cli.tsx` | Flag addition | New `--bash` or `--local-tools` flag |
| `chat.tsx` | Event handling | Intercept tool_call events for local execution |
| `use-stream.ts` | State management | Track pending local tool calls |
| `stream-service.ts` | No changes | Existing parsing handles tool_calls |
| `types/stream.ts` | Type extension | Add `LocalToolCall` type if needed |
| New: `lib/local-tools/` | New module | Local tool executor abstraction |
| New: `lib/local-tools/bash-executor.ts` | New file | Bash command execution logic |

### 2.4 Dependencies

- **Node.js `child_process`**: For spawning shell commands
- **Existing stream infrastructure**: No external dependencies needed
- **Backend conversation continuation**: Need to POST tool results back to continue the conversation

---

## 3. Implementation Strategy

### 3.1 Phase 1: Foundation (Low Risk)

**Step 1.1: Create local tools module structure**

```
cli/source/lib/local-tools/
  index.ts              # Public exports
  types.ts              # Type definitions
  executor.ts           # Base executor interface
  bash-executor.ts      # Bash-specific implementation
```

**Step 1.2: Define types**

```typescript
// cli/source/lib/local-tools/types.ts

export type LocalToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type LocalToolResult = {
  tool_call_id: string;
  output: string;
  error?: string;
  exit_code?: number;
};

export type BashToolArgs = {
  command: string;
  working_directory?: string;
  timeout_ms?: number;
};

export type LocalToolExecutorOptions = {
  timeout_ms: number;
  max_output_bytes: number;
  allow_interactive: boolean;
};
```

**Step 1.3: Implement bash executor**

```typescript
// cli/source/lib/local-tools/bash-executor.ts

import {exec} from 'node:child_process';
import {promisify} from 'node:util';
import type {LocalToolResult, BashToolArgs, LocalToolExecutorOptions} from './types.js';

const execAsync = promisify(exec);

const DEFAULT_OPTIONS: LocalToolExecutorOptions = {
  timeout_ms: 30_000,
  max_output_bytes: 1_000_000, // 1MB
  allow_interactive: false,
};

export class BashExecutor {
  private readonly options: LocalToolExecutorOptions;

  constructor(options: Partial<LocalToolExecutorOptions> = {}) {
    this.options = {...DEFAULT_OPTIONS, ...options};
  }

  async execute(toolCallId: string, args: BashToolArgs): Promise<LocalToolResult> {
    const {command, working_directory, timeout_ms} = args;
    const timeout = timeout_ms ?? this.options.timeout_ms;

    try {
      const {stdout, stderr} = await execAsync(command, {
        cwd: working_directory ?? process.cwd(),
        timeout,
        maxBuffer: this.options.max_output_bytes,
      });

      return {
        tool_call_id: toolCallId,
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        exit_code: 0,
      };
    } catch (error: unknown) {
      return this.handleError(toolCallId, error);
    }
  }

  private handleError(toolCallId: string, error: unknown): LocalToolResult {
    if (error instanceof Error && 'code' in error) {
      const execError = error as Error & {code: number; stdout: string; stderr: string};
      return {
        tool_call_id: toolCallId,
        output: execError.stdout || '',
        error: execError.stderr || execError.message,
        exit_code: execError.code,
      };
    }

    return {
      tool_call_id: toolCallId,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      exit_code: 1,
    };
  }
}
```

### 3.2 Phase 2: Stream Integration (Medium Risk)

**Step 2.1: Extend chat command to handle local tool calls**

Modify `chat.tsx` to:
1. Accept `--bash` flag
2. Intercept tool_call events for `bash_tool`
3. Execute locally and continue conversation

**Step 2.2: Create local tool orchestrator**

```typescript
// cli/source/lib/local-tools/orchestrator.ts

import {BashExecutor} from './bash-executor.js';
import type {LocalToolCall, LocalToolResult} from './types.js';

export class LocalToolOrchestrator {
  private readonly bashExecutor: BashExecutor;
  private readonly enabledTools: Set<string>;

  constructor(enabledTools: string[] = ['bash_tool']) {
    this.bashExecutor = new BashExecutor();
    this.enabledTools = new Set(enabledTools);
  }

  isLocalTool(toolName: string): boolean {
    return this.enabledTools.has(toolName);
  }

  async execute(toolCall: LocalToolCall): Promise<LocalToolResult> {
    switch (toolCall.name) {
      case 'bash_tool':
        return this.bashExecutor.execute(toolCall.id, toolCall.args as BashToolArgs);
      default:
        return {
          tool_call_id: toolCall.id,
          output: '',
          error: `Unknown local tool: ${toolCall.name}`,
          exit_code: 1,
        };
    }
  }
}
```

**Step 2.3: Modify stream handling**

The key insight is that when a `tool_call` for `bash_tool` is detected, the CLI needs to:

1. Execute the command locally
2. Send the result back to the backend
3. Continue consuming the stream with the new result

This requires either:
- **Option A**: Multi-turn conversation (POST tool result, start new stream)
- **Option B**: WebSocket bidirectional communication (not currently supported)
- **Option C**: Tool result callback endpoint (requires backend changes)

**Recommended: Option A (Multi-turn conversation)**

### 3.3 Phase 3: Conversation Continuation (Higher Complexity)

**Step 3.1: Extend StreamRequest to support tool results**

```typescript
// Extend types/stream.ts

export type ToolResultMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

export type StreamRequest = {
  input: {
    messages: Array<
      {role: 'user' | 'assistant' | 'system'; content: string} | ToolResultMessage
    >;
    files?: Record<string, unknown>;
  };
  // ... existing fields
};
```

**Step 3.2: Implement conversation continuation**

```typescript
// cli/source/lib/local-tools/conversation-manager.ts

import type {Config} from '../../types/index.js';
import type {StreamRequest, StreamEvent} from '../../types/stream.js';
import {StreamService} from '../services/stream-service.js';
import type {LocalToolResult} from './types.js';

export class ConversationManager {
  private readonly config: Config;
  private readonly baseRequest: StreamRequest;
  private conversationHistory: StreamRequest['input']['messages'];

  constructor(config: Config, request: StreamRequest) {
    this.config = config;
    this.baseRequest = request;
    this.conversationHistory = [...request.input.messages];
  }

  async continueWithToolResult(
    toolResult: LocalToolResult,
    assistantMessage: Record<string, unknown>
  ): AsyncGenerator<StreamEvent> {
    // Add assistant's tool call message to history
    this.conversationHistory.push({
      role: 'assistant',
      content: JSON.stringify(assistantMessage),
    });

    // Add tool result to history
    this.conversationHistory.push({
      role: 'tool',
      tool_call_id: toolResult.tool_call_id,
      content: toolResult.error
        ? `Error: ${toolResult.error}\n${toolResult.output}`
        : toolResult.output,
    });

    // Create new request with full history
    const continuationRequest: StreamRequest = {
      ...this.baseRequest,
      input: {
        ...this.baseRequest.input,
        messages: this.conversationHistory,
      },
    };

    // Start new stream
    const service = new StreamService(this.config);
    const handle = await service.connect(continuationRequest);
    yield* handle.events;
  }
}
```

### 3.4 Phase 4: CLI Integration

**Step 4.1: Update cli.tsx**

```typescript
// Add new flag
tools: {
  type: 'string',
},
bash: {
  type: 'boolean',
  default: false,
},
```

**Step 4.2: Update chat.tsx**

Create a new component or modify existing to handle local tool execution:

```typescript
// Key changes to ChatCommandTui

function ChatCommandTui({
  message,
  assistantId,
  threadId,
  tools,
  enableBash,  // New prop
  truncateOptions,
}: Omit<ChatCommandProperties, 'isJsonMode'> & {enableBash?: boolean}) {
  const [localToolOrchestrator] = useState(() =>
    enableBash ? new LocalToolOrchestrator() : null
  );
  const [pendingToolCall, setPendingToolCall] = useState<LocalToolCall | null>(null);
  const [executingTool, setExecutingTool] = useState(false);

  // Handle tool calls in stream processing
  useEffect(() => {
    // When a tool_call event arrives for bash_tool
    // and localToolOrchestrator is enabled:
    // 1. Set pendingToolCall
    // 2. Execute locally
    // 3. Continue conversation with result
  }, [messages, localToolOrchestrator]);

  // ... rest of component
}
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Why Chosen |
|----------|-------------|------------|
| Multi-turn continuation | WebSocket bidirectional | Simpler implementation; works with existing SSE infrastructure |
| Explicit `--bash` flag | Auto-detect bash_tool | Security: explicit opt-in prevents accidental command execution |
| Client-side execution only | Backend + client hybrid | Clear separation of concerns; no backend changes needed |
| Promise-based executor | Stream-based output | Simpler API; most commands complete quickly |
| Timeout per command | Global timeout | More flexible; allows long-running commands when needed |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Backend-only solution (like existing shell_exec)**
- Rejected because: Requires separate server, defeats purpose of "local" execution, adds deployment complexity

**Alternative 2: Full CLI agent framework**
- Rejected because: Over-engineering; CLI should remain a thin client

**Alternative 3: MCP (Model Context Protocol) integration**
- Considered but deferred: MCP is a good long-term direction, but adds complexity. Can be added later as the protocol matures.

### 4.3 Alignment with Existing Codebase Patterns

1. **Module structure**: Follows existing `lib/` organization pattern
2. **Type-first design**: Matches TypeScript-heavy approach in codebase
3. **Service abstraction**: BashExecutor mirrors StreamService pattern
4. **Hook-based state**: ConversationManager could integrate with useStream pattern
5. **Flag parsing**: Uses existing meow-based CLI flag infrastructure

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| Security: arbitrary command execution | Critical | Require explicit `--bash` flag; never auto-enable |
| Infinite loops: LLM repeatedly calls bash | High | Implement call depth limit (max 10 tool calls per turn) |
| Output size: large command output | Medium | Truncate output; configurable max bytes |
| Timeout: hanging commands | Medium | Default 30s timeout; configurable |
| Shell injection: malformed args | High | Validate command structure; use spawn vs exec for complex cases |
| Cross-platform: Windows vs Unix | Medium | Use platform-aware shell detection; document limitations |

### 5.2 Edge Cases to Handle

1. **Interactive commands**: Reject or handle stdin requirements
2. **Background processes**: Prevent `&` or document behavior
3. **Environment variables**: Inherit from CLI process; document
4. **Working directory**: Default to CLI cwd; allow override
5. **Multi-line commands**: Support via shell interpretation
6. **Binary output**: Detect and truncate/skip
7. **Ctrl+C during execution**: Proper cleanup of child processes
8. **Network-dependent commands**: Handle timeouts gracefully

### 5.3 Testing Considerations

**Unit Tests (Priority: High)**
- BashExecutor with mock child_process
- LocalToolOrchestrator dispatch logic
- Command timeout behavior
- Error handling for failed commands
- Output truncation

**Integration Tests (Priority: Medium)**
- End-to-end tool call flow (mocked backend)
- Conversation continuation
- Multiple sequential tool calls

**Manual Tests (Priority: High)**
- Real command execution (`ls`, `pwd`, `echo`)
- Long-running commands (timeout behavior)
- Commands with large output
- Error conditions (invalid commands)

---

## 6. Estimated Complexity

### Scope: **Medium**

This is a contained feature with clear boundaries:
- Does not require backend changes
- Builds on existing stream infrastructure
- Limited surface area (single tool type initially)

### Risk Level: **Medium-High**

Security implications of local command execution warrant careful review:
- Requires explicit user consent
- Must handle all error cases
- Cross-platform considerations

### Suggested Implementation Priority

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1: Foundation | P0 | 2-3 days | None |
| Phase 2: Stream Integration | P0 | 3-4 days | Phase 1 |
| Phase 3: Conversation Continuation | P0 | 2-3 days | Phase 2 |
| Phase 4: CLI Integration | P0 | 1-2 days | Phase 3 |
| **Total** | | **8-12 days** | |

### File Changes Summary

**New Files:**
```
cli/source/lib/local-tools/index.ts
cli/source/lib/local-tools/types.ts
cli/source/lib/local-tools/bash-executor.ts
cli/source/lib/local-tools/orchestrator.ts
cli/source/lib/local-tools/conversation-manager.ts
cli/source/__tests__/bash-executor.test.ts
cli/source/__tests__/orchestrator.test.ts
```

**Modified Files:**
```
cli/source/cli.tsx                    # Add --bash flag
cli/source/commands/chat.tsx          # Handle local tool execution
cli/source/types/stream.ts            # Add ToolResultMessage type
cli/source/lib/tools.ts               # Add bash_tool to available tools
```

---

## 7. Security Considerations

### 7.1 Required Safeguards

1. **Explicit Opt-in**: Must use `--bash` flag; never default-enabled
2. **User Confirmation (Optional Enhancement)**: For destructive commands, prompt before execution
3. **Blocklist Patterns**: Consider blocking dangerous patterns (rm -rf /, etc.)
4. **Audit Trail**: Log executed commands for debugging
5. **Sandboxing (Future)**: Consider container-based execution for higher security

### 7.2 Documentation Requirements

- Clear warning about security implications
- Examples of safe vs. risky usage
- Guidance on when to use `--bash` vs. backend tools

---

## 8. Open Questions for Product/Team

1. **Confirmation prompts**: Should destructive commands require user confirmation?
2. **Default timeout**: Is 30 seconds appropriate for most use cases?
3. **Output format**: Should tool output be formatted differently from LLM responses?
4. **Cross-platform priority**: Which platforms must be supported at launch?
5. **Shell preference**: Should users be able to specify shell (bash, zsh, sh)?

---

## 9. Appendix: Backend Considerations

While this proposal focuses on CLI-only changes, future enhancements may benefit from backend support:

### Potential Backend Enhancements (Out of Scope)

1. **Tool result endpoint**: `POST /api/tools/{tool_call_id}/result` for submitting local tool results
2. **Streaming acknowledgment**: Backend signals readiness to receive tool results
3. **Tool registry**: Backend maintains list of client-executable tools

These would enable more seamless integration but are not required for MVP.

---

## 10. Conclusion

The proposed implementation adds local bash command execution to the `ruska chat` CLI with:

- **Clean separation**: Local tools module isolated from stream logic
- **Explicit security**: Opt-in flag requirement
- **Minimal coupling**: No backend changes required
- **Extensibility**: Orchestrator pattern allows adding more local tools later

The multi-turn conversation approach leverages existing SSE infrastructure while maintaining the CLI's stateless nature. This aligns with the codebase's TypeScript-first, service-oriented architecture.
