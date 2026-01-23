# ELITE COUNCIL REVIEW: CLI Bash Tool Implementation

**Feature Under Review:** Implement bash_tool functionality for `ruska chat` CLI command that allows local command execution
**Date:** 2026-01-22
**Council Members:** ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR | **Council Verdict** |
|--------|-----------|-----------|----------|-----------|------------|---------------------|
| **Architecture** | CLI-side interception with backend tool registration | CLI-side execution with multi-turn conversation | Consent-first with CLI-side execution | Client-side interception for latency reduction | Hybrid with backend coordination | **CLI-side interception with minimal backend changes** |
| **Backend Changes** | Register bash_tool as no-op marker | None required | None required | None required | New tool definition + tool-result endpoint | **Minimal: Register tool schema only** |
| **Security Model** | Risk assessment + confirmation | Explicit opt-in flag | Mandatory consent per command + blocklist | Opt-in flag + blocklist | User confirmation + blocklist | **Mandatory opt-in + blocklist + per-command consent** |
| **Conversation Continuity** | Thread continuation via POST | Multi-turn conversation | Inject tool messages locally | Inject results into stream | POST tool results to backend | **Thread continuation (Option A)** |
| **Effort Estimate** | 18-28 hours | 8-12 days | 14-16 hours | 12-16 hours | 22-38 hours | **16-24 hours** |
| **Risk Level** | Medium-High | Medium-High | High | Medium | Medium | **Medium-High** |

---

## 2. Consensus Points

All 5 proposals agree on the following fundamental decisions:

### 2.1 CLI-Side Execution
**Unanimous consensus**: The `bash_tool` should execute locally on the user's machine via Node.js `child_process`, NOT on the backend server. This eliminates:
- Network latency (200-500ms per tool call)
- Security risks of exposing shell server
- Infrastructure complexity

### 2.2 Opt-In Security Model
**Unanimous consensus**: Local command execution must be explicitly enabled via CLI flag. Suggested names:
- `--bash` (ARCHITECT, CRAFTSMAN)
- `--local-bash` (OPTIMIZER)
- `--bash-tool` (INTEGRATOR)
- `--local-tools` (ARCHITECT alternative)

**Council Decision**: Use `--bash` for simplicity, with `--local-tools` as future-extensible alias.

### 2.3 Node.js spawn() Over exec()
**Strong consensus (4/5)**: Use `spawn('bash', ['-c', command])` pattern for:
- Better process lifecycle control
- Streaming stdout/stderr capture
- Timeout enforcement
- Signal handling (SIGTERM → SIGKILL)

### 2.4 Safety Controls
**Unanimous consensus** on these safeguards:
- **Timeout**: Default 30 seconds
- **Output limits**: 1MB max to prevent memory exhaustion
- **Command blocklist**: Block catastrophic patterns (rm -rf /, fork bombs, etc.)
- **Exit code handling**: Non-zero should not terminate conversation

### 2.5 Stream Event Handling
**Unanimous consensus**: Intercept `tool_calls` in the existing `messages` SSE events. The infrastructure already exists:
- `MessagePayload.tool_calls` is defined in `types/stream.ts`
- CLI currently ignores tool_calls (line 336 in `chat.tsx`)

---

## 3. Divergence Analysis

### 3.1 Backend Changes Required?

| Proposal | Backend Changes | Rationale |
|----------|-----------------|-----------|
| ARCHITECT | Yes - register tool + potential endpoint | Enables LLM to bind to tool schema |
| CRAFTSMAN | No | CLI-only implementation |
| GUARDIAN | No | CLI-only implementation |
| OPTIMIZER | No | CLI-only implementation |
| INTEGRATOR | Yes - tool definition + tool-result endpoint | Full backend coordination |

**Council Analysis:**
- ARCHITECT and INTEGRATOR argue backend tool registration enables proper LLM binding
- CRAFTSMAN, GUARDIAN, OPTIMIZER argue CLI-only is simpler

**Council Decision:** **Minimal backend changes** - Register `bash_tool` schema so LLM can bind to it, but avoid new endpoints for MVP. Use existing thread continuation pattern.

**Rationale:**
1. Without backend tool registration, LLM cannot generate properly structured tool calls
2. Thread continuation via `POST /llm/stream` with `thread_id` works with existing infrastructure
3. New `/tool-result` endpoint adds complexity not needed for MVP

### 3.2 User Confirmation UX

| Proposal | Confirmation Approach |
|----------|----------------------|
| ARCHITECT | Risk-based: safe/moderate/dangerous levels |
| CRAFTSMAN | Opt-in flag, discussion of confirmation |
| GUARDIAN | **Mandatory consent per command** with visual prompt |
| OPTIMIZER | Opt-in flag, future confirmation |
| INTEGRATOR | Default confirmation with auto-confirm flag |

**Council Decision:** **Mandatory consent per command by default**, with:
- `--auto-approve` flag for power users (DANGEROUS)
- Visual React-Ink consent prompt (GUARDIAN design)
- Blocklist auto-denies without prompt
- Warning patterns show elevated warnings

**Rationale:** GUARDIAN's security-first approach prevents prompt injection attacks. Users must consciously approve each command.

### 3.3 Module Structure

| Proposal | Structure |
|----------|-----------|
| ARCHITECT | `lib/local-tools/bash-executor.ts`, `tool-interceptor.ts`, `security.ts` |
| CRAFTSMAN | `lib/local-tools/` with `types.ts`, `bash-executor.ts`, `orchestrator.ts`, `conversation-manager.ts` |
| GUARDIAN | `lib/bash-executor.ts`, `hooks/use-bash-consent.ts`, `components/BashConsentPrompt.tsx` |
| OPTIMIZER | `lib/local-tools/bash-executor.ts`, `lib/local-tools/index.ts` |
| INTEGRATOR | `lib/services/local-executor.ts`, `components/command-confirm.tsx` |

**Council Decision:** Hybrid structure:
```
cli/source/
├── lib/
│   └── local-tools/
│       ├── index.ts           # Public exports
│       ├── types.ts           # Type definitions (CRAFTSMAN)
│       ├── bash-executor.ts   # Execution logic (consensus)
│       └── security.ts        # Blocklist + risk assessment (ARCHITECT, GUARDIAN)
├── hooks/
│   └── use-bash-consent.ts    # Consent state machine (GUARDIAN)
└── components/
    └── BashConsentPrompt.tsx  # Consent UI (GUARDIAN, INTEGRATOR)
```

---

## 4. Unified Implementation Plan

### Phase 1: Foundation (4-6 hours)
**Priority: P0**

1. **Create type definitions** (`cli/source/lib/local-tools/types.ts`)
   - `BashToolRequest`: command, cwd, timeout
   - `BashToolResult`: stdout, stderr, exitCode, timedOut, truncated
   - Blocked commands and warning patterns (GUARDIAN)

2. **Create bash executor** (`cli/source/lib/local-tools/bash-executor.ts`)
   - `validateCommand()` with blocklist + injection detection (GUARDIAN)
   - `executeBash()` using spawn pattern (consensus)
   - `formatResultForLlm()` for output formatting

3. **Create security module** (`cli/source/lib/local-tools/security.ts`)
   - Risk assessment: safe/moderate/dangerous (ARCHITECT)
   - Blocked command list (GUARDIAN)
   - Warning patterns (GUARDIAN)

### Phase 2: Consent Flow (3-4 hours)
**Priority: P0**

1. **Create consent hook** (`cli/source/hooks/use-bash-consent.ts`)
   - State machine: idle → pending → decided (GUARDIAN pattern)
   - Auto-deny blocked commands
   - Track warnings for display

2. **Create consent UI** (`cli/source/components/BashConsentPrompt.tsx`)
   - React-Ink component (GUARDIAN design)
   - Display command, warnings, y/N prompt
   - Keyboard handling (y, n, Escape)

### Phase 3: Stream Integration (4-6 hours)
**Priority: P0**

1. **Modify use-stream.ts**
   - Detect `tool_calls` in messages events for `bash_tool`
   - Pause stream, trigger consent flow
   - Execute locally on approval
   - Build continuation request with tool result

2. **Modify stream types** (`cli/source/types/stream.ts`)
   - Add `ToolResultMessage` type
   - Extend `StreamRequest.input.messages` to include tool messages

3. **Implement conversation continuation**
   - Use thread continuation pattern (ARCHITECT Option A)
   - POST to `/llm/stream` with `thread_id` and tool result message
   - Resume stream consumption

### Phase 4: CLI Integration (2-3 hours)
**Priority: P1**

1. **Update cli.tsx**
   - Add `--bash` flag (boolean, default: false)
   - Add `--auto-approve` flag (boolean, default: false) with warning
   - Add `--bash-timeout` flag (number, default: 30000)

2. **Update tools.ts**
   - Add `bash_tool` to `localTools` constant
   - Add `isLocalTool()` type guard
   - Conditionally include in tools array when `--bash` enabled

3. **Update chat.tsx**
   - Pass `enableBash` prop to ChatCommandTui
   - Integrate consent flow rendering
   - Display bash tool output with special formatting

### Phase 5: Backend Tool Registration (2-3 hours)
**Priority: P1**

1. **Create bash_tool.py** (`backend/src/tools/bash_tool.py`)
   - Schema-only tool definition
   - Raises `NotImplementedError` as safety net
   - Clear docstring indicating CLI-side execution

2. **Register in __init__.py**
   - Add to tool library when requested via tools array
   - Do NOT add to default tools

### Phase 6: Testing & Documentation (4-6 hours)
**Priority: P1**

1. **Unit tests**
   - `bash-executor.test.ts`: command validation, execution, timeout
   - `use-bash-consent.test.ts`: state machine, auto-deny

2. **Integration tests**
   - Full flow with mocked stream
   - Conversation continuation

3. **Manual testing checklist** (GUARDIAN)
   - Safe commands (`ls`, `pwd`, `echo`)
   - Blocked commands (`rm -rf /`)
   - Warning commands (`sudo`)
   - Timeout behavior
   - Ctrl+C handling

4. **Documentation**
   - Update CLI help text
   - Security warnings
   - Usage examples

---

## 5. Risk Consolidation

### 5.1 Security Risks

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| Arbitrary code execution | Critical | Opt-in flag + per-command consent | GUARDIAN |
| Prompt injection via LLM | High | User sees exact command before approval | GUARDIAN |
| Fork bombs | Critical | Blocklist pattern | GUARDIAN |
| Credential theft | High | User approves commands accessing sensitive paths | GUARDIAN |
| Memory exhaustion | Medium | 1MB output limit | OPTIMIZER |
| Runaway processes | Medium | 30s timeout + SIGKILL | OPTIMIZER |

### 5.2 Technical Risks

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| Stream synchronization | High | Buffer events during consent, state machine | ARCHITECT |
| Cross-platform compatibility | Medium | Platform detection, document Windows WSL | CRAFTSMAN |
| Tool call ID mismatch | Medium | Strict ID tracking | ARCHITECT |
| Infinite tool loops | Medium | Max tool call depth (10) | CRAFTSMAN |
| Binary output | Low | Detect and truncate | OPTIMIZER |

---

## 6. Final Verdict

### GO / NO-GO / CONDITIONAL

**Verdict:** **CONDITIONAL GO**

### Required Conditions

1. **Security review required** before merge
   - Blocklist patterns verified manually
   - Consent flow cannot be bypassed
   - No auto-approve by default

2. **Opt-in only** - `--bash` flag must be explicitly passed

3. **Per-command consent** - Default behavior requires y/N approval

4. **Documentation** - Clear security warnings in help text and README

### Confidence Level

**Confidence:** **High**

The unified plan:
- Leverages strong consensus on CLI-side execution
- Incorporates GUARDIAN's security-first approach
- Uses ARCHITECT's thread continuation pattern
- Maintains OPTIMIZER's performance focus
- Aligns with existing codebase patterns (CRAFTSMAN)

---

## 7. Implementation Summary

### New Files (8)
```
cli/source/lib/local-tools/index.ts
cli/source/lib/local-tools/types.ts
cli/source/lib/local-tools/bash-executor.ts
cli/source/lib/local-tools/security.ts
cli/source/hooks/use-bash-consent.ts
cli/source/components/BashConsentPrompt.tsx
cli/source/__tests__/bash-executor.test.ts
backend/src/tools/bash_tool.py
```

### Modified Files (7)
```
cli/source/cli.tsx
cli/source/commands/chat.tsx
cli/source/hooks/use-stream.ts
cli/source/lib/tools.ts
cli/source/types/stream.ts
backend/src/tools/__init__.py
```

### Estimated Total Effort
**16-24 hours** (developer hours, not calendar time)

### Recommended Implementation Order
1. Phase 1: Foundation (types, executor, security)
2. Phase 2: Consent flow (hook, UI component)
3. Phase 3: Stream integration (most complex)
4. Phase 5: Backend tool registration
5. Phase 4: CLI flags and integration
6. Phase 6: Testing and documentation

---

*Council Review Complete*
*Ready for TASKS.md Generation*
