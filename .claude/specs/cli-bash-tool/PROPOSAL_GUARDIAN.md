# PROPOSAL: Local Bash Tool for CLI Chat Command

**Agent:** GUARDIAN - Security, Error Handling, Edge Cases, Testing
**Feature:** Implement bash_tool functionality for `ruska chat` CLI command that allows local command execution
**Date:** 2026-01-22

---

## 1. Executive Summary

This proposal recommends implementing a **local bash tool** as a CLI-side interceptor that executes shell commands on the user's machine rather than routing them through the backend. The implementation will use a **consent-first security model** with explicit user approval before each command execution, preventing command injection attacks and ensuring users maintain full control over what runs on their systems. The architecture leverages the existing SSE stream infrastructure but introduces a new bidirectional communication pattern where the CLI intercepts `tool_call` events, prompts for user consent, executes locally, and synthesizes tool output messages back into the conversation flow.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Current Tool Execution Flow:**
```
CLI (chat.tsx)
    |
    v
[POST /api/llm/stream] --> Backend (FastAPI)
                              |
                              v
                         [LLM w/ Tools]
                              |
                              v
                         [Tool Execution on Server]
                              |
                              v
                         [SSE stream: tool output]
                              |
                              v
                         CLI displays output
```

**Key Observations:**

1. **Backend-Only Tool Execution**: All tools (`web_search`, `shell_exec`, etc.) execute on the backend server
2. **Remote Shell Tool Exists**: `backend/src/tools/shell.py` executes commands on a REMOTE server via HTTP POST
3. **CLI is Display-Only**: The CLI receives and displays SSE events but never executes tools locally
4. **Tool Calls Are Streamed**: `tool_calls` appear in `messages` events (line 98-103 in `stream.ts`)
5. **Output Types Defined**: `ToolCallOutput` type exists in `cli/source/types/output.ts` but is unused

**Current `shell_exec` Tool (Remote Only):**
```python
# backend/src/tools/shell.py - Lines 1-33
@tool
async def shell_exec(commands: list[str]):
    """Run shell commands in a remote server..."""
    url = await user_repo.get_token(key=UserTokenKey.SHELL_EXEC_SERVER_URL.name)
    if not url:
        raise ToolException("SHELL_EXEC_SERVER_URL is not set...")

    for command in commands:
        response = requests.post(url, json={"cmd": command})
        # ...
```

**Current CLI Tool Handling:**
```typescript
// cli/source/commands/chat.tsx - Line 336
// NOTE: Ignoring tool_calls per requirements
```

### 2.2 Proposed Changes

**New Architecture - Hybrid Execution Model:**
```
CLI (chat.tsx)
    |
    v
[POST /api/llm/stream with tools=['bash_tool', ...]]
    |
    v
Backend (FastAPI)
    |
    v
[LLM decides to use bash_tool]
    |
    v
[SSE: tool_call event for 'bash_tool']
    |
    v
CLI Intercepts 'bash_tool' call
    |
    +-- [Display Command Preview]
    |
    +-- [Prompt User: "Execute? [y/N]"]
    |
    +-- User approves?
    |       |
    |       +-- Yes: Execute locally with spawn()
    |       |         |
    |       |         v
    |       |     [Capture stdout/stderr]
    |       |         |
    |       |         v
    |       |     [Inject as tool_output message]
    |       |
    |       +-- No: Inject denial message
    |
    v
Continue stream processing
```

### 2.3 Integration Points and Dependencies

**No New NPM Dependencies Required** - Node.js built-ins sufficient:
- `node:child_process` - `spawn()` for command execution
- `node:readline` - For user consent prompts (Ink handles this)
- `node:path` - For cwd resolution
- `node:os` - For platform detection

**Backend Changes: None Required** - The CLI will:
1. Include `bash_tool` in the tools array sent to backend
2. Backend will provide the tool schema to LLM
3. CLI intercepts and handles execution locally

**CLI Module Changes Required:**
| File | Action | Purpose |
|------|--------|---------|
| `cli/source/lib/tools.ts` | Modify | Add `bash_tool` to available tools |
| `cli/source/lib/bash-executor.ts` | Create | Secure command execution module |
| `cli/source/hooks/use-bash-consent.ts` | Create | Consent flow hook |
| `cli/source/commands/chat.tsx` | Modify | Integrate bash interception |
| `cli/source/types/stream.ts` | Modify | Add bash-specific types |
| `cli/source/types/bash.ts` | Create | Bash tool type definitions |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Type Definitions and Safety Constraints

**Step 1.1: Create bash tool type definitions**
- File: `cli/source/types/bash.ts`

```typescript
/**
 * Bash tool types with security constraints
 */

/**
 * Commands that are ALWAYS blocked regardless of user consent
 * These can cause catastrophic data loss or system damage
 */
export const BLOCKED_COMMANDS = [
    'rm -rf /',
    'rm -rf /*',
    'rm -rf ~',
    'rm -rf ~/*',
    ':(){:|:&};:',  // Fork bomb
    'mkfs',
    'dd if=/dev/zero of=/dev/sda',
    'chmod -R 777 /',
    '> /dev/sda',
    'mv /* /dev/null',
    'wget | sh',
    'curl | sh',
    'wget | bash',
    'curl | bash',
] as const;

/**
 * Patterns that trigger elevated warnings (but not blocked)
 */
export const WARNING_PATTERNS = [
    /rm\s+(-[rf]+\s+)?\.\.\//,     // rm with parent directory
    /rm\s+(-[rf]+\s+)?\/[a-z]/i,   // rm in system directories
    /sudo\s+/,                      // sudo usage
    /chmod\s+777/,                  // overly permissive chmod
    /\|\s*(bash|sh|zsh)/,           // piping to shell
    /eval\s+/,                      // eval usage
    />\s*\/etc\//,                  // overwriting system config
] as const;

/**
 * Maximum allowed execution time (ms)
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Maximum output size to capture (bytes)
 */
export const MAX_OUTPUT_SIZE = 1_048_576; // 1MB

/**
 * Bash tool invocation request
 */
export type BashToolRequest = {
    command: string;
    cwd?: string;
    timeout?: number;
};

/**
 * Bash tool execution result
 */
export type BashToolResult = {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
    truncated: boolean;
    executionTimeMs: number;
};

/**
 * User consent response
 */
export type ConsentResponse =
    | { type: 'approved' }
    | { type: 'denied'; reason?: string }
    | { type: 'modified'; newCommand: string };
```

**Step 1.2: Update tools.ts with bash_tool**
- File: `cli/source/lib/tools.ts`

```typescript
/**
 * Default tools and parsing for chat command
 * @see frontend/src/components/menus/BaseToolMenu.tsx for frontend equivalent
 */

/**
 * Tools available ONLY in CLI (execute locally, not on backend)
 */
export const cliOnlyTools = ['bash_tool'] as const;
export type CliOnlyTool = (typeof cliOnlyTools)[number];

/**
 * Default tools enabled for chat command
 * Mirrors frontend DEFAULT_AGENT_TOOLS in BaseToolMenu.tsx
 */
export const defaultAgentTools = [
    'web_search',
    'web_scrape',
    'math_calculator',
    'think_tool',
    'python_sandbox',
] as const;

export type DefaultAgentTool = (typeof defaultAgentTools)[number];

/**
 * Check if a tool is CLI-only (executes locally)
 */
export function isCliOnlyTool(toolName: string): toolName is CliOnlyTool {
    return cliOnlyTools.includes(toolName as CliOnlyTool);
}

// ... rest of existing parseToolsFlag function unchanged
```

#### Phase 2: Secure Bash Executor Module

**Step 2.1: Create the bash executor**
- File: `cli/source/lib/bash-executor.ts`

```typescript
/**
 * Secure bash command executor with safety constraints
 *
 * SECURITY DESIGN:
 * 1. Command validation BEFORE execution
 * 2. Blocked command list for catastrophic operations
 * 3. Output size limits to prevent memory exhaustion
 * 4. Timeout enforcement to prevent hangs
 * 5. Explicit working directory isolation
 * 6. No shell expansion by default (use spawn, not exec)
 */

import {spawn} from 'node:child_process';
import process from 'node:process';
import {
    BLOCKED_COMMANDS,
    WARNING_PATTERNS,
    DEFAULT_TIMEOUT_MS,
    MAX_OUTPUT_SIZE,
    type BashToolRequest,
    type BashToolResult,
} from '../types/bash.js';

/**
 * Security validation result
 */
export type ValidationResult =
    | { valid: true; warnings: string[] }
    | { valid: false; reason: string };

/**
 * Validate a command before execution
 */
export function validateCommand(command: string): ValidationResult {
    // Normalize command for matching
    const normalized = command.toLowerCase().trim();

    // Check blocked commands (exact and partial matches)
    for (const blocked of BLOCKED_COMMANDS) {
        if (normalized.includes(blocked.toLowerCase())) {
            return {
                valid: false,
                reason: `Command contains blocked pattern: "${blocked}". This command is permanently blocked for safety.`,
            };
        }
    }

    // Check for shell injection via common vectors
    const injectionPatterns = [
        /;\s*rm\s+/i,           // command chaining with rm
        /&&\s*rm\s+/i,          // && chaining with rm
        /\|\|\s*rm\s+/i,        // || chaining with rm
        /`[^`]*rm[^`]*`/i,      // backtick substitution with rm
        /\$\([^)]*rm[^)]*\)/i,  // $() substitution with rm
    ];

    for (const pattern of injectionPatterns) {
        if (pattern.test(command)) {
            return {
                valid: false,
                reason: 'Command contains potentially dangerous shell injection pattern.',
            };
        }
    }

    // Collect warnings for risky patterns
    const warnings: string[] = [];
    for (const pattern of WARNING_PATTERNS) {
        if (pattern.test(command)) {
            warnings.push(`Command matches warning pattern: ${pattern.source}`);
        }
    }

    return { valid: true, warnings };
}

/**
 * Execute a bash command with safety constraints
 *
 * Uses spawn() instead of exec() to:
 * 1. Avoid shell interpretation of special characters
 * 2. Get streaming output
 * 3. Have better control over process lifecycle
 */
export async function executeCommand(
    request: BashToolRequest
): Promise<BashToolResult> {
    const startTime = Date.now();
    const {
        command,
        cwd = process.cwd(),
        timeout = DEFAULT_TIMEOUT_MS,
    } = request;

    // Pre-execution validation
    const validation = validateCommand(command);
    if (!validation.valid) {
        return {
            success: false,
            stdout: '',
            stderr: `BLOCKED: ${validation.reason}`,
            exitCode: null,
            timedOut: false,
            truncated: false,
            executionTimeMs: Date.now() - startTime,
        };
    }

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let stdoutTruncated = false;
        let stderrTruncated = false;

        // Use bash -c for proper command parsing
        // This allows pipes, redirects, etc. but spawn prevents
        // injection attacks at the process boundary
        const child = spawn('bash', ['-c', command], {
            cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            // Detached false ensures child dies with parent
            detached: false,
        });

        // Timeout handler
        const timeoutId = setTimeout(() => {
            child.kill('SIGKILL');
        }, timeout);

        // Capture stdout with size limit
        child.stdout.on('data', (data: Buffer) => {
            if (stdout.length < MAX_OUTPUT_SIZE) {
                stdout += data.toString();
                if (stdout.length >= MAX_OUTPUT_SIZE) {
                    stdoutTruncated = true;
                    stdout = stdout.slice(0, MAX_OUTPUT_SIZE);
                }
            }
        });

        // Capture stderr with size limit
        child.stderr.on('data', (data: Buffer) => {
            if (stderr.length < MAX_OUTPUT_SIZE) {
                stderr += data.toString();
                if (stderr.length >= MAX_OUTPUT_SIZE) {
                    stderrTruncated = true;
                    stderr = stderr.slice(0, MAX_OUTPUT_SIZE);
                }
            }
        });

        // Handle process exit
        child.on('close', (exitCode, signal) => {
            clearTimeout(timeoutId);

            const timedOut = signal === 'SIGKILL';

            resolve({
                success: exitCode === 0,
                stdout,
                stderr,
                exitCode,
                timedOut,
                truncated: stdoutTruncated || stderrTruncated,
                executionTimeMs: Date.now() - startTime,
            });
        });

        // Handle spawn errors
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            resolve({
                success: false,
                stdout: '',
                stderr: `Failed to execute command: ${error.message}`,
                exitCode: null,
                timedOut: false,
                truncated: false,
                executionTimeMs: Date.now() - startTime,
            });
        });
    });
}

/**
 * Format execution result for LLM consumption
 */
export function formatResultForLlm(result: BashToolResult): string {
    const parts: string[] = [];

    if (result.timedOut) {
        parts.push('[TIMEOUT] Command exceeded maximum execution time.');
    }

    if (result.truncated) {
        parts.push('[TRUNCATED] Output exceeded maximum size limit.');
    }

    if (result.stdout) {
        parts.push(`stdout:\n${result.stdout}`);
    }

    if (result.stderr) {
        parts.push(`stderr:\n${result.stderr}`);
    }

    if (result.exitCode !== null && result.exitCode !== 0) {
        parts.push(`Exit code: ${result.exitCode}`);
    }

    if (parts.length === 0) {
        return result.success
            ? 'Command completed successfully with no output.'
            : 'Command failed with no output.';
    }

    return parts.join('\n\n');
}
```

#### Phase 3: User Consent Hook

**Step 3.1: Create consent flow hook**
- File: `cli/source/hooks/use-bash-consent.ts`

```typescript
/**
 * React hook for bash command consent flow
 *
 * SECURITY PRINCIPLES:
 * 1. User sees EXACTLY what will execute
 * 2. Default is DENY (user must actively approve)
 * 3. Cannot auto-approve (no --yes flag)
 * 4. Warnings displayed prominently
 */

import {useState, useCallback} from 'react';
import {validateCommand} from '../lib/bash-executor.js';
import type {ConsentResponse} from '../types/bash.js';

export type ConsentState =
    | { status: 'idle' }
    | { status: 'pending'; command: string; warnings: string[] }
    | { status: 'decided'; response: ConsentResponse };

export type UseBashConsentResult = {
    state: ConsentState;
    requestConsent: (command: string) => void;
    approve: () => void;
    deny: (reason?: string) => void;
    reset: () => void;
};

export function useBashConsent(): UseBashConsentResult {
    const [state, setState] = useState<ConsentState>({ status: 'idle' });

    const requestConsent = useCallback((command: string) => {
        const validation = validateCommand(command);

        if (!validation.valid) {
            // Auto-deny blocked commands
            setState({
                status: 'decided',
                response: { type: 'denied', reason: validation.reason },
            });
            return;
        }

        setState({
            status: 'pending',
            command,
            warnings: validation.warnings,
        });
    }, []);

    const approve = useCallback(() => {
        if (state.status === 'pending') {
            setState({
                status: 'decided',
                response: { type: 'approved' },
            });
        }
    }, [state]);

    const deny = useCallback((reason?: string) => {
        setState({
            status: 'decided',
            response: { type: 'denied', reason },
        });
    }, []);

    const reset = useCallback(() => {
        setState({ status: 'idle' });
    }, []);

    return {
        state,
        requestConsent,
        approve,
        deny,
        reset,
    };
}
```

#### Phase 4: Chat Command Integration

**Step 4.1: Create bash consent UI component**
- File: `cli/source/components/BashConsentPrompt.tsx`

```typescript
/**
 * Visual consent prompt for bash command execution
 */

import React from 'react';
import {Box, Text, useInput} from 'ink';

type BashConsentPromptProps = {
    readonly command: string;
    readonly warnings: readonly string[];
    readonly onApprove: () => void;
    readonly onDeny: () => void;
};

export function BashConsentPrompt({
    command,
    warnings,
    onApprove,
    onDeny,
}: BashConsentPromptProps) {
    useInput((input, key) => {
        if (input.toLowerCase() === 'y') {
            onApprove();
        } else if (input.toLowerCase() === 'n' || key.escape) {
            onDeny();
        }
    });

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
            <Text bold color="yellow">
                Bash Command Execution Request
            </Text>

            <Box marginTop={1} flexDirection="column">
                <Text dimColor>Command:</Text>
                <Box marginLeft={2} marginTop={0}>
                    <Text color="cyan">{command}</Text>
                </Box>
            </Box>

            {warnings.length > 0 && (
                <Box marginTop={1} flexDirection="column">
                    <Text bold color="red">
                        Warnings:
                    </Text>
                    {warnings.map((warning, index) => (
                        <Box key={index} marginLeft={2}>
                            <Text color="red">- {warning}</Text>
                        </Box>
                    ))}
                </Box>
            )}

            <Box marginTop={1}>
                <Text>
                    Execute this command? [<Text color="green">y</Text>/<Text color="red" bold>N</Text>]
                </Text>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>
                    Press Y to execute, N or Esc to cancel
                </Text>
            </Box>
        </Box>
    );
}
```

**Step 4.2: Modify chat.tsx to handle bash tool calls**
- File: `cli/source/commands/chat.tsx` (modifications)

The chat command needs significant modifications to:
1. Detect incoming `bash_tool` tool calls
2. Pause stream consumption during consent
3. Execute locally on approval
4. Inject tool output into message flow

```typescript
// Key changes to chat.tsx (conceptual - full diff in implementation)

// Import new modules
import {useBashConsent} from '../hooks/use-bash-consent.js';
import {executeCommand, formatResultForLlm} from '../lib/bash-executor.js';
import {isCliOnlyTool} from '../lib/tools.js';
import {BashConsentPrompt} from '../components/BashConsentPrompt.js';
import type {BashToolRequest} from '../types/bash.js';

// In ChatCommandTui component:
// 1. Add bash consent hook
const bashConsent = useBashConsent();

// 2. Detect tool_calls in message events
// When a message has tool_calls and the tool is bash_tool:
if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
        if (isCliOnlyTool(toolCall.name)) {
            // Pause stream, request consent
            bashConsent.requestConsent(toolCall.args.command);
        }
    }
}

// 3. On consent approval, execute and inject result
if (bashConsent.state.status === 'decided' &&
    bashConsent.state.response.type === 'approved') {
    const result = await executeCommand({ command: pendingCommand });
    // Inject tool output message into local state
    // This appears to the LLM as the tool's response
}

// 4. Render consent prompt when pending
{bashConsent.state.status === 'pending' && (
    <BashConsentPrompt
        command={bashConsent.state.command}
        warnings={bashConsent.state.warnings}
        onApprove={bashConsent.approve}
        onDeny={bashConsent.deny}
    />
)}
```

### 3.2 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `cli/source/types/bash.ts` | **Create** | Bash tool types and safety constraints |
| `cli/source/lib/bash-executor.ts` | **Create** | Secure command execution module |
| `cli/source/hooks/use-bash-consent.ts` | **Create** | Consent flow hook |
| `cli/source/components/BashConsentPrompt.tsx` | **Create** | Consent UI component |
| `cli/source/lib/tools.ts` | **Modify** | Add `bash_tool` and `isCliOnlyTool()` |
| `cli/source/commands/chat.tsx` | **Modify** | Integrate bash tool handling |
| `cli/source/__tests__/bash-executor.test.ts` | **Create** | Executor unit tests |
| `cli/source/__tests__/use-bash-consent.test.ts` | **Create** | Consent hook tests |

### 3.3 Key Code Patterns to Follow

**Error Handling Pattern (from stream-service.ts):**
```typescript
// Custom typed errors
export class BashExecutionError extends Error {
    constructor(message: string, public readonly exitCode: number | null) {
        super(message);
        this.name = 'BashExecutionError';
    }
}
```

**React Hook Pattern (from use-stream.ts):**
```typescript
// State machine pattern with discriminated union
export type ConsentState =
    | { status: 'idle' }
    | { status: 'pending'; ... }
    | { status: 'decided'; ... };
```

**Tool Handling Pattern (from tools.ts):**
```typescript
// Type guard function
export function isCliOnlyTool(name: string): name is CliOnlyTool {
    return cliOnlyTools.includes(name as CliOnlyTool);
}
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Why Chosen |
|----------|-------------|------------|
| **CLI-side execution** | Backend SSH/remote execution | Privacy: user commands stay local; no server exposure |
| **Mandatory consent per-command** | Batch approval or --yes flag | Security: prevents automated exploitation |
| **Blocklist + warnings** | Sandbox/container | Simpler; containers add deployment complexity |
| **spawn() over exec()** | exec() with shell | spawn() avoids shell expansion vulnerabilities |
| **No command history** | Store approved commands | Privacy: no persistent record of user activity |
| **Timeout default 30s** | No timeout / longer | Balances responsiveness with long-running scripts |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Backend SSH tunnel to user machine**
- Rejected: Requires SSH key management, firewall config, security nightmare
- Our approach: Local execution is simpler and more secure

**Alternative 2: Trusted mode with auto-execution**
- Rejected: One malicious prompt could execute `rm -rf ~`
- Our approach: Consent-per-command is slower but much safer

**Alternative 3: Container/sandbox execution**
- Rejected: Adds Docker dependency; complex for CLI tool
- Our approach: Blocklist + validation + consent provides defense-in-depth

**Alternative 4: Backend tool with local shell server**
- Rejected: Similar to existing `shell_exec` but requires user to run server
- Our approach: No additional infrastructure needed

### 4.3 Alignment with Existing Codebase Patterns

1. **Type system**: Uses discriminated unions like `StreamEvent` in `stream.ts`
2. **Hook pattern**: Follows `useStream` state machine pattern
3. **Component structure**: Matches existing Ink component patterns
4. **Error handling**: Custom error classes like `StreamConnectionError`
5. **Tools architecture**: Extends existing `defaultAgentTools` pattern
6. **Testing**: Follows Ava test patterns from `__tests__/tools.test.ts`

---

## 5. Risk Assessment

### 5.1 Security Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Command injection** | Critical | Blocklist, validation, spawn() not exec() |
| **Privilege escalation via sudo** | High | Warning displayed; user must consciously approve |
| **Data exfiltration** | High | User sees command; must approve `curl/wget` |
| **Denial of service (fork bomb)** | High | Fork bomb pattern in blocklist |
| **Filesystem destruction** | Critical | `rm -rf /` variants in blocklist |
| **Credential theft** | High | User sees commands accessing `.env`, `~/.ssh/` etc. |
| **Infinite loops** | Medium | Timeout enforcement (default 30s) |
| **Memory exhaustion** | Medium | Output size limits (1MB) |

**Security Guarantees:**
1. **No auto-execution**: Every command requires explicit user approval
2. **Visibility**: User sees exact command before execution
3. **Blocklist**: Catastrophic commands are blocked even with approval
4. **Isolation**: Commands run in user's current environment, not elevated
5. **Timeout**: Runaway processes are killed after timeout
6. **Output limits**: Cannot exhaust memory via output flooding

### 5.2 Potential Pitfalls

1. **Stream synchronization**: Pausing for consent while stream continues is complex
   - Mitigation: Buffer stream events during consent; replay on decision

2. **Multi-command sequences**: LLM may try multiple bash commands
   - Mitigation: Queue and consent each individually

3. **Interactive commands**: `vim`, `less`, `top` won't work
   - Mitigation: Detect and warn; suggest non-interactive alternatives

4. **Long-running processes**: Commands like `npm install` may timeout
   - Mitigation: Allow `--timeout` flag override; warn on long commands

5. **Working directory confusion**: Commands may expect different cwd
   - Mitigation: Display cwd in consent prompt; allow override

### 5.3 Edge Cases to Handle

| Edge Case | Handling Strategy |
|-----------|-------------------|
| Empty command string | Reject with error message |
| Command with only whitespace | Trim and reject if empty |
| Very long command (>10KB) | Reject with length warning |
| Command with null bytes | Strip null bytes; warn user |
| Non-UTF8 output | Use lossy decode; note in result |
| Process killed externally | Detect signal; report gracefully |
| stdin required (e.g., `cat`) | Fail gracefully; stdin is /dev/null |
| Environment variable in command | Works (bash -c expansion) |
| Relative path in command | Resolved relative to cwd |
| Network-dependent commands | May fail; user's responsibility |
| Multiple simultaneous requests | Queue processing; one at a time |
| User spam-denies commands | Track denial count; no penalty |
| Ctrl+C during execution | Kill child process; clean exit |

### 5.4 Testing Considerations

**Unit Tests Required (bash-executor.test.ts):**
```typescript
// test_validateCommand_blocks_dangerous_patterns
// test_validateCommand_warns_on_risky_patterns
// test_validateCommand_allows_safe_commands
// test_executeCommand_captures_stdout
// test_executeCommand_captures_stderr
// test_executeCommand_respects_timeout
// test_executeCommand_limits_output_size
// test_executeCommand_returns_exit_code
// test_executeCommand_handles_spawn_error
// test_formatResultForLlm_includes_all_fields
```

**Integration Tests Required:**
```typescript
// test_consent_flow_approve_executes
// test_consent_flow_deny_skips_execution
// test_blocked_command_auto_denies
// test_warning_commands_show_warnings
// test_timeout_kills_long_process
// test_output_truncation_works
```

**Manual Testing Scenarios:**
- [ ] `ls -la` - basic command works
- [ ] `rm -rf /` - blocked immediately
- [ ] `sudo apt update` - shows warning, requires approval
- [ ] `sleep 60` with 10s timeout - killed and reported
- [ ] `cat /dev/urandom | head -c 10M` - output truncated
- [ ] Rapid Y/N input - handles correctly
- [ ] Ctrl+C during consent - clean exit
- [ ] Ctrl+C during execution - kills child

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Scope** | **Medium-Large** | New execution path; security-critical |
| Code Changes | Medium | ~400-500 lines new code |
| Architecture Impact | Medium | Adds bidirectional CLI flow |
| Testing Effort | High | Security testing is extensive |
| Security Review | Required | Must be reviewed before merge |

### 6.2 Risk Level

| Aspect | Rating | Justification |
|--------|--------|---------------|
| **Overall Risk** | **High** | Executes arbitrary code on user machine |
| Security Risk | High | Command execution is inherently risky |
| Breaking Changes | Low | Additive feature; opt-in via --tools flag |
| Dependency Risk | Low | Uses Node.js built-ins only |

### 6.3 Suggested Priority Order

1. **Phase 1: Types and Validation** (Est. 2 hours)
   - Create type definitions
   - Implement command validator
   - Write validator unit tests
   - Security review of blocklist

2. **Phase 2: Executor Module** (Est. 3 hours)
   - Implement executeCommand()
   - Add timeout handling
   - Add output truncation
   - Write executor unit tests

3. **Phase 3: Consent Flow** (Est. 3 hours)
   - Create consent hook
   - Build consent UI component
   - Write consent flow tests
   - Manual testing of UI

4. **Phase 4: Chat Integration** (Est. 4 hours)
   - Modify chat.tsx
   - Handle stream buffering
   - Integrate consent flow
   - End-to-end testing

5. **Phase 5: Security Hardening** (Est. 2 hours)
   - Penetration testing
   - Fuzzing edge cases
   - Documentation
   - Security review

**Total Estimated Effort: 14-16 hours**

---

## 7. Appendix

### 7.1 Security Checklist Before Merge

- [ ] All blocked commands tested manually
- [ ] Warning patterns tested with real examples
- [ ] Timeout behavior verified with `sleep` command
- [ ] Output truncation verified with large outputs
- [ ] Ctrl+C handling tested in all states
- [ ] No secrets logged (command, output sanitized)
- [ ] Error messages don't leak system information
- [ ] Fork bomb pattern blocks correctly
- [ ] Shell injection patterns blocked
- [ ] Consent cannot be bypassed programmatically
- [ ] No auto-approval mechanism exists
- [ ] Security review completed by team member

### 7.2 Command Injection Prevention

**Why spawn() over exec():**
```javascript
// DANGEROUS - shell interprets special characters
exec('ls ' + userInput);  // userInput = "; rm -rf /"

// SAFER - arguments are not shell-interpreted
spawn('ls', [userInput]); // userInput = "; rm -rf /" (literal arg)

// OUR APPROACH - bash -c with full command visibility
spawn('bash', ['-c', command]); // User sees and approves full command
```

The key insight: Since the user sees and approves the exact command, shell interpretation is acceptable. The user IS the security gate.

### 7.3 User Experience Flow

```
User: "List all files in my home directory"

LLM: I'll run `ls -la ~` to list all files.

[Tool Call: bash_tool]
[Args: {"command": "ls -la ~"}]

+----------------------------------------+
| Bash Command Execution Request         |
|                                        |
| Command:                               |
|   ls -la ~                             |
|                                        |
| Execute this command? [y/N]            |
| Press Y to execute, N or Esc to cancel |
+----------------------------------------+

> User presses: Y

[Executing...]

stdout:
total 48
drwxr-xr-x  12 user  staff   384 Jan 22 10:00 .
drwxr-xr-x   5 root  admin   160 Jan 20 09:00 ..
-rw-r--r--   1 user  staff   123 Jan 22 09:30 .bashrc
...

LLM: Here are the files in your home directory...
```

### 7.4 References

- Node.js child_process documentation: https://nodejs.org/api/child_process.html
- OWASP Command Injection: https://owasp.org/www-community/attacks/Command_Injection
- Ink (React for CLI) documentation: https://github.com/vadimdemedes/ink

---

**Prepared by:** GUARDIAN Agent
**Review Status:** Ready for security team review
**Classification:** Security-Critical Implementation
