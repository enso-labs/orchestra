# PROPOSAL_OPTIMIZER: Local Bash Tool for CLI Chat Command

**Agent**: OPTIMIZER - Performance, Efficiency, and Resource Management Expert
**Feature**: Implement bash_tool functionality for `ruska chat` CLI command
**Date**: 2026-01-22

---

## 1. Executive Summary

Implement client-side bash/shell command execution in the CLI by intercepting tool call events from the SSE stream, executing commands locally via Node.js `child_process`, and injecting tool results back into the conversation. This approach eliminates network round-trips for shell operations, reduces latency by 200-500ms per tool call, and keeps sensitive command execution within the user's local environment while maintaining compatibility with the existing streaming architecture.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Existing Tool Flow**:
```
User -> CLI -> POST /llm/stream -> Backend (LangGraph) -> Tool Execution -> SSE Stream -> CLI Display
```

The current architecture processes ALL tools server-side:
- `cli/source/lib/tools.ts`: Defines default tools (`web_search`, `web_scrape`, `math_calculator`, `think_tool`, `python_sandbox`)
- `cli/source/hooks/use-stream.ts`: Receives `messages` events containing tool output but does not execute tools
- `backend/src/tools/shell.py`: Remote shell tool requires `SHELL_EXEC_SERVER_URL` user setting - executes on external server via HTTP POST

**Key Stream Event Types** (from `cli/source/types/stream.ts`):
- `messages`: Contains `MessagePayload` with optional `tool_calls` array
- `values`: Final complete response
- `metadata`: Thread/session info
- `error`: Error payload

**Current Tool Call Structure**:
```typescript
tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
}>;
```

### 2.2 Proposed Architecture

**New Tool Flow for Local Bash**:
```
User -> CLI -> POST /llm/stream -> Backend -> SSE Stream
                                                 |
                                                 v
                                    CLI intercepts tool_call
                                                 |
                                                 v
                                    Local execution (child_process)
                                                 |
                                                 v
                                    Inject ToolMessage -> Continue stream
```

**Key Design Decision**: Client-side interception rather than backend modification

**Rationale**:
1. **Latency**: Eliminates network round-trip (200-500ms saved per tool call)
2. **Security**: Commands execute in user's environment, not on server
3. **Resource Efficiency**: No backend compute for local operations
4. **Offline Capability**: Works without backend tool server configuration
5. **Existing Pattern**: Follows how Claude Code handles local tool execution

### 2.3 Integration Points

| Component | Modification Required | Impact |
|-----------|----------------------|--------|
| `cli/source/lib/tools.ts` | Add `bash_tool` to available tools list | Low |
| `cli/source/hooks/use-stream.ts` | Add tool call interception and local execution | Medium |
| `cli/source/commands/chat.tsx` | Add `--local-bash` flag, display bash output | Low |
| `cli/source/lib/services/stream-service.ts` | No change - intercept at hook level | None |
| `cli/source/types/stream.ts` | Add LocalToolResult type | Low |
| NEW: `cli/source/lib/local-tools/bash-executor.ts` | Shell execution with safety controls | New file |
| NEW: `cli/source/lib/local-tools/index.ts` | Local tool registry | New file |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Tool Infrastructure (2-3 hours)

**Step 1.1**: Create local tool executor module

```typescript
// cli/source/lib/local-tools/bash-executor.ts
import { spawn, SpawnOptions } from 'node:child_process';

export type BashExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    executionTimeMs: number;
};

export type BashExecutionOptions = {
    timeout?: number;      // Default: 30000ms
    maxOutputSize?: number; // Default: 1MB
    cwd?: string;          // Default: process.cwd()
    shell?: string;        // Default: /bin/bash or cmd.exe
};

export async function executeBashCommand(
    command: string,
    options: BashExecutionOptions = {}
): Promise<BashExecutionResult>;
```

**Step 1.2**: Create local tool registry

```typescript
// cli/source/lib/local-tools/index.ts
export type LocalTool = {
    name: string;
    description: string;
    execute: (args: Record<string, unknown>) => Promise<string>;
};

export const localToolRegistry: Map<string, LocalTool> = new Map();
```

#### Phase 2: Stream Interception (3-4 hours)

**Step 2.1**: Modify `use-stream.ts` to detect and handle tool calls

The key insight is that when the LLM emits a tool_call in the `messages` event, we:
1. Detect it's a local tool (e.g., `bash_tool`)
2. Execute locally
3. Create a synthetic `ToolMessage` response
4. Inject it into the message history for the next iteration

**Critical**: This requires a stateful conversation loop, not a single-shot request.

**Step 2.2**: Implement tool call detection

```typescript
// In use-stream.ts
function isLocalTool(toolName: string): boolean {
    return localToolRegistry.has(toolName);
}

function detectPendingToolCalls(message: MessagePayload): ToolCallRequest[] | undefined {
    if (!message.tool_calls?.length) return undefined;
    return message.tool_calls.filter(tc => isLocalTool(tc.name));
}
```

#### Phase 3: Conversation Loop (4-5 hours)

**Step 3.1**: Implement conversation continuation with tool results

This is the most complex part. After local execution, we need to:
1. Construct a `ToolMessage` with the result
2. Send a follow-up request to `/llm/stream` with the tool result appended
3. Continue streaming the response

```typescript
// Pseudo-code for conversation loop
async function* streamWithLocalTools(
    config: Config,
    initialRequest: StreamRequest
): AsyncGenerator<StreamEvent> {
    let request = initialRequest;

    while (true) {
        const handle = await service.connect(request);

        for await (const event of handle.events) {
            // Check for tool calls that need local execution
            if (event.type === 'messages' && hasPendingLocalToolCalls(event)) {
                const toolCalls = extractLocalToolCalls(event);

                // Execute locally
                const results = await executeLocalTools(toolCalls);

                // Yield tool execution events for display
                for (const result of results) {
                    yield createToolResultEvent(result);
                }

                // Prepare continuation request
                request = buildContinuationRequest(request, results);
                break; // Break inner loop to restart with tool results
            }

            yield event;

            if (event.type === 'done' || event.type === 'error') {
                return; // End of conversation
            }
        }
    }
}
```

#### Phase 4: CLI Integration (2-3 hours)

**Step 4.1**: Update tools.ts with bash_tool

```typescript
// cli/source/lib/tools.ts
export const defaultAgentTools = [
    'web_search',
    'web_scrape',
    'math_calculator',
    'think_tool',
    'python_sandbox',
] as const;

export const localTools = ['bash_tool'] as const;

export type LocalTool = (typeof localTools)[number];
```

**Step 4.2**: Add CLI flag for local tool enablement

```typescript
// In cli.tsx
--local-bash    Enable local bash command execution (default: disabled)
--bash-timeout  Timeout for bash commands in ms (default: 30000)
--bash-cwd      Working directory for bash commands (default: current)
```

**Step 4.3**: Update chat.tsx for bash output display

```typescript
// In ChatCommandTui component
{block.type === 'tool' && block.name === 'bash_tool' ? (
    <>
        <Text dimColor color="yellow">
            Bash Command
        </Text>
        <Box marginLeft={2} flexDirection="column">
            <Text dimColor>{block.content}</Text>
        </Box>
    </>
) : (/* existing tool display */)}
```

### 3.2 File Changes Summary

| File | Change Type | Lines Est. |
|------|-------------|------------|
| `cli/source/lib/local-tools/bash-executor.ts` | New | 150-200 |
| `cli/source/lib/local-tools/index.ts` | New | 50-80 |
| `cli/source/lib/local-tools/types.ts` | New | 40-60 |
| `cli/source/hooks/use-stream.ts` | Modify | +100-150 |
| `cli/source/lib/tools.ts` | Modify | +20-30 |
| `cli/source/commands/chat.tsx` | Modify | +50-80 |
| `cli/source/cli.tsx` | Modify | +15-25 |
| `cli/source/types/stream.ts` | Modify | +20-30 |
| `cli/source/__tests__/bash-executor.test.ts` | New | 100-150 |
| `cli/source/__tests__/local-tools.test.ts` | New | 80-120 |

**Total Estimated New/Modified Lines**: 625-925

### 3.3 Key Code Patterns to Follow

Based on existing codebase analysis:

1. **Error Handling**: Use custom error classes like `StreamConnectionError`
2. **Type Safety**: Full TypeScript with strict types, use discriminated unions
3. **Async Patterns**: Use `async/await` with generators for streaming
4. **Configuration**: Use CLI flags with meow, environment fallbacks
5. **Output Formatting**: Use existing `OutputFormatter` patterns for JSON mode
6. **Testing**: AVA test framework with existing test patterns

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale for Choice |
|----------|-------------|---------------------|
| Client-side execution | Backend proxy | Eliminates latency, security isolation |
| Opt-in via flag | Always enabled | Safety-first, user control |
| Process spawn | exec() | Better memory control, streaming stdout |
| 30s default timeout | No timeout | Prevents runaway processes |
| 1MB output limit | Unlimited | Prevents memory exhaustion |
| Shell isolation | Direct exec | Allows pipes, redirects, shell features |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Modify backend `shell_exec` to be local-aware**
- Rejected: Would require protocol changes, increases backend complexity
- Our approach keeps backend stateless for shell operations

**Alternative 2: WebSocket bidirectional communication**
- Rejected: Adds protocol complexity, SSE is sufficient with continuation
- Our approach reuses existing SSE infrastructure

**Alternative 3: Local-only mode without backend**
- Rejected: Loses access to LLM reasoning and other tools
- Our approach is hybrid: LLM reasoning + local execution

### 4.3 Alignment with Existing Codebase Patterns

1. **Follows CLI flag pattern** from `--tools`, `--json`, `--truncate`
2. **Reuses stream service** patterns for SSE consumption
3. **Matches error handling** style with custom error classes
4. **Uses React-Ink patterns** for TUI output
5. **Follows TypeScript conventions** with strict types

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Severity | Mitigation |
|------|----------|------------|
| Command injection | High | Sanitize inputs, escape shell metacharacters |
| Runaway processes | Medium | Enforce timeout, kill on abort |
| Memory exhaustion | Medium | Cap output buffer size |
| Path traversal | Medium | Validate cwd option |
| Shell unavailability | Low | Detect shell, fallback gracefully |
| Race conditions | Medium | Serialize tool executions |
| Conversation loop infinite | Medium | Max iteration limit |

### 5.2 Edge Cases to Handle

1. **Long-running commands**: User aborts mid-execution
2. **Binary output**: Commands that output non-text data
3. **Interactive commands**: Commands that expect stdin (reject gracefully)
4. **Environment variables**: Inherit vs. sanitize
5. **Exit codes**: Non-zero should not terminate conversation
6. **Encoding issues**: Non-UTF8 output handling
7. **Windows compatibility**: cmd.exe vs bash differences

### 5.3 Testing Considerations

**Unit Tests**:
- Bash executor with mocked child_process
- Tool registry operations
- Stream interception logic
- Output truncation

**Integration Tests**:
- Full chat flow with tool execution
- Timeout behavior
- Error propagation

**Manual Tests**:
- Real shell commands (ls, echo, cat)
- Multi-step conversations with tool use
- Abort mid-execution
- JSON mode output

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Aspect | Assessment |
|--------|------------|
| **Scope** | **Medium** |
| Files Changed | 10-12 files |
| New Code | ~600-900 lines |
| Existing Code Modified | ~200-300 lines |
| External Dependencies | None (uses Node.js built-ins) |
| Backend Changes | None required |

### 6.2 Risk Level

| Aspect | Level | Notes |
|--------|-------|-------|
| **Overall Risk** | **Medium** |  |
| Security | Medium | Shell execution inherently risky, mitigated by opt-in |
| Stability | Low | Isolated to CLI, does not affect backend |
| Performance | Low | Local execution is fast |
| Compatibility | Medium | Cross-platform shell differences |

### 6.3 Suggested Implementation Priority

1. **Phase 1** (Highest): Bash executor with safety controls
2. **Phase 2** (High): Stream interception in use-stream
3. **Phase 3** (High): Conversation continuation loop
4. **Phase 4** (Medium): CLI integration and flags
5. **Phase 5** (Medium): Testing and edge cases
6. **Phase 6** (Lower): Documentation and examples

---

## 7. Performance Optimization Notes

### 7.1 Latency Reduction

- **Current**: Tool call -> Network -> Backend -> External server -> Response -> Network -> CLI
- **Proposed**: Tool call -> Local spawn -> Response
- **Estimated savings**: 200-500ms per tool call

### 7.2 Memory Efficiency

```typescript
// Stream stdout instead of buffering
const chunks: Buffer[] = [];
let totalSize = 0;

child.stdout.on('data', (chunk: Buffer) => {
    if (totalSize + chunk.length <= maxOutputSize) {
        chunks.push(chunk);
        totalSize += chunk.length;
    } else {
        // Truncate and signal
        truncated = true;
    }
});
```

### 7.3 Process Management

```typescript
// Cleanup on abort
const cleanup = () => {
    if (!child.killed) {
        child.kill('SIGTERM');
        setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
        }, 1000);
    }
};

signal.addEventListener('abort', cleanup);
```

---

## 8. Security Recommendations

### 8.1 Required Safeguards

1. **Opt-in only**: Require explicit `--local-bash` flag
2. **No shell expansion by default**: Use array form of spawn
3. **Timeout enforcement**: Hard limit on execution time
4. **Output sanitization**: Strip ANSI codes, limit size
5. **Working directory validation**: Prevent traversal attacks

### 8.2 Optional Enhancements (Future)

1. Command allowlist/blocklist
2. User confirmation for destructive commands
3. Sandboxed execution (container, VM)
4. Audit logging of executed commands

---

## 9. Conclusion

This proposal outlines a performant, secure, and maintainable approach to adding local bash execution to the `ruska chat` CLI. The client-side interception pattern:

1. **Reduces latency** by eliminating network round-trips
2. **Improves security** by keeping execution local
3. **Maintains compatibility** with existing streaming architecture
4. **Follows established patterns** in the codebase

The estimated implementation effort is **12-16 developer hours** with a **medium** complexity and **medium** risk profile, primarily due to the inherent security considerations of shell execution.
