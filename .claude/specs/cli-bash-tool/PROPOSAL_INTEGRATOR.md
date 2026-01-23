# Implementation Proposal: CLI Local Bash Tool Execution

**Agent:** AGENT_5: INTEGRATOR
**Feature:** Implement bash_tool functionality for `ruska chat` CLI command that allows local command execution
**Date:** 2026-01-22

---

## 1. Executive Summary

This proposal introduces a **hybrid tool execution architecture** where the CLI can execute `bash_tool` commands locally on the user's machine while the LLM orchestration remains server-side. The recommended approach intercepts `bash_tool` tool calls from the backend SSE stream, executes them locally via Node.js `child_process`, and sends results back to the backend to continue the conversation. This maintains the existing architecture's separation of concerns while enabling powerful local system access.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

The existing architecture follows a clean client-server separation:

```
+------------------+                  +----------------------+
|     CLI (TS)     | -- HTTP POST --> |    Backend (Python)  |
|                  | <-- SSE Stream - |                      |
| - Parses args    |                  | - LLM orchestration  |
| - Displays UI    |                  | - Tool execution     |
| - Handles output |                  | - State management   |
+------------------+                  +----------------------+
```

**Key Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `cli/source/commands/chat.tsx` | CLI | Main chat command, handles TUI and JSON modes |
| `cli/source/hooks/use-stream.ts` | CLI | React hook for consuming SSE streams |
| `cli/source/lib/services/stream-service.ts` | CLI | Low-level SSE connection management |
| `cli/source/lib/tools.ts` | CLI | Tool flag parsing, default tool list |
| `backend/src/tools/shell.py` | Backend | Remote shell execution via HTTP POST |
| `backend/src/utils/stream.py` | Backend | SSE event generation, multi-mode handling |

**Tool Flow Today:**
1. CLI sends `tools: ['web_search', 'python_sandbox', ...]` to backend
2. Backend LLM decides to call tools
3. Backend executes tools (e.g., `web_search` hits external APIs)
4. Backend streams results back via SSE `messages` events
5. CLI displays tool output (type: `tool`)

**Existing Shell Tool (`shell_exec`):**
- Executes commands on a **remote server** via HTTP POST
- Requires user to configure `SHELL_EXEC_SERVER_URL` in settings
- Not designed for local CLI execution

### 2.2 Problem Statement

Users need to execute commands **locally** on their machine when using the CLI. The remote `shell_exec` tool is inappropriate because:
1. It requires a separate shell server deployment
2. Network latency adds unnecessary overhead
3. Security implications of exposing a shell server
4. CLI users expect local execution (like Claude Code or Cursor)

### 2.3 Proposed Architecture

Introduce a **client-side tool execution layer** that intercepts specific tool calls:

```
+------------------+                       +----------------------+
|     CLI (TS)     | -- HTTP POST -------> |    Backend (Python)  |
|                  | <-- SSE Stream ------ |                      |
|  +-------------+ |                       | +------------------+ |
|  | Local Tools | |                       | | LLM + Tool Bind  | |
|  | - bash_tool | |                       | | - bash_tool def  | |
|  +-------------+ |                       | +------------------+ |
|        |         |                       |                      |
|        v         |                       |                      |
|  child_process   | -- Tool Result -----> |    Continue LLM      |
+------------------+                       +----------------------+
```

**Key Insight:** The backend already streams `tool_calls` in the `messages` event payload. The CLI currently ignores these (see `chat.tsx` line 337: `// NOTE: Ignoring tool_calls per requirements`). We can:
1. Have backend register `bash_tool` as a tool definition (but NOT execute it)
2. CLI intercepts `tool_calls` for `bash_tool`
3. CLI executes locally and sends results back
4. Backend continues LLM conversation with tool results

### 2.4 Integration Points and Dependencies

**Backend Changes Required:**
1. New tool definition: `bash_tool` with schema but no execution
2. New endpoint: `POST /api/llm/tool-result` to receive CLI tool results
3. Modify stream to yield tool call events CLI can intercept

**CLI Changes Required:**
1. Local tool executor service
2. Stream handler modifications to detect `bash_tool` calls
3. User confirmation/safety prompts
4. Tool result submission to backend

**Shared Contracts:**
- Tool call schema (already defined in `types/stream.ts`)
- Tool result submission schema (new)

---

## 3. Implementation Strategy

### 3.1 Phase 1: Backend Tool Definition (Backend)

**Files to modify:**
- `backend/src/tools/bash_tool.py` (NEW)
- `backend/src/tools/__init__.py`

**Implementation:**

```python
# backend/src/tools/bash_tool.py
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Literal

class BashToolInput(BaseModel):
    """Input schema for bash_tool - executed by CLI, not backend."""
    command: str = Field(description="The bash command to execute locally on the CLI user's machine")
    working_directory: str = Field(default=".", description="Working directory for command execution")
    timeout_ms: int = Field(default=30000, description="Timeout in milliseconds")

class BashToolOutput(BaseModel):
    """Output schema for bash_tool results."""
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False

@tool(args_schema=BashToolInput)
def bash_tool(command: str, working_directory: str = ".", timeout_ms: int = 30000) -> str:
    """
    Execute a bash command on the user's local machine.

    IMPORTANT: This tool is executed by the CLI, not the backend.
    The backend yields a tool_call event and waits for the CLI to submit results.

    Args:
        command: The bash command to execute
        working_directory: Directory to execute the command in
        timeout_ms: Maximum execution time in milliseconds

    Returns:
        Command output (stdout + stderr) or error message
    """
    # This should never execute on backend - CLI intercepts the tool call
    raise NotImplementedError(
        "bash_tool is a CLI-side tool. The backend should not execute this."
    )
```

**Rationale:** Defining the tool schema on the backend ensures the LLM can properly bind to it and generate valid tool calls. The tool itself raises `NotImplementedError` as a safety net.

### 3.2 Phase 2: Backend Tool Call Interception Protocol (Backend)

**Files to modify:**
- `backend/src/utils/stream.py`
- `backend/src/routes/v0/llm.py`
- `backend/src/schemas/entities/llm.py` (for tool result schema)

**New SSE Event Type: `tool_request`**

When the LLM generates a `bash_tool` call, instead of executing it, emit a special event:

```python
# In stream.py handle_multi_mode or stream_generator
if msg.tool_calls:
    for tool_call in msg.tool_calls:
        if tool_call["name"] == "bash_tool":
            # Emit tool_request event for CLI to handle
            yield f"data: {ujson.dumps(('tool_request', {
                'tool_call_id': tool_call['id'],
                'tool_name': 'bash_tool',
                'args': tool_call['args'],
                'thread_id': config['configurable'].get('thread_id'),
            }))}\n\n"
            # Pause stream and wait for CLI to submit result
            # (Implementation detail: use async queue or polling)
```

**New Endpoint: Tool Result Submission**

```python
# backend/src/routes/v0/llm.py
@llm_router.post("/tool-result")
async def submit_tool_result(
    request: Request,
    body: ToolResultRequest = Body(...),
    user: ProtectedUser = Depends(get_optional_user),
    store: BaseStore = Depends(get_store),
):
    """
    Submit a tool execution result from the CLI.
    Used when CLI executes local tools like bash_tool.
    """
    # Store result in thread state, signal stream to continue
    ...
```

### 3.3 Phase 3: CLI Local Executor Service (CLI)

**Files to create:**
- `cli/source/lib/services/local-executor.ts` (NEW)
- `cli/source/lib/services/local-executor.interface.ts` (NEW)

**Implementation:**

```typescript
// cli/source/lib/services/local-executor.ts
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

export interface BashToolArgs {
  command: string;
  working_directory?: string;
  timeout_ms?: number;
}

export interface BashToolResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
}

export interface LocalExecutorOptions {
  /** Prompt user before executing dangerous commands */
  requireConfirmation?: boolean;
  /** Allowed commands whitelist (regex patterns) */
  allowedPatterns?: RegExp[];
  /** Blocked commands blacklist (regex patterns) */
  blockedPatterns?: RegExp[];
  /** Maximum output size in bytes */
  maxOutputSize?: number;
}

const DEFAULT_BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /mkfs/, // filesystem formatting
  /dd\s+.*of=\/dev/, // disk overwrite
  /:(){ :|:& };:/, // fork bomb
  />\s*\/dev\/sd/, // overwriting disk devices
];

export class LocalExecutor {
  private options: Required<LocalExecutorOptions>;

  constructor(options: LocalExecutorOptions = {}) {
    this.options = {
      requireConfirmation: options.requireConfirmation ?? true,
      allowedPatterns: options.allowedPatterns ?? [],
      blockedPatterns: options.blockedPatterns ?? DEFAULT_BLOCKED_PATTERNS,
      maxOutputSize: options.maxOutputSize ?? 1024 * 1024, // 1MB
    };
  }

  /**
   * Check if a command is allowed to execute
   */
  isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
    // Check blocklist first
    for (const pattern of this.options.blockedPatterns) {
      if (pattern.test(command)) {
        return { allowed: false, reason: `Command matches blocked pattern: ${pattern}` };
      }
    }

    // If allowlist is specified, command must match
    if (this.options.allowedPatterns.length > 0) {
      const matches = this.options.allowedPatterns.some(p => p.test(command));
      if (!matches) {
        return { allowed: false, reason: 'Command not in allowed list' };
      }
    }

    return { allowed: true };
  }

  /**
   * Execute a bash command locally
   */
  async execute(args: BashToolArgs): Promise<BashToolResult> {
    const { command, working_directory = process.cwd(), timeout_ms = 30000 } = args;

    // Safety check
    const check = this.isCommandAllowed(command);
    if (!check.allowed) {
      return {
        stdout: '',
        stderr: `Blocked: ${check.reason}`,
        exit_code: 1,
        timed_out: false,
      };
    }

    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], {
        cwd: working_directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout_ms,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > this.options.maxOutputSize) {
          stdout = stdout.slice(0, this.options.maxOutputSize) + '\n[OUTPUT TRUNCATED]';
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > this.options.maxOutputSize) {
          stderr = stderr.slice(0, this.options.maxOutputSize) + '\n[OUTPUT TRUNCATED]';
        }
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exit_code: code ?? 1,
          timed_out: timedOut,
        });
      });

      child.on('error', (error) => {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
          timedOut = true;
        }
        resolve({
          stdout,
          stderr: stderr + '\n' + error.message,
          exit_code: 1,
          timed_out: timedOut,
        });
      });

      // Handle timeout manually for better control
      setTimeout(() => {
        if (!child.killed) {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 1000);
        }
      }, timeout_ms);
    });
  }
}

export const localExecutor = new LocalExecutor();
```

### 3.4 Phase 4: CLI Stream Handler Modifications (CLI)

**Files to modify:**
- `cli/source/hooks/use-stream.ts`
- `cli/source/lib/services/stream-service.ts`
- `cli/source/types/stream.ts`
- `cli/source/commands/chat.tsx`

**New Stream Event Type:**

```typescript
// cli/source/types/stream.ts (additions)
export type ToolRequestPayload = {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  thread_id: string;
};

export type StreamEvent =
  | { type: 'messages'; payload: MessagePayload[]; metadata?: unknown }
  | { type: 'values'; payload: ValuesPayload }
  | { type: 'error'; payload: ErrorPayload }
  | { type: 'metadata'; payload: MetadataPayload }
  | { type: 'tool_request'; payload: ToolRequestPayload } // NEW
  | { type: 'done'; payload: undefined };
```

**Modified Hook:**

```typescript
// cli/source/hooks/use-stream.ts (modifications)
case 'tool_request': {
  const payload = event.payload as ToolRequestPayload;
  if (payload.tool_name === 'bash_tool') {
    // Execute locally and submit result
    const result = await localExecutor.execute(payload.args);
    await submitToolResult(config, payload.thread_id, payload.tool_call_id, result);
  }
  break;
}
```

### 3.5 Phase 5: User Confirmation UI (CLI)

**Files to create:**
- `cli/source/components/command-confirm.tsx` (NEW)

**Implementation:**

```tsx
// cli/source/components/command-confirm.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

type CommandConfirmProps = {
  command: string;
  workingDirectory: string;
  onConfirm: () => void;
  onReject: () => void;
};

export function CommandConfirm({
  command,
  workingDirectory,
  onConfirm,
  onReject,
}: CommandConfirmProps) {
  useInput((input, key) => {
    if (input.toLowerCase() === 'y' || key.return) {
      onConfirm();
    } else if (input.toLowerCase() === 'n' || key.escape) {
      onReject();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Execute command?</Text>
      <Box marginTop={1}>
        <Text dimColor>Directory: </Text>
        <Text>{workingDirectory}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Command:</Text>
        <Box marginLeft={2}>
          <Text color="cyan">{command}</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[y/Enter] Execute  [n/Esc] Skip</Text>
      </Box>
    </Box>
  );
}
```

### 3.6 Phase 6: CLI Flag and Tool Registration (CLI)

**Files to modify:**
- `cli/source/cli.tsx`
- `cli/source/lib/tools.ts`

**New Flag:**

```typescript
// cli/source/cli.tsx (additions to meow config)
bashTool: {
  type: 'boolean',
  default: false,
  description: 'Enable local bash command execution',
},
autoConfirm: {
  type: 'boolean',
  default: false,
  description: 'Auto-confirm bash commands without prompting (dangerous)',
},
```

**Tool Registration:**

```typescript
// cli/source/lib/tools.ts (additions)
export const defaultAgentTools = [
  'web_search',
  'web_scrape',
  'math_calculator',
  'think_tool',
  'python_sandbox',
] as const;

// Tools that execute on CLI side, not backend
export const localTools = ['bash_tool'] as const;
export type LocalTool = (typeof localTools)[number];

export function isLocalTool(name: string): name is LocalTool {
  return localTools.includes(name as LocalTool);
}
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **A: CLI-intercept model** (chosen) | Maintains server architecture, secure by default, works with existing stream | Requires backend coordination, slightly complex | **Selected** |
| **B: Pure client-side tool** | Simpler, no backend changes | LLM can't see tool schema, no conversation context | Rejected |
| **C: WebSocket bidirectional** | Real-time, elegant | Major architecture change, breaks SSE clients | Rejected |
| **D: Poll-based approach** | Simple backend changes | Poor UX, latency issues | Rejected |

### 4.2 Why This Approach Over Alternatives

1. **Security First:** User confirmation by default prevents accidental destructive commands
2. **Existing Pattern Alignment:** Extends the current SSE streaming model rather than replacing it
3. **Progressive Enhancement:** CLI users opt-in to `bash_tool` via `--bash-tool` flag
4. **Backend Coherence:** LLM maintains conversation context including tool results
5. **Type Safety:** Shared TypeScript/Pydantic schemas ensure contract alignment

### 4.3 Alignment with Existing Codebase Patterns

- **Stream Event Pattern:** Follows existing `('type', payload)` tuple format
- **Service Layer:** New `LocalExecutor` follows `StreamService` patterns
- **React Components:** Confirmation UI uses Ink patterns from existing commands
- **Tool Registration:** Mirrors `defaultAgentTools` pattern in `tools.ts`
- **Error Handling:** Uses existing `classifyError` and `exitCodes` patterns

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Command injection via LLM** | Medium | High | Blocklist dangerous patterns, require confirmation |
| **Stream desync on slow commands** | Low | Medium | Timeout handling, keepalive during execution |
| **Backend state corruption** | Low | High | Transactional tool result submission |
| **Cross-platform shell issues** | Medium | Medium | Use bash explicitly, document Windows WSL requirement |

### 5.2 Edge Cases to Handle

1. **Long-running commands:** Implement streaming output and progress indicators
2. **Interactive commands:** Detect and reject commands requiring TTY input
3. **Binary output:** Truncate and warn on non-text output
4. **Working directory changes:** Commands with `cd` won't persist between calls
5. **Environment variables:** Decide whether to inherit CLI environment
6. **Concurrent tool calls:** Handle multiple `bash_tool` calls in sequence

### 5.3 Testing Considerations

**Unit Tests:**
- `LocalExecutor.isCommandAllowed()` with various patterns
- `LocalExecutor.execute()` with mock processes
- Stream event parsing for `tool_request` type
- Tool flag parsing with `bash_tool`

**Integration Tests:**
- End-to-end: CLI sends message -> backend returns `tool_request` -> CLI executes -> backend continues
- Timeout handling
- Confirmation flow (y/n/auto)

**Security Tests:**
- Blocklist bypass attempts
- Output size limits
- Timeout enforcement

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Scope | Justification |
|-------|---------------|
| **Medium-Large** | Requires coordinated changes across CLI and backend, new streaming protocol, security considerations |

### 6.2 Risk Level

| Risk Level | Justification |
|------------|---------------|
| **Medium** | Security-sensitive feature (shell access), but mitigated by opt-in design and confirmation prompts |

### 6.3 Suggested Implementation Priority

1. **P1: Backend tool definition** - Enables LLM to generate tool calls
2. **P2: CLI local executor** - Core functionality
3. **P3: Stream event handling** - CLI-backend coordination
4. **P4: User confirmation UI** - Security layer
5. **P5: Backend tool result endpoint** - Conversation continuity
6. **P6: Flags and documentation** - User-facing polish

### 6.4 Estimated Effort

| Phase | Estimated Hours |
|-------|-----------------|
| Backend tool definition | 2-4h |
| CLI local executor | 4-6h |
| Stream modifications | 4-6h |
| Confirmation UI | 2-4h |
| Backend result endpoint | 4-6h |
| Testing | 4-8h |
| Documentation | 2-4h |
| **Total** | **22-38h** |

---

## 7. File Change Summary

### 7.1 New Files

| File | Description |
|------|-------------|
| `backend/src/tools/bash_tool.py` | Tool definition with schema |
| `cli/source/lib/services/local-executor.ts` | Local command execution service |
| `cli/source/lib/services/local-executor.interface.ts` | Type definitions |
| `cli/source/components/command-confirm.tsx` | Confirmation UI component |
| `cli/source/__tests__/local-executor.test.ts` | Unit tests |

### 7.2 Modified Files

| File | Changes |
|------|---------|
| `backend/src/tools/__init__.py` | Register `bash_tool` |
| `backend/src/utils/stream.py` | Emit `tool_request` events |
| `backend/src/routes/v0/llm.py` | Add `/tool-result` endpoint |
| `backend/src/schemas/entities/llm.py` | Add tool result schema |
| `cli/source/types/stream.ts` | Add `tool_request` event type |
| `cli/source/hooks/use-stream.ts` | Handle `tool_request` events |
| `cli/source/commands/chat.tsx` | Integrate confirmation flow |
| `cli/source/lib/tools.ts` | Add `bash_tool` to local tools |
| `cli/source/cli.tsx` | Add `--bash-tool` and `--auto-confirm` flags |

---

## 8. API Contract Definitions

### 8.1 SSE Event: `tool_request`

```json
{
  "type": "tool_request",
  "payload": {
    "tool_call_id": "tc_abc123",
    "tool_name": "bash_tool",
    "args": {
      "command": "ls -la",
      "working_directory": "/home/user",
      "timeout_ms": 30000
    },
    "thread_id": "thread_xyz789"
  }
}
```

### 8.2 Tool Result Submission

**Endpoint:** `POST /api/llm/tool-result`

**Request:**
```json
{
  "thread_id": "thread_xyz789",
  "tool_call_id": "tc_abc123",
  "result": {
    "stdout": "total 24\ndrwxr-xr-x 5 user user 4096 Jan 22 10:00 .\n...",
    "stderr": "",
    "exit_code": 0,
    "timed_out": false
  }
}
```

**Response:**
```json
{
  "status": "accepted",
  "continue_stream": true
}
```

---

## 9. Security Considerations

### 9.1 Defense in Depth

1. **Opt-in activation:** `--bash-tool` flag required
2. **User confirmation:** Default prompts before execution
3. **Command blocklist:** Prevents obviously dangerous patterns
4. **Output limits:** Prevents memory exhaustion
5. **Timeout enforcement:** Prevents runaway processes
6. **No persistence:** Working directory doesn't persist between calls

### 9.2 Documentation Requirements

- Clear warning in help text about security implications
- Document `--auto-confirm` as dangerous/advanced feature
- Provide examples of safe usage patterns
- Link to detailed security considerations in wiki

---

## 10. Conclusion

This proposal provides a comprehensive path to implementing local bash execution in the `ruska chat` CLI while maintaining the existing architectural patterns and prioritizing security. The hybrid execution model leverages the backend's LLM orchestration while empowering CLI users with local system access. The phased implementation approach allows for incremental delivery and testing.

**Recommended Next Steps:**
1. Review and approve this proposal
2. Create GitHub issue(s) for tracking
3. Begin Phase 1 (backend tool definition) implementation
4. Iterate based on integration testing feedback
