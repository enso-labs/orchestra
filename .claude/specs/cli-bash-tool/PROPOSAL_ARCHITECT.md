# CLI Bash Tool Implementation Proposal

**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-22
**Feature:** Implement bash_tool functionality for `ruska chat` CLI command that allows local command execution

---

## 1. Executive Summary

This proposal outlines an architecture for adding local bash/shell command execution capability to the `ruska chat` CLI. The recommended approach introduces a **CLI-side tool interception layer** that detects when the LLM requests a `bash_tool` execution, executes commands locally on the user's machine, and injects the results back into the conversation stream. This approach maintains the existing backend architecture while enabling powerful local automation capabilities for CLI users.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### CLI Architecture
- **Entry Point:** `cli/source/cli.tsx` - Meow-based CLI with command routing
- **Chat Command:** `cli/source/commands/chat.tsx` - React-Ink component handling LLM streaming
- **Stream Handling:**
  - `cli/source/hooks/use-stream.ts` - React hook for consuming SSE streams
  - `cli/source/lib/services/stream-service.ts` - SSE client implementation
- **Tool Configuration:** `cli/source/lib/tools.ts` - Tool parsing and defaults

#### Backend Architecture
- **Tool Registration:** `backend/src/tools/__init__.py` - Tool library initialization
- **Existing Shell Tool:** `backend/src/tools/shell.py` - Remote shell execution via HTTP POST
- **Stream Generation:** `backend/src/utils/stream.py` - SSE event generation with tool call handling
- **Tool Service:** `backend/src/services/tool.py` - Tool management and invocation

#### Current Data Flow
```
User Input -> CLI -> Backend API -> LLM -> Tool Calls -> Backend Execution -> SSE Stream -> CLI Display
```

#### Key Observations
1. **All tool execution happens on the backend** - The CLI is purely a display layer
2. **Existing `shell_exec` requires remote server** - Not suitable for local execution
3. **Stream events include tool calls** - `AIMessageChunk` with `tool_calls` property
4. **Tools are passed as string names** - Backend resolves them to executable tools

### 2.2 Proposed Architecture

#### New Data Flow (with Local Tool Interception)
```
User Input -> CLI -> Backend API -> LLM -> Tool Calls (streamed)
                                              |
                                              v
                                    CLI Intercepts bash_tool calls
                                              |
                                              v
                                    Local Execution (Node.js child_process)
                                              |
                                              v
                                    Inject Results -> Continue Conversation
```

#### Architectural Components

**1. Tool Call Interceptor (CLI-Side)**
- Monitors stream events for `bash_tool` tool calls
- Extracts command parameters from tool call args
- Routes to local executor instead of waiting for backend result

**2. Local Bash Executor (CLI-Side)**
- Uses Node.js `child_process.spawn` for command execution
- Implements timeout, working directory, and environment controls
- Captures stdout, stderr, and exit codes

**3. Tool Result Injector (CLI-Side)**
- Formats execution results as tool messages
- Sends results back to backend for conversation continuity
- Handles multi-turn tool use scenarios

**4. Backend Tool Registration (Backend-Side)**
- Register `bash_tool` as a no-op tool that signals CLI execution
- Tool schema defines expected arguments (command, cwd, timeout)

### 2.3 Integration Points and Dependencies

| Component | Integration Point | Dependency |
|-----------|------------------|------------|
| CLI Chat Command | `use-stream.ts` hook | Stream event parsing |
| Local Executor | Node.js `child_process` | Cross-platform shell detection |
| Tool Registration | Backend tool library | Tool schema definition |
| Result Injection | New API endpoint or thread continuation | Backend thread handling |

---

## 3. Implementation Strategy

### 3.1 Phase 1: Backend Tool Registration

**Goal:** Register `bash_tool` as a recognized tool that signals local execution.

**Files to Create/Modify:**

1. **`backend/src/tools/bash.py`** (NEW)
```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

class BashToolInput(BaseModel):
    """Input schema for bash_tool - executed locally by CLI"""
    command: str = Field(description="The bash command to execute")
    cwd: str = Field(default=".", description="Working directory for command execution")
    timeout: int = Field(default=30, description="Timeout in seconds")

@tool(args_schema=BashToolInput)
def bash_tool(command: str, cwd: str = ".", timeout: int = 30) -> str:
    """Execute a bash command on the user's local machine via CLI.

    This tool is executed locally by the CLI, not on the server.
    Commands are run in a sandboxed environment with configurable timeout.
    Use for file operations, git commands, build scripts, etc.

    IMPORTANT: This tool only works when using the ruska CLI client.
    Web interface users should use shell_exec with SHELL_EXEC_SERVER_URL configured.
    """
    # This is a marker tool - actual execution happens in CLI
    return "__CLI_LOCAL_EXECUTION__"
```

2. **`backend/src/tools/__init__.py`** (MODIFY)
- Add `bash_tool` to the tool library imports
- Include in `default_tools()` or create new `cli_tools()` function

3. **`cli/source/lib/tools.ts`** (MODIFY)
- Add `bash_tool` to `defaultAgentTools` when appropriate
- Consider making it opt-in via flag: `--local-tools` or `--bash`

### 3.2 Phase 2: CLI Tool Call Interception

**Goal:** Detect `bash_tool` calls in stream and handle locally.

**Files to Create/Modify:**

1. **`cli/source/lib/local-tools/bash-executor.ts`** (NEW)
```typescript
import { spawn } from 'node:child_process';
import { platform } from 'node:os';

export type BashExecutionResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    error?: string;
};

export type BashExecutionOptions = {
    command: string;
    cwd?: string;
    timeout?: number;
    shell?: string;
};

export async function executeBash(options: BashExecutionOptions): Promise<BashExecutionResult> {
    const {
        command,
        cwd = process.cwd(),
        timeout = 30000,
        shell = platform() === 'win32' ? 'cmd.exe' : '/bin/bash'
    } = options;

    return new Promise((resolve) => {
        const shellArgs = platform() === 'win32'
            ? ['/c', command]
            : ['-c', command];

        const proc = spawn(shell, shellArgs, {
            cwd,
            timeout,
            env: process.env,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        const timeoutId = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timeoutId);
            resolve({
                stdout,
                stderr,
                exitCode: code ?? 1,
                timedOut,
            });
        });

        proc.on('error', (err) => {
            clearTimeout(timeoutId);
            resolve({
                stdout,
                stderr,
                exitCode: 1,
                timedOut: false,
                error: err.message,
            });
        });
    });
}
```

2. **`cli/source/lib/local-tools/tool-interceptor.ts`** (NEW)
```typescript
import type { MessagePayload } from '../../types/stream.js';
import { executeBash, type BashExecutionResult } from './bash-executor.js';

export type ToolCall = {
    id: string;
    name: string;
    args: Record<string, unknown>;
};

export type InterceptedToolResult = {
    toolCallId: string;
    toolName: string;
    result: string;
};

const LOCAL_TOOLS = ['bash_tool'] as const;
type LocalToolName = typeof LOCAL_TOOLS[number];

export function isLocalTool(name: string): name is LocalToolName {
    return LOCAL_TOOLS.includes(name as LocalToolName);
}

export function extractToolCalls(message: MessagePayload): ToolCall[] {
    return message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.args,
    })) ?? [];
}

export async function executeLocalTool(
    toolCall: ToolCall,
    options?: { confirmBeforeExec?: boolean }
): Promise<InterceptedToolResult> {
    switch (toolCall.name) {
        case 'bash_tool': {
            const result = await executeBash({
                command: String(toolCall.args.command ?? ''),
                cwd: String(toolCall.args.cwd ?? '.'),
                timeout: Number(toolCall.args.timeout ?? 30) * 1000,
            });
            return {
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                result: formatBashResult(result),
            };
        }
        default:
            throw new Error(`Unknown local tool: ${toolCall.name}`);
    }
}

function formatBashResult(result: BashExecutionResult): string {
    const parts: string[] = [];

    if (result.error) {
        parts.push(`Error: ${result.error}`);
    }
    if (result.timedOut) {
        parts.push('Command timed out');
    }
    if (result.stdout) {
        parts.push(`stdout:\n${result.stdout}`);
    }
    if (result.stderr) {
        parts.push(`stderr:\n${result.stderr}`);
    }
    parts.push(`Exit code: ${result.exitCode}`);

    return parts.join('\n');
}
```

### 3.3 Phase 3: Stream Handler Integration

**Goal:** Integrate tool interception into the streaming flow.

**Files to Modify:**

1. **`cli/source/hooks/use-stream.ts`** (MODIFY)
- Add local tool execution state
- Intercept tool calls and pause stream consumption
- Execute local tools and inject results
- Resume stream with tool results

2. **`cli/source/types/stream.ts`** (MODIFY)
- Add types for tool call interception
- Add types for tool result injection

3. **`cli/source/commands/chat.tsx`** (MODIFY)
- Add `--local-tools` or `--bash` flag handling
- Display local tool execution status
- Show confirmation prompts (optional)

### 3.4 Phase 4: Result Injection Mechanism

**Goal:** Send local tool results back to the LLM for conversation continuity.

**Option A: Append to Thread (Recommended)**
- Use existing thread continuation: `POST /api/llm/stream` with `thread_id`
- Inject tool result as part of the input messages
- Maintains conversation context naturally

**Option B: Tool Result Endpoint (Alternative)**
- Create new endpoint: `POST /api/threads/{thread_id}/tool-result`
- Backend injects result into thread state
- More explicit but requires backend changes

**Recommended Implementation (Option A):**

1. **`cli/source/lib/services/tool-result-service.ts`** (NEW)
```typescript
import type { Config } from '../../types/index.js';
import type { InterceptedToolResult } from '../local-tools/tool-interceptor.js';

export async function injectToolResult(
    config: Config,
    threadId: string,
    toolResult: InterceptedToolResult,
): Promise<void> {
    // Format as tool message and continue thread
    const response = await fetch(`${config.host}/api/llm/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
            input: {
                messages: [{
                    role: 'tool',
                    tool_call_id: toolResult.toolCallId,
                    content: toolResult.result,
                }],
            },
            metadata: {
                thread_id: threadId,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to inject tool result: ${response.status}`);
    }
}
```

### 3.5 Phase 5: Security and Confirmation

**Goal:** Implement safety measures for local command execution.

**Files to Create:**

1. **`cli/source/lib/local-tools/security.ts`** (NEW)
```typescript
export type CommandRisk = 'safe' | 'moderate' | 'dangerous';

const DANGEROUS_PATTERNS = [
    /rm\s+(-rf?|--recursive).*\//,  // Recursive delete
    />\s*\/dev\/sd[a-z]/,            // Overwrite disk
    /dd\s+.*of=/,                     // Direct disk write
    /mkfs\./,                         // Format filesystem
    /:\(\)\s*\{/,                     // Fork bomb
    /curl.*\|\s*(ba)?sh/,            // Pipe to shell
    /wget.*\|\s*(ba)?sh/,            // Pipe to shell
];

const MODERATE_PATTERNS = [
    /sudo\s+/,                        // Elevated privileges
    /rm\s+/,                          // Any remove command
    /mv\s+.*\//,                      // Move to root paths
    /chmod\s+777/,                    // Insecure permissions
];

export function assessCommandRisk(command: string): CommandRisk {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) return 'dangerous';
    }
    for (const pattern of MODERATE_PATTERNS) {
        if (pattern.test(command)) return 'moderate';
    }
    return 'safe';
}

export function requiresConfirmation(risk: CommandRisk, userLevel: 'strict' | 'normal' | 'permissive'): boolean {
    switch (userLevel) {
        case 'strict': return risk !== 'safe';
        case 'normal': return risk === 'dangerous';
        case 'permissive': return false;
    }
}
```

2. **`cli/source/components/ConfirmCommand.tsx`** (NEW)
- React-Ink component for command confirmation UI
- Shows command, risk level, and yes/no prompt

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| CLI-side execution | Backend-side with SSH | CLI has direct local access; no additional infrastructure needed |
| Tool interception pattern | Backend tool routing | Keeps backend stateless; CLI owns local execution context |
| Spawn over exec | exec() | Spawn provides better streaming and timeout control |
| Thread continuation for results | Separate endpoint | Leverages existing conversation flow; simpler implementation |
| Opt-in via flag | Default enabled | Safety-first approach for command execution |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Extend shell_exec to detect local vs remote**
- Rejected: Conflates two different execution contexts
- shell_exec is designed for authenticated remote servers
- Local execution has different security requirements

**Alternative 2: Pure client-side agent**
- Rejected: Loses backend LLM orchestration benefits
- Would require full agent implementation in CLI
- Duplicates significant backend functionality

**Alternative 3: WebSocket-based bidirectional communication**
- Rejected: Over-engineered for the use case
- SSE streaming is sufficient for LLM responses
- Tool results can use simple POST requests

### 4.3 Alignment with Existing Patterns

1. **Tool Flag Pattern:** Matches existing `--tools` flag behavior
2. **Stream Handling:** Extends `use-stream.ts` hook pattern
3. **Service Abstraction:** New services follow existing service patterns
4. **Type Safety:** TypeScript types extend existing stream types
5. **Component Structure:** React-Ink components follow existing patterns

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Arbitrary code execution** | Critical | Command risk assessment, confirmation prompts, opt-in only |
| **Stream synchronization** | High | Careful state management in hook; timeout handling |
| **Cross-platform compatibility** | Medium | Platform detection; shell abstraction layer |
| **Tool call ID mismatch** | Medium | Strict ID tracking between tool call and result |
| **Infinite tool loops** | Medium | Maximum tool call depth limit |

### 5.2 Edge Cases to Handle

1. **Concurrent tool calls:** LLM may request multiple bash commands
   - Solution: Queue and execute sequentially with proper ID tracking

2. **Long-running commands:** Commands that exceed timeout
   - Solution: Configurable timeout, graceful termination, partial output capture

3. **Interactive commands:** Commands requiring stdin
   - Solution: Detect and reject interactive commands with clear error

4. **Binary output:** Commands producing non-UTF8 output
   - Solution: Detect binary output, provide hexdump or truncated representation

5. **Network-disconnected execution:** Stream dies mid-execution
   - Solution: Local execution continues; results logged for retry

6. **Working directory changes:** `cd` commands
   - Solution: Each command runs in isolated subprocess; persistent cwd requires explicit tracking

### 5.3 Testing Considerations

**Unit Tests:**
- Bash executor with various command types
- Risk assessment patterns
- Tool call extraction from messages

**Integration Tests:**
- Full flow from chat command to local execution
- Thread continuation with tool results
- Timeout and error handling

**E2E Tests:**
- Real command execution (sandboxed)
- Cross-platform verification

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Effort | Risk |
|-----------|--------|------|
| Backend tool registration | Small | Low |
| Bash executor | Medium | Medium |
| Tool interceptor | Medium | Medium |
| Stream handler integration | Large | High |
| Result injection | Medium | Medium |
| Security layer | Medium | Medium |
| Confirmation UI | Small | Low |
| Testing | Medium | Low |

**Overall Scope:** **Large**
**Overall Risk Level:** **Medium-High**

### 6.2 Implementation Priority Order

1. **Phase 1: Backend Tool Registration** (1-2 hours)
   - Lowest risk, enables development of CLI components

2. **Phase 2: Bash Executor** (2-3 hours)
   - Core functionality, can be tested independently

3. **Phase 3: Tool Interceptor** (2-3 hours)
   - Depends on executor, moderate complexity

4. **Phase 4: Security Layer** (2-3 hours)
   - Critical for safe deployment

5. **Phase 5: Stream Integration** (4-6 hours)
   - Highest complexity, requires careful state management

6. **Phase 6: Result Injection** (2-3 hours)
   - Completes the loop, enables multi-turn tool use

7. **Phase 7: Confirmation UI** (1-2 hours)
   - Polish and user experience

8. **Phase 8: Testing & Documentation** (4-6 hours)
   - Essential for production readiness

**Total Estimated Effort:** 18-28 hours

---

## 7. File Summary

### New Files

| Path | Purpose |
|------|---------|
| `backend/src/tools/bash.py` | Backend tool definition for bash_tool |
| `cli/source/lib/local-tools/bash-executor.ts` | Local command execution engine |
| `cli/source/lib/local-tools/tool-interceptor.ts` | Tool call detection and routing |
| `cli/source/lib/local-tools/security.ts` | Command risk assessment |
| `cli/source/lib/services/tool-result-service.ts` | Tool result injection to backend |
| `cli/source/components/ConfirmCommand.tsx` | Confirmation UI component |
| `cli/source/__tests__/bash-executor.test.ts` | Executor unit tests |
| `cli/source/__tests__/tool-interceptor.test.ts` | Interceptor unit tests |

### Modified Files

| Path | Changes |
|------|---------|
| `backend/src/tools/__init__.py` | Add bash_tool import |
| `cli/source/lib/tools.ts` | Add bash_tool to available tools |
| `cli/source/hooks/use-stream.ts` | Add local tool interception logic |
| `cli/source/types/stream.ts` | Add tool execution types |
| `cli/source/commands/chat.tsx` | Add --local-tools flag, execution display |
| `cli/source/cli.tsx` | Add --local-tools flag definition |

---

## 8. Appendix: Sequence Diagram

```
User                CLI                 Backend             LLM
  |                  |                    |                  |
  |--chat "cmd"----->|                    |                  |
  |                  |--POST /llm/stream->|                  |
  |                  |                    |---prompt-------->|
  |                  |                    |<--tool_call:bash-|
  |                  |<--SSE:tool_call----|                  |
  |                  |                    |                  |
  |<--[confirm?]-----|                    |                  |
  |---[yes]--------->|                    |                  |
  |                  |                    |                  |
  |                  |--spawn(cmd)------->|                  |
  |                  |<--output-----------|                  |
  |<--display--------|                    |                  |
  |                  |                    |                  |
  |                  |--POST /llm/stream--|                  |
  |                  |  (tool result)     |                  |
  |                  |                    |---tool_result--->|
  |                  |                    |<--response-------|
  |                  |<--SSE:response-----|                  |
  |<--display--------|                    |                  |
```

---

## 9. Open Questions for Review

1. **Confirmation Granularity:** Should we confirm every command, only risky ones, or make it fully configurable?

2. **Persistent Working Directory:** Should we track cwd across commands in a session, or keep each isolated?

3. **Environment Variables:** Should we expose a way to pass additional env vars to commands?

4. **Output Limits:** What should be the maximum output size before truncation?

5. **Parallel Execution:** Should we support concurrent tool calls, or always serialize?

---

*End of Proposal*
