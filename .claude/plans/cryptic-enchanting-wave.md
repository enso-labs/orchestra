# Plan: Generate Specs for MCP Sandbox Backend (#890 + sandboxes#3)

## Context

Orchestra needs `McpSandboxBackend(BaseSandbox)` to connect DeepAgents to the `ruska-ai/sandboxes` exec_server via MCP JSON-RPC 2.0 over Streamable HTTP. This is a two-repo effort:

- **orchestra#890**: New `McpSandboxBackend` class, wired into sandbox dispatch with Daytona -> MCP -> State fallback chain, frontend selector update
- **sandboxes#3**: exec_server enhancements (structured `_meta` exit_code, `upload_file`/`download_file` tools, sandbox ID)

The key constraint is **backward compatibility**: Phase 1 must work with the CURRENT exec_server (text-embedded exit_code, no file transfer tools). Later phases leverage structured responses.

## Approach

Generate **5 specs** in the `.claude/specs/feat-890-mcp-sandbox/` directory, organized in dependency order with clear parallelization opportunities.

## BaseSandbox Full Tool Parity Requirement

`McpSandboxBackend(BaseSandbox)` must support ALL DeepAgents sandbox tools. `BaseSandbox` (from `deepagents.backends.sandbox`) provides inherited implementations for most — they all delegate to `execute()` via shell commands. Only 4 methods are abstract and must be implemented:

| Method | Abstract? | How it works |
|--------|-----------|--------------|
| `execute(command, *, timeout) -> ExecuteResponse` | **YES** | MCP JSON-RPC `tools/call` to `execute` |
| `id -> str` | **YES** | Sandbox identifier property |
| `upload_files(files) -> list[FileUploadResponse]` | **YES** | Base64 via `upload_file` tool or shell fallback |
| `download_files(paths) -> list[FileDownloadResponse]` | **YES** | Base64 via `download_file` tool or shell fallback |
| `read(file_path, offset, limit) -> str` | Inherited | Delegates to `execute()` via `_READ_COMMAND_TEMPLATE` (python3 heredoc) |
| `write(file_path, content) -> WriteResult` | Inherited | Delegates to `execute()` via `_WRITE_COMMAND_TEMPLATE` (python3 heredoc) |
| `edit(file_path, old, new, replace_all) -> EditResult` | Inherited | Delegates to `execute()` via `_EDIT_COMMAND_TEMPLATE` (python3 heredoc) |
| `grep_raw(pattern, path, glob) -> list[GrepMatch]` | Inherited | Delegates to `execute()` via `grep -rHnF` command |
| `ls_info(path) -> list[FileInfo]` | Inherited | Delegates to `execute()` via `os.scandir` python3 command |
| `glob_info(pattern, path) -> list[FileInfo]` | Inherited | Delegates to `execute()` via `_GLOB_COMMAND_TEMPLATE` (python3 heredoc) |

**Critical**: All inherited methods depend on `execute()` returning a proper `ExecuteResponse` with integer `exit_code`. The python3 heredoc commands use `sys.exit(N)` for error signaling — exit codes 1-4 have semantic meaning in `edit()`. The sandbox container MUST have `python3` available (the Dockerfile installs Node.js 22 on Debian bookworm which includes python3).

**Return types**: `FileUploadResponse(path, error?)`, `FileDownloadResponse(path, content?, error?)`, `WriteResult(error?, path?, files_update?)`, `EditResult(error?, path?, files_update?, occurrences?)`, `ExecuteResponse(output, exit_code?, truncated?)`.

## Architectural Decisions

1. **Python3 required**: The sandbox container spec mandates `python3` availability. No shell fallbacks for inherited BaseSandbox tools — they work via `execute()` delegation to python3 heredoc commands.

2. **Timeout pass-through**: `McpSandboxBackend.execute(command, timeout=N)` forwards the timeout parameter to the MCP JSON-RPC call. The exec_server already enforces a 120s max, so this respects existing limits while allowing shorter timeouts for specific operations.

3. **Conformance test suite**: Spec 004 includes a portable conformance test script in `ruska-ai/sandboxes` that any sandbox implementation can run to self-certify it meets the BaseSandbox contract (execute, upload_file, download_file, _meta, sandbox_id, python3 availability).

4. **Persistent session with reconnect**: `McpSandboxBackend` creates one MCP session on first `execute()` call and reuses it across all subsequent calls. If a call fails with a session error (e.g., exec_server restarted), it re-initializes the session and retries once before propagating the error.

5. **Working directory convention (OpenClaw model)**: `/workspace` is the default working directory, structured after the [OpenClaw Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace) filesystem model. The sandbox initializes with the following layout:

```
/workspace/
├── AGENTS.md          # Operating instructions for the agent (loaded each session)
├── SOUL.md            # Agent persona, tone, behavioral boundaries (loaded each session)
├── USER.md            # User identity and communication preferences (loaded each session)
├── IDENTITY.md        # Agent name, identity metadata
├── TOOLS.md           # Notes about available tools and conventions
├── MEMORY.md          # Curated long-term memory (agent-writable)
├── memory/            # Daily memory logs (YYYY-MM-DD.md)
├── skills/            # Workspace-specific skills
└── canvas/            # Optional UI/output files
```

Relative paths in all tools resolve relative to `/workspace`. Agents can still access `/tmp` and other system paths, but the OpenClaw-modeled workspace ensures consistent agent context across sandbox implementations. The Dockerfile/entrypoint creates this layout on container startup with empty template files.

6. **Clean rename**: `exec_command` is renamed directly to `execute`. No backward compatibility alias — no other consumers exist yet. Orchestra Spec 001 targets the new name from the start.

7. **JSON lines output format**: `grep`, `glob`, and `ls` MCP tools return newline-delimited JSON objects as text, matching the exact format that BaseSandbox's inherited python3 heredoc commands produce. This means McpSandboxBackend v2 uses identical parsing logic whether using native MCP tools or inherited shell fallbacks.

8. **Full session lifecycle in conformance tests**: The conformance test suite validates init, session reuse across calls, concurrent requests, session cleanup (DELETE `/mcp`), and reconnect after server restart.

9. **Agent tool sync for FileEditorPanel**: When the agent writes/edits/reads files on the sandbox, those files automatically appear in FileEditorPanel via the existing SSE stream (`files` in values event). No independent sandbox browsing — reviewer sees files the agent created/modified. This requires no new API endpoints; the existing streaming mechanism already syncs `agent.files` to the panel.

10. **Live connection status**: MCP sandbox option shows a green/red dot indicating exec_server reachability. Health check runs on page load and when the sandbox selector dropdown is opened. No background polling.

11. **User-approved fallback toast**: When MCP sandbox is unreachable and user sends a message, a toast appears: "MCP sandbox unreachable" with a "Use State for this message" action button. One click retries with State backend for that message only. MCP stays selected for future messages. This replaces the silent auto-fallback in `controllers/llm.py` and `utils/stream.py`.

## Spec Breakdown

### Spec 001: McpSandboxBackend Core Class (Foundation)
**File**: `.claude/specs/feat-890-mcp-sandbox/001-mcp-sandbox-backend.md`

Creates `backend/src/agents/mcp_sandbox.py` with:
- `McpSandboxBackend(BaseSandbox)` implementing all 4 abstract methods: `execute()`, `id`, `upload_files()`, `download_files()`
- All 6 inherited methods (`read`, `write`, `edit`, `grep_raw`, `ls_info`, `glob_info`) work automatically via `execute()` delegation
- MCP JSON-RPC 2.0 client via `httpx` (already in deps) — POST to `/mcp` endpoint
- `execute(command, *, timeout=None)` forwards timeout to MCP call; exec_server enforces 120s max
- Text-embedded `exit_code: N` regex parser (works with current exec_server)
- Shell-based file transfer: `upload_files()` uses base64 encode + `echo | base64 -d > path`, `download_files()` uses `base64 path` and decodes result — returns proper `FileUploadResponse`/`FileDownloadResponse` with per-file error handling
- **Persistent session with reconnect**: lazy session init on first `execute()`, reused across calls. On session error, re-initializes and retries once before raising
- Health check via GET `/health`
- Unit tests in `backend/tests/unit/agents/test_mcp_sandbox.py`

**Files**: `backend/src/agents/mcp_sandbox.py` (NEW), `backend/tests/unit/agents/test_mcp_sandbox.py` (NEW)

---

### Spec 002: Sandbox Dispatch Wiring (Depends on 001)
**File**: `.claude/specs/feat-890-mcp-sandbox/002-sandbox-dispatch.md`

Wires MCP into the existing sandbox system. **No hardcoded `MCP_SANDBOX_URL` env var** — the sandbox URL is user-configurable via the settings page and stored in `UserSettings`.

- Add `MCP = "mcp"` to `SandboxType` enum (`backend/src/schemas/entities/settings.py`)
- Add `default_mcp_sandbox_url: Optional[str]` field to `UserSettings` entity — user-configured sandbox endpoint
- Add `mcp_sandbox_url` to `PatchDefaultsRequest` and `DefaultsResponse` schemas
- Add `_create_mcp_backend_checked()` factory (`backend/src/agents/__init__.py`) — reads sandbox URL from user settings (not env var)
- Register `"mcp"` in `_SANDBOX_FACTORIES`
- Update `resolve_sandbox_backend()` to accept the user's sandbox URL and pass it to the factory
- Update fallback chain: Daytona -> MCP (if URL configured) -> State
- MCP sandbox option only available when `default_mcp_sandbox_url` is set in user settings
- Add MCP error handling to `backend/src/controllers/llm.py` and `backend/src/utils/stream.py`

**Files**: `settings.py`, `agents/__init__.py`, `controllers/llm.py`, `utils/stream.py`, `repos/user_settings_repo.py`

---

### Spec 003: Frontend MCP Sandbox Option + Health Indicator + Fallback UX (Independent — parallel with 001/002)
**File**: `.claude/specs/feat-890-mcp-sandbox/003-frontend-mcp-option.md`

Adds MCP to the frontend sandbox selector with live health indicator and user-approved fallback:

**Type & config changes**:
- Extend `SandboxType` union with `"mcp"` (`frontend/src/lib/services/userSettingsService.ts`)
- Add MCP entry to `SANDBOX_OPTIONS` array (`frontend/src/lib/config/sandbox.ts`)
- Update `normalizeSandboxValue()` to recognize `"mcp"`

**MCP Sandbox visibility gating**:
- MCP Sandbox option ONLY appears in the selector when the user has configured `mcp_sandbox_url` in their settings
- Similar to how Daytona only shows when `DAYTONA_API_KEY` is set
- New "MCP Sandbox URL" input field in settings page (below sandbox selector) — user enters their sandbox endpoint (e.g., `http://localhost:3005/mcp`)
- URL is persisted via `patchDefaults({ mcp_sandbox_url: "..." })` to backend

**Health indicator** (green/red dot):
- New `useSandboxHealth()` hook that pings the user's configured sandbox URL `/health` endpoint
- Runs on page load + when sandbox selector dropdown is opened
- Shows green dot (reachable) or red dot (unreachable) next to "MCP Sandbox" in both `SandboxSettings.tsx` and `ThreadSandboxStatus.tsx`
- Health endpoint URL derived from user's `mcp_sandbox_url` setting (strip `/mcp`, append `/health`)

**User-approved fallback toast**:
- When MCP sandbox is selected and agent execution fails due to unreachable exec_server:
  - Backend returns a specific error type (e.g., `mcp_sandbox_unreachable`)
  - Frontend shows toast: "MCP sandbox unreachable" with "Use State for this message" action button
  - Clicking the button retries the same message with `sandbox_type=state` override
  - MCP stays selected as the default for future messages
- Requires: new error response type from backend, frontend toast handler in chat/stream flow

**Files**: `userSettingsService.ts`, `sandbox.ts`, `SandboxSettings.tsx`, `ThreadSandboxStatus.tsx`, new `useSandboxHealth.ts` hook, chat stream error handler

---

### Spec 004: exec_server BaseSandbox-Conformant MCP Tools + Conformance Tests (Independent — parallel with 001/002/003)
**File**: `.claude/specs/feat-890-mcp-sandbox/004-exec-server-structured.md`

Enhances `sandboxes/ubuntu/index.js` to expose MCP tools that mirror the full `BaseSandbox` protocol 1:1. Any sandbox that conforms to this spec is a drop-in DeepAgents sandbox backend.

**MCP Tools (maps to BaseSandbox protocol)**:

| MCP Tool | BaseSandbox Method | Params | Returns |
|----------|-------------------|--------|---------|
| `execute` (renamed from exec_command) | `execute()` | `{cmd, timeout?}` | text output + `_meta.exit_code` (int) |
| `read` (NEW) | `read()` | `{path, offset?, limit?}` | cat -n formatted content + `_meta.exit_code` |
| `write` (NEW) | `write()` | `{path, content}` | success/error + `_meta.exit_code` |
| `edit` (NEW) | `edit()` | `{path, old_string, new_string, replace_all?}` | occurrence count + `_meta.exit_code` (0=ok, 1=not found, 2=multiple, 3=file missing) |
| `grep` (NEW) | `grep_raw()` | `{pattern, path?, glob?}` | JSON lines `{path, line, text}` + `_meta.exit_code` |
| `glob` (NEW) | `glob_info()` | `{pattern, path?}` | JSON lines `{path, is_dir, size?, mtime?}` + `_meta.exit_code` |
| `ls` (NEW) | `ls_info()` | `{path}` | JSON lines `{path, is_dir}` + `_meta.exit_code` |
| `upload_file` (NEW) | `upload_files()` | `{path, content_base64}` | success/error + `_meta.exit_code` |
| `download_file` (NEW) | `download_files()` | `{path}` | base64 content + `_meta.exit_code` |

**Additional changes**:
- **Rename** `exec_command` → `execute` (clean break, no alias)
- Structured `_meta.exit_code` in ALL tool responses (integer, not text-embedded)
- `_meta.sandbox_id` in ALL tool responses
- Sandbox ID via `crypto.randomUUID()` in `/health` and `_meta`
- `execute` keeps text-embedded `exit_code: N` for backward compat during Phase 1
- **python3 required**: Dockerfile must ensure python3 is available
- **Working directory (OpenClaw model)**: `/workspace` is the default cwd, initialized with the OpenClaw workspace layout (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, memory/, skills/, canvas/). Dockerfile/entrypoint creates this structure on container startup.
- **Exit code semantics**: `edit` uses codes 0-4 matching BaseSandbox's `_EDIT_COMMAND_TEMPLATE`; `write` returns exit_code=1 if file exists
- **JSON lines format**: `grep`, `glob`, `ls` return newline-delimited JSON objects (matching BaseSandbox's python3 heredoc output format)

**Conformance test suite** (`sandboxes/tests/conformance.sh`):
- Validates ALL 9 MCP tools registered and functional
- Tests exit_code semantics for each tool (success + error cases)
- Tests `sandbox_id` in `/health` and `_meta`
- Tests `python3` availability
- Tests timeout behavior (120s max enforced)
- Tests `/workspace` as default working directory with OpenClaw layout (AGENTS.md, SOUL.md, USER.md, IDENTITY.md, TOOLS.md, MEMORY.md, memory/, skills/, canvas/)
- **Session lifecycle tests**: init, session reuse across multiple calls, concurrent requests (parallel curl), session cleanup (DELETE `/mcp`), reconnect after session expiry
- Any new sandbox image runs this to self-certify BaseSandbox compatibility

**Files**: `sandboxes/ubuntu/index.js`, `sandboxes/ubuntu/Dockerfile` (ensure python3), `sandboxes/tests/conformance.sh` (NEW)

---

### Spec 005: McpSandboxBackend v2 — Native MCP Tools for Full BaseSandbox (Depends on 002 + 004)
**File**: `.claude/specs/feat-890-mcp-sandbox/005-mcp-sandbox-v2.md`

Upgrades McpSandboxBackend to use native MCP tools for ALL BaseSandbox operations, overriding the inherited shell-delegation implementations when the exec_server supports them:

**Native MCP tool overrides** (replaces inherited shell-based implementations):

| BaseSandbox Method | Spec 001 (shell fallback) | Spec 005 (native MCP) |
|---|---|---|
| `execute()` | `execute` + text-parse exit_code | `execute` + `_meta.exit_code` |
| `read()` | Inherited python3 heredoc via `execute()` | Native `read` MCP tool |
| `write()` | Inherited python3 heredoc via `execute()` | Native `write` MCP tool |
| `edit()` | Inherited python3 heredoc via `execute()` | Native `edit` MCP tool |
| `grep_raw()` | Inherited `grep -rHnF` via `execute()` | Native `grep` MCP tool |
| `glob_info()` | Inherited python3 heredoc via `execute()` | Native `glob` MCP tool |
| `ls_info()` | Inherited python3 scandir via `execute()` | Native `ls` MCP tool |
| `upload_files()` | Shell base64 via `execute()` | Native `upload_file` MCP tool |
| `download_files()` | Shell base64 via `execute()` | Native `download_file` MCP tool |

**Key behaviors**:
- **Tool discovery on session init**: Calls `tools/list` and caches available tool names. Uses native MCP tools when available, falls back to inherited shell implementations when not.
- **Dual-mode exit_code**: Prefers `_meta.exit_code` (structured int), falls back to text-parsing regex for older exec_servers.
- **`_meta.sandbox_id`** for `id` property when available.
- **Return type parity**: Native tools return the same `ExecuteResponse`, `WriteResult`, `EditResult`, `GrepMatch`, `FileInfo`, `FileUploadResponse`, `FileDownloadResponse` types — parsing MCP responses into the exact same structures.
- **Graceful degradation**: If exec_server only has `execute` (no native tools), all inherited methods still work via `execute()` delegation.

**Files**: `backend/src/agents/mcp_sandbox.py`, `backend/tests/unit/agents/test_mcp_sandbox.py`

## Dependency Graph & Parallelization

```
Spec 001 ──> Spec 002 ──────────────> Spec 005
                                        ^
Spec 003 (independent, parallel)        |
                                        |
Spec 004 (independent, parallel) ───────┘
```

**Optimal execution**: Specs 001, 003, 004 can start simultaneously. Spec 002 waits for 001. Spec 005 waits for 002 + 004.

## Critical Files to Modify

| File | Spec | Action |
|------|------|--------|
| `backend/src/agents/mcp_sandbox.py` | 001, 005 | CREATE |
| `backend/src/agents/__init__.py` | 002 | MODIFY (factory + dispatch) |
| `backend/src/schemas/entities/settings.py` | 002 | MODIFY (SandboxType enum + `default_mcp_sandbox_url` field) |
| `backend/src/controllers/llm.py` | 002 | MODIFY (error handling) |
| `backend/src/utils/stream.py` | 002 | MODIFY (error handling) |
| `frontend/src/lib/services/userSettingsService.ts` | 003 | MODIFY (SandboxType) |
| `frontend/src/lib/config/sandbox.ts` | 003 | MODIFY (options + normalizer) |
| `sandboxes/ubuntu/index.js` | 004 | MODIFY (structured responses) |
| `sandboxes/ubuntu/Dockerfile` | 004 | MODIFY (ensure python3) |
| `sandboxes/tests/conformance.sh` | 004 | CREATE (conformance test suite) |
| `backend/tests/unit/agents/test_mcp_sandbox.py` | 001, 005 | CREATE |

## Reusable Patterns

- **Factory pattern**: Follow `_create_daytona_backend_checked()` in `backend/src/agents/__init__.py:277-301`
- **Validation**: Follow `validate_daytona_execute_capability()` in `backend/src/agents/daytona.py:6-18`
- **Error handling**: Follow Daytona fallback pattern in `backend/src/controllers/llm.py:162-196`
- **HTTP client**: Use `httpx.AsyncClient()` pattern from `backend/src/common/client/client.py`
- **Frontend config**: Follow existing `SANDBOX_OPTIONS` pattern in `frontend/src/lib/config/sandbox.ts`

## QA Plan: Step-by-Step User Story Validation (Front-to-Back)

Each spec includes a QA story that validates the full user workflow. Use the **agent-browser** skill (viewport 1920x1080) for all UI-facing validations (screenshots, clicks, form interactions). Backend validations use curl + test commands.

**Default ports**: frontend=5173, backend=8000, sandbox=3005

---

### QA-001: McpSandboxBackend Core Class (after Spec 001)

**Precondition**: exec_server running at `http://localhost:3005` via `COMPOSE_PROFILES=tools make dev.docker.up`

**Backend unit tests**:
```bash
cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v
```

**Manual integration validation**:
```bash
# 1. Verify exec_server health
curl http://localhost:3005/health
# Expected: {"status":"ok","sessions":0}

# 2. Test MCP JSON-RPC initialize (get session)
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  -D -
# Expected: 200 OK with Mcp-Session-Id header in response

# 3. Test execute via tools/call
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session_id_from_step_2>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"execute","arguments":{"cmd":"echo hello && echo exit_code: 0"}}}'
# Expected: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"...exit_code: 0"}]}}

# 4. Test exit_code parsing for failure case
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session_id_from_step_2>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute","arguments":{"cmd":"ls /nonexistent"}}}'
# Expected: text contains "exit_code: 2" (or non-zero)

# 5. Test upload via shell fallback (base64 round-trip)
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session_id_from_step_2>" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute","arguments":{"cmd":"echo aGVsbG8gd29ybGQ= | base64 -d > /tmp/test.txt && cat /tmp/test.txt"}}}'
# Expected: text contains "hello world"
```

**Pass criteria**: All unit tests green. Manual curl commands return expected responses.

---

### QA-002: Sandbox Dispatch Wiring (after Spec 002)

**Precondition**: Backend running, user `admin@example.com` has configured `mcp_sandbox_url` in settings

**Backend unit tests**:
```bash
cd backend && uv run pytest tests/unit/agents/ -v
```

**Dispatch logic validation**:
```bash
# 1. Verify SandboxType enum includes MCP
cd backend && uv run python -c "from src.schemas.entities.settings import SandboxType; print(SandboxType.MCP)"
# Expected: SandboxType.MCP

# 2. Verify NO hardcoded MCP_SANDBOX_URL constant (user-configured only)
cd backend && uv run python -c "from src.constants import __dict__ as c; print('MCP_SANDBOX_URL' not in c)"
# Expected: True (no constant — URL comes from user settings)

# 3. Verify factory registration
cd backend && uv run python -c "from src.agents import _SANDBOX_FACTORIES; print(list(_SANDBOX_FACTORIES.keys()))"
# Expected: ['daytona', 'state', 'mcp']

# 4. Test resolve_sandbox_backend with sandbox_type="mcp" (exec_server running)
cd backend && uv run python -c "
from src.agents import resolve_sandbox_backend
from deepagents.core.types import ToolRuntime
runtime = ToolRuntime(tools=[], mcp={}, exec_server_url='')
backend, sandbox, effective = resolve_sandbox_backend(runtime, sandbox_type='mcp')
print(f'effective_type={effective}, backend={type(backend).__name__}')
"
# Expected: effective_type=mcp (if exec_server running) or effective_type=state (if not)

# 5. Test auto fallback chain (exec_server stopped)
# Stop exec_server, then:
cd backend && uv run python -c "
from src.agents import resolve_sandbox_backend
from deepagents.core.types import ToolRuntime
runtime = ToolRuntime(tools=[], mcp={}, exec_server_url='')
backend, sandbox, effective = resolve_sandbox_backend(runtime, sandbox_type=None)
print(f'effective_type={effective}')
"
# Expected: effective_type=state (graceful fallback)
```

**API endpoint validation**:
```bash
# 6. Login to get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test1234"}' | jq -r '.access_token')

# 7. Set sandbox to MCP via settings API
curl -s -X PATCH http://localhost:8000/api/settings/default \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sandbox":"mcp"}'
# Expected: {"defaults":{"sandbox":"mcp",...}}

# 8. Invoke LLM with MCP sandbox active (exec_server running)
curl -s -X POST http://localhost:8000/api/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input":{"input":"Run: echo hello from MCP sandbox"},"model":"gpt-4o-mini","instructions":"Execute the requested command"}'
# Expected: Response includes output from exec_server execution

# 9. Test fallback: stop exec_server, invoke again
# Expected: Falls back to state backend, no crash
```

**Pass criteria**: All unit tests green. Factory registered. Dispatch resolves correctly for all sandbox_type values. API endpoints work with MCP sandbox.

---

### QA-003: Frontend MCP Sandbox Option (after Spec 003)

**Precondition**: Frontend dev server running on :5173 (`cd frontend && npm run dev`), backend running on :8000

**Frontend unit tests**:
```bash
cd frontend && npm run test
```

**agent-browser UI validation** (step-by-step user story):

```
Story: User selects MCP sandbox from the settings page

1. NAVIGATE to http://localhost:5173/settings
   - SCREENSHOT: Verify settings page loads

2. SCROLL to "Default Sandbox" card
   - SCREENSHOT: Verify SandboxSettings card is visible

3. CLICK the sandbox selector dropdown
   - SCREENSHOT: Verify dropdown shows options including "MCP Sandbox"
   - VERIFY: "State (Default)" option is present
   - VERIFY: "MCP Sandbox" option is present with description "Run agent code in an isolated MCP sandbox container."

4. SELECT "MCP Sandbox" option
   - SCREENSHOT: Verify selection persists (toast shows "Default sandbox updated")
   - VERIFY: Dropdown now shows "MCP Sandbox" as selected

5. REFRESH the page (navigate away and back to /settings)
   - SCREENSHOT: Verify "MCP Sandbox" is still selected after page reload (persisted to backend)
```

```
Story: User selects MCP sandbox from the chat thread status bar

1. NAVIGATE to http://localhost:5173 (chat page)
   - SCREENSHOT: Verify chat interface loads

2. LOCATE the sandbox selector button in ChatUtilityRow (bottom of chat input area)
   - SCREENSHOT: Verify button shows current sandbox (e.g., "Sandbox State")

3. CLICK the sandbox status button to open popover
   - SCREENSHOT: Verify popover opens with sandbox options
   - VERIFY: "MCP Sandbox" option is listed
   - VERIFY: Option has label "MCP Sandbox" and short label "MCP"

4. CLICK "MCP Sandbox" option
   - SCREENSHOT: Verify selection updates (toast shows "Sandbox updated")
   - VERIFY: Button now shows "Sandbox MCP"

5. CLICK the sandbox status button again to verify checkmark
   - SCREENSHOT: Verify checkmark appears next to "MCP Sandbox"
```

```
Story: Exercise ALL BaseSandbox tools on remote sandbox (:3005) — full parity test

Precondition: MCP sandbox selected (from previous story), exec_server running at localhost:3005

--- Tool 1: execute() — shell command execution ---
1. TYPE: "Run this shell command on the sandbox: echo 'MCP execute test' && pwd && whoami"
2. CLICK send
   - SCREENSHOT: Verify agent response
   - VERIFY: Output shows "MCP execute test", a working directory path, and a username from the remote sandbox (not local)
   - VERIFY: exit_code is 0

--- Tool 2: write() — create new file ---
3. TYPE: "Create a new file /tmp/mcp-qa/parity-test.py on the sandbox with this content:\nimport json\nprint(json.dumps({'status': 'ok', 'source': 'mcp-sandbox'}))"
4. CLICK send
   - SCREENSHOT: Verify file created successfully on sandbox
   - VERIFY: No "file already exists" error

--- Tool 3: read() — read file with line numbers ---
5. TYPE: "Read the file /tmp/mcp-qa/parity-test.py from the sandbox and show me the contents with line numbers"
6. CLICK send
   - SCREENSHOT: Verify file contents returned with line numbers (cat -n format)
   - VERIFY: Shows line 1: import json, line 2: print(...)

--- Tool 4: edit() — string replacement ---
7. TYPE: "Edit /tmp/mcp-qa/parity-test.py on the sandbox: replace 'ok' with 'modified', then read it back to confirm"
8. CLICK send
   - SCREENSHOT: Verify edit succeeded and re-read shows 'modified' instead of 'ok'
   - VERIFY: EditResult shows 1 occurrence replaced

--- Tool 5: execute() — run the edited script ---
9. TYPE: "Execute 'python3 /tmp/mcp-qa/parity-test.py' on the sandbox"
10. CLICK send
    - SCREENSHOT: Verify output is JSON with {"status": "modified", "source": "mcp-sandbox"}
    - VERIFY: exit_code is 0

--- Tool 6: ls_info() — directory listing ---
11. TYPE: "List all files in /tmp/mcp-qa/ on the sandbox with file metadata"
12. CLICK send
    - SCREENSHOT: Verify structured listing showing parity-test.py
    - VERIFY: Shows file paths and is_dir flags

--- Tool 7: glob_info() — pattern matching ---
13. TYPE: "Find all .py files under /tmp/mcp-qa/ on the sandbox using glob pattern **/*.py"
14. CLICK send
    - SCREENSHOT: Verify glob returns parity-test.py
    - VERIFY: Structured FileInfo results

--- Tool 8: grep_raw() — content search ---
15. TYPE: "Search for the string 'mcp-sandbox' in all files under /tmp/mcp-qa/ on the sandbox"
16. CLICK send
    - SCREENSHOT: Verify grep returns match in parity-test.py with line number
    - VERIFY: GrepMatch with path, line number, and matched text

--- Tool 9: execute() with non-zero exit code ---
17. TYPE: "Run 'ls /nonexistent-path-12345' on the sandbox — I expect this to fail"
18. CLICK send
    - SCREENSHOT: Verify agent reports non-zero exit code
    - VERIFY: exit_code is non-zero (2), error output present

--- Tool 10: Cleanup ---
19. TYPE: "Remove /tmp/mcp-qa and everything in it on the sandbox, then verify it's gone"
20. CLICK send
    - SCREENSHOT: Verify cleanup succeeded
    - VERIFY: rm -rf executed, ls confirms directory no longer exists
```

**Pass criteria**: All frontend tests green. All agent-browser stories pass with screenshots. MCP option visible, selectable, persistable in both settings page and thread status bar. E2E chat with MCP sandbox produces exec_server output.

---

### QA-004: exec_server BaseSandbox-Conformant MCP Tools (after Spec 004)

**Precondition**: Updated exec_server running at `http://localhost:3005`

**Manual validation** (all 9 tools):
```bash
# 1. Health check with sandbox_id
curl -s http://localhost:3005/health | jq .
# Expected: {"status":"ok","sessions":0,"sandbox_id":"<uuid>"}

# 2. Initialize session
SESSION=$(curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  -D /dev/stderr 2>&1 | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

# 3. List tools — verify all 9 BaseSandbox-conformant tools registered
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq '.result.tools[].name'
# Expected: "execute", "read", "write", "edit", "grep", "glob", "ls", "upload_file", "download_file"

# --- Tool: execute (execute) ---
# 4. execute success with structured _meta
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute","arguments":{"cmd":"echo hello"}}}' | jq '.result._meta'
# Expected: {"exit_code":0,"sandbox_id":"<uuid>"}

# 5. execute failure
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"execute","arguments":{"cmd":"ls /nonexistent"}}}' | jq '.result._meta.exit_code'
# Expected: 2 (non-zero)

# --- Tool: write (write) ---
# 6. write — create new file
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"write","arguments":{"path":"/tmp/qa-test.txt","content":"Hello from QA test!"}}}' | jq '.result._meta'
# Expected: {"exit_code":0,...}

# 7. write — error if file exists
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"write","arguments":{"path":"/tmp/qa-test.txt","content":"duplicate"}}}' | jq '.result._meta.exit_code'
# Expected: 1 (file exists error)

# --- Tool: read (read) ---
# 8. read with line numbers
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"read","arguments":{"path":"/tmp/qa-test.txt","offset":0,"limit":10}}}' | jq '.result.content[0].text'
# Expected: "     1\tHello from QA test!" (cat -n format)

# --- Tool: edit (edit) ---
# 9. edit — replace string
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"edit","arguments":{"path":"/tmp/qa-test.txt","old_string":"QA test","new_string":"QA PASSED"}}}' | jq '.result'
# Expected: content text = "1" (1 occurrence), _meta.exit_code = 0

# 10. edit — string not found
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"edit","arguments":{"path":"/tmp/qa-test.txt","old_string":"nonexistent","new_string":"x"}}}' | jq '.result._meta.exit_code'
# Expected: 1 (string not found)

# --- Tool: ls (ls_info) ---
# 11. ls directory
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"ls","arguments":{"path":"/tmp"}}}' | jq '.result.content[0].text' | head -5
# Expected: JSON lines with {path, is_dir} including qa-test.txt

# --- Tool: grep ---
# 12. grep for pattern
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"grep","arguments":{"pattern":"PASSED","path":"/tmp"}}}' | jq '.result.content[0].text'
# Expected: JSON lines with {path: "/tmp/qa-test.txt", line: 1, text: "Hello from QA PASSED!"}

# --- Tool: glob ---
# 13. glob for *.txt
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"glob","arguments":{"pattern":"*.txt","path":"/tmp"}}}' | jq '.result.content[0].text'
# Expected: JSON lines with {path, is_dir, size, mtime} including qa-test.txt

# --- Tool: upload_file ---
# 14. Upload binary file
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":13,"method":"tools/call","params":{"name":"upload_file","arguments":{"path":"/tmp/qa-binary.bin","content_base64":"AQIDBA=="}}}' | jq '.result._meta'
# Expected: {"exit_code":0,...}, "Written 4 bytes to /tmp/qa-binary.bin"

# --- Tool: download_file ---
# 15. Download and verify round-trip
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":14,"method":"tools/call","params":{"name":"download_file","arguments":{"path":"/tmp/qa-binary.bin"}}}' | jq -r '.result.content[0].text' | base64 -d | xxd
# Expected: 01 02 03 04 (binary round-trip preserved)

# 16. Download nonexistent file
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION" \
  -d '{"jsonrpc":"2.0","id":15,"method":"tools/call","params":{"name":"download_file","arguments":{"path":"/tmp/nonexistent.txt"}}}' | jq '.result._meta.exit_code'
# Expected: non-zero (file_not_found error)
```

**Conformance test suite**:
```bash
# 17. Run conformance tests against the updated exec_server
cd sandboxes && bash tests/conformance.sh http://localhost:3005
# Expected: All 9 tools PASS — execute, read, write, edit, grep, glob, ls, upload_file, download_file
# Expected: _meta.exit_code semantics correct for all tools
# Expected: sandbox_id present, python3 available
```

**Pass criteria**: Health returns sandbox_id. tools/list returns all 9 tools. _meta.exit_code is integer in all tool responses with correct semantics (edit codes 0-4, write code 1 for exists). File round-trips (text + binary) succeed. Error cases handled gracefully. Conformance test suite passes.

---

### QA-005: McpSandboxBackend v2 — Native Features (after Spec 005)

**Precondition**: Updated exec_server (Spec 004) + McpSandboxBackend v2 (Spec 005) both deployed

**Backend unit tests**:
```bash
cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v
```

**Integration validation**:
```bash
# 1. Verify structured _meta parsing takes precedence
# (Run with updated exec_server — _meta.exit_code should be used)
cd backend && uv run python -c "
import asyncio
from src.agents.mcp_sandbox import McpSandboxBackend
async def test():
    sb = McpSandboxBackend(url='http://localhost:3005/mcp')
    result = await sb.execute('echo structured test')
    print(f'exit_code={result.exit_code}, output={result.output[:50]}')
    print(f'sandbox_id={sb.id}')
asyncio.run(test())
"
# Expected: exit_code=0, sandbox_id=<uuid from _meta>

# 2. Verify native upload_file tool
cd backend && uv run python -c "
import asyncio
from src.agents.mcp_sandbox import McpSandboxBackend
async def test():
    sb = McpSandboxBackend(url='http://localhost:3005/mcp')
    await sb.upload_files([('/tmp/v2-test.txt', b'native upload works')])
    result = await sb.execute('cat /tmp/v2-test.txt')
    print(f'content={result.output}')
asyncio.run(test())
"
# Expected: content includes "native upload works"

# 3. Verify native download_file tool
cd backend && uv run python -c "
import asyncio
from src.agents.mcp_sandbox import McpSandboxBackend
async def test():
    sb = McpSandboxBackend(url='http://localhost:3005/mcp')
    files = await sb.download_files(['/tmp/v2-test.txt'])
    print(f'downloaded={files[0][1].decode()}')
asyncio.run(test())
"
# Expected: downloaded=native upload works

# 4. Verify fallback to shell-based transfer (old exec_server without upload_file tool)
# Stop updated exec_server, start OLD exec_server (pre-Spec 004)
# Re-run steps 2-3 — should still work via base64 shell fallback
```

**agent-browser E2E validation** (exercises native upload_file/download_file + all inherited tools on sandbox :3005):

```
Story: MCP v2 full tool parity E2E — native file transfer + all BaseSandbox tools

1. NAVIGATE to http://localhost:5173 (chat page)
   - ENSURE MCP sandbox is selected in thread status bar

--- Native upload_files() via upload_file MCP tool ---
2. TYPE: "Upload a binary-safe file to /tmp/v2-qa/config.json on the sandbox with content: {\"version\": 2, \"native\": true, \"emoji\": \"🚀\"}"
3. CLICK send
   - SCREENSHOT: Verify agent used sandbox upload (FileUploadResponse with no error)
   - VERIFY: Response confirms file written to remote sandbox at :3005

--- Native download_files() via download_file MCP tool ---
4. TYPE: "Download /tmp/v2-qa/config.json from the sandbox and show me the raw contents"
5. CLICK send
   - SCREENSHOT: Verify agent used sandbox download (FileDownloadResponse)
   - VERIFY: Contents match including emoji character (binary-safe round-trip)

--- Inherited read() with offset/limit ---
6. TYPE: "Read /tmp/v2-qa/config.json from the sandbox starting at line 1, limit 10 lines, with line numbers"
7. CLICK send
   - VERIFY: Output shows cat -n formatted content from remote sandbox

--- Inherited write() + edit() ---
8. TYPE: "Create /tmp/v2-qa/editable.txt on the sandbox with 'Hello World from MCP v2', then edit it replacing 'World' with 'Sandbox'"
9. CLICK send
   - VERIFY: WriteResult path set, then EditResult shows 1 occurrence replaced
   - VERIFY: Re-read shows "Hello Sandbox from MCP v2"

--- Inherited grep_raw() ---
10. TYPE: "Search for 'native' in all files under /tmp/v2-qa/ on the sandbox"
11. CLICK send
    - VERIFY: GrepMatch returns config.json with line number and matched text

--- Inherited glob_info() ---
12. TYPE: "Find all .json files under /tmp/v2-qa/ on the sandbox"
13. CLICK send
    - VERIFY: FileInfo list includes config.json

--- Inherited ls_info() ---
14. TYPE: "List /tmp/v2-qa/ on the sandbox with file info"
15. CLICK send
    - VERIFY: Shows config.json and editable.txt with is_dir=false

--- Batch upload_files() (multiple files) ---
16. TYPE: "Upload these 3 files to the sandbox: /tmp/v2-qa/batch/a.txt with 'file A', /tmp/v2-qa/batch/b.txt with 'file B', /tmp/v2-qa/batch/c.txt with 'file C'"
17. CLICK send
    - VERIFY: 3 FileUploadResponse entries, all with no error

--- Batch download_files() (multiple files) ---
18. TYPE: "Download all 3 files from /tmp/v2-qa/batch/ and show their contents"
19. CLICK send
    - VERIFY: 3 FileDownloadResponse entries with correct contents

--- Error handling: download nonexistent file ---
20. TYPE: "Try to download /tmp/v2-qa/nonexistent.txt from the sandbox"
21. CLICK send
    - VERIFY: FileDownloadResponse with error="file_not_found"

--- Cleanup ---
22. TYPE: "Remove /tmp/v2-qa and everything in it on the sandbox"
23. CLICK send
    - VERIFY: Cleanup succeeded, directory gone
```

**Pass criteria**: All unit tests green. Structured _meta exit_code used when available. Native file transfer tools used when available. Shell fallback works when tools unavailable. E2E chat flow succeeds with file operations.

---

### QA-FINAL: Full Regression & Fallback Chain

**Purpose**: Verify nothing is broken and fallback chain works correctly across all combinations.

| Scenario | exec_server | Daytona | Expected effective_type | Test |
|----------|-------------|---------|------------------------|------|
| Auto, nothing available | OFF | OFF | `state` | Send chat message, verify state backend response |
| Auto, MCP available | ON | OFF | `mcp` | Send chat message, verify exec_server logs show activity |
| Auto, both available | ON | ON | `daytona` | Daytona takes priority |
| Explicit MCP, available | ON | - | `mcp` | Send chat message with MCP selected |
| Explicit MCP, unavailable | OFF | - | `state` | Falls back gracefully, no crash |
| Explicit State | - | - | `state` | Always state, never tries MCP/Daytona |

**agent-browser regression** (verify existing sandbox + MCP filesystem isolation):
```
Story: Verify existing sandbox options still work after MCP addition

1. NAVIGATE to http://localhost:5173/settings
2. CLICK sandbox selector
   - SCREENSHOT: Verify all options visible
   - VERIFY: "State (Default)" still present and selectable
   - VERIFY: "Daytona" visible only when DAYTONA_API_KEY is set (same as before)
   - VERIFY: "MCP Sandbox" always visible

3. SELECT "State (Default)"
   - VERIFY: Selection persists, toast shows success

4. NAVIGATE to chat page
5. SEND: "List the files in /tmp on your filesystem"
   - VERIFY: Agent responds using state backend (local filesystem, not remote sandbox)
   - VERIFY: No connection to exec_server :3005

6. Switch sandbox to MCP (via thread status bar)
7. SEND: "List the files in /tmp on the sandbox filesystem"
   - VERIFY: Agent responds using remote sandbox :3005 (different filesystem)
   - SCREENSHOT: Compare — MCP response should show sandbox /tmp (different from step 5)

8. Switch sandbox back to State
9. SEND: "Create /tmp/regression-test.txt with content 'state backend' and read it back"
   - VERIFY: Agent operates on local filesystem, not remote sandbox
   - VERIFY: No errors, state backend fully functional
```

**Full test suite**:
```bash
# Backend
cd backend && make test

# Frontend
cd frontend && npm run test
```

**Pass criteria**: All 6 fallback scenarios work as expected. Existing sandbox options unaffected. Full test suites green on both backend and frontend.

## PR Submission & Human Review Process

### Final PR (All Specs Combined)

Per the feature request template at `.github/ISSUE_TEMPLATE/feature_request.md`, the final PR consolidates all specs into one submission.

**Metadata**:
```yml
pull_request_title: "FROM feat/890-mcp-sandbox TO development"
branch: "feat/890-mcp-sandbox"
worktree_path: "$WORKSPACE/.worktrees/feat-890"
```

**PR Body** (follows feature_request.md template):

```markdown
## Summary

MCP Sandbox Backend for DeepAgents — connects Orchestra to `ruska-ai/sandboxes` exec_server
via MCP JSON-RPC 2.0 over Streamable HTTP as a first-class BaseSandbox implementation.

Closes #890. Depends on ruska-ai/sandboxes#3.

## User Stories

- As a **developer**, I want to select "MCP Sandbox" in the sandbox selector so that my agent
  code executes in an isolated container at :3005 instead of locally.
- As a **developer**, I want to see a green/red dot on the MCP option so that I know whether
  the sandbox is reachable before sending messages.
- As a **developer**, I want files created by the agent on the sandbox to appear in the
  FileEditorPanel so that I can review and edit them.
- As a **developer**, I want a toast with "Use State for this message" when the MCP sandbox is
  unreachable so that I can choose to fall back without losing my message.

## Key Integration Points

| File | Function(s) | Role |
|------|-------------|------|
| `backend/src/agents/mcp_sandbox.py` | `McpSandboxBackend(BaseSandbox)` | Core MCP sandbox implementation — execute, upload, download |
| `backend/src/agents/__init__.py` | `_create_mcp_backend_checked()`, `resolve_sandbox_backend()` | Factory registration + Daytona → MCP → State fallback chain |
| `backend/src/schemas/entities/settings.py` | `SandboxType` | Add MCP enum value |
| `backend/src/schemas/entities/settings.py` | `default_mcp_sandbox_url` | User-configured sandbox URL (no env var) |
| `backend/src/controllers/llm.py` | `llm_invoke()` | MCP error handling + user-approved fallback response |
| `backend/src/utils/stream.py` | `stream_generator()` | MCP error handling + fallback response |

## UI Integration Points

| Component / Route | Change Type | Description |
|-------------------|-------------|-------------|
| `SandboxSettings.tsx` | Modify | Add MCP option with health indicator dot |
| `ThreadSandboxStatus.tsx` | Modify | Add MCP option with health indicator dot |
| `frontend/src/lib/config/sandbox.ts` | Modify | Add MCP to SANDBOX_OPTIONS, update normalizer |
| `frontend/src/lib/services/userSettingsService.ts` | Modify | Extend SandboxType union |
| `frontend/src/hooks/useSandboxHealth.ts` | New hook | Health check for exec_server on page load + dropdown open |
| Chat stream error handler | Modify | Toast with "Use State for this message" button |

## Storage

- **Persistence layer**: LangGraph Store (existing UserSettings entity)
- **Namespace**: `(user_id, "settings")` — existing `default_sandbox` field
- **Model pattern**: `SandboxType` enum, `PatchDefaultsRequest` — existing patterns

## Architectural Decisions

- **Source of truth**: Backend `UserSettings.default_sandbox` — NOT localStorage
- **State management**: Existing `patchDefaults()` → `getSettings()` cycle
- **Auth / scoping**: User-scoped via session user_id
- **Sandbox protocol**: MCP JSON-RPC 2.0 over Streamable HTTP, BaseSandbox-conformant
- **Fallback chain**: Daytona → MCP → State (user-approved for MCP failures)
- **Session lifecycle**: Persistent with reconnect on failure
- **Working directory**: `/workspace` default in sandbox container

## Validation Tools

- [x] Load `agent-browser` skill with screenshots to validate E2E
- [x] Conformance test suite in sandboxes repo validates BaseSandbox contract
- [x] Unit tests for McpSandboxBackend (mocked + integration)
- [x] Frontend tests for MCP option rendering and selection

## Acceptance Criteria

- [ ] `McpSandboxBackend(BaseSandbox)` implements all 4 abstract methods (execute, id, upload_files, download_files)
- [ ] All 6 inherited tools (read, write, edit, grep_raw, glob_info, ls_info) work via execute() delegation
- [ ] Registered in `_SANDBOX_FACTORIES` as `"mcp"`
- [ ] Fallback chain: Daytona → MCP → State
- [ ] Frontend sandbox selector shows MCP option with green/red health indicator
- [ ] FileEditorPanel displays files created by agent on sandbox
- [ ] Toast with "Use State for this message" button when MCP unreachable
- [ ] exec_server exposes all 9 BaseSandbox-conformant MCP tools (execute, read, write, edit, grep, glob, ls, upload_file, download_file)
- [ ] Conformance test suite passes against exec_server
- [ ] All previous & new tests pass, validated using `agent-browser` CLI
- [ ] New code follows existing repo/service/route patterns
- [ ] No new dependencies added beyond what's already in the project
```

### Sandboxes Repo PR (Spec 004 — separate repo)

```yml
pull_request_title: "FROM feat/3-basesandbox-conformant TO main"
branch: "feat/3-basesandbox-conformant"
repo: "ruska-ai/sandboxes"
```

Must be merged + RC-tagged before the Orchestra PR can be fully validated.

### Sub-Branch Strategy (development within worktree)

Within the `feat/890-mcp-sandbox` worktree, specs are implemented sequentially:

| Spec | Commit(s) | Description |
|------|-----------|-------------|
| 001 | `feat(sandbox): add McpSandboxBackend core class` | mcp_sandbox.py + tests |
| 002 | `feat(sandbox): wire MCP into dispatch + fallback chain` | factory, enum, error handling |
| 003 | `feat(frontend): add MCP sandbox option + health + fallback UX` | types, config, components, hook |
| 005 | `feat(sandbox): McpSandboxBackend v2 with native MCP tools` | override all methods + tests |

### Human Reviewer UI Walkthrough

The human reviewer validates correctness by walking through the UI user story. All automated tests (unit, integration, conformance) are run by CI/agents before the PR reaches the reviewer. The reviewer's job is to prove the implementation is correct from the user's perspective.

**Setup** (one-time before review):
```bash
# 1. Seed test user
cd backend && make seeds.user

# 2. Start exec_server (sandbox at :3005)
COMPOSE_PROFILES=tools make dev.docker.up

# 3. Start backend (:8000)
cd backend && make dev

# 4. Start frontend (:5173)
cd frontend && npm run dev
```

**Login**: Navigate to `http://localhost:5173`, log in as `admin@example.com` / `test1234`

---

#### Review 1: Configure MCP Sandbox URL + MCP Option Appears with Health Indicator (PR-002, 003)

**What to look for**: User configures sandbox URL in settings, then MCP option appears with live connection status dot.

1. Navigate to **Settings** page (`/settings`)
2. Scroll to "Default Sandbox" card
3. Click the sandbox dropdown
   - **EXPECT**: Only "State (Default)" and optionally "Daytona" visible — NO "MCP Sandbox" yet (URL not configured)
4. Find the "MCP Sandbox URL" input field (below the sandbox selector)
   - **EXPECT**: Empty input with placeholder like "http://localhost:3005/mcp"
5. Enter `http://localhost:3005/mcp` and save
   - **EXPECT**: Toast "MCP Sandbox URL saved" (or similar)
6. Click the sandbox dropdown again
   - **EXPECT**: "MCP Sandbox" option NOW appears (because URL is configured)
   - **EXPECT**: Green dot next to "MCP Sandbox" (exec_server is running at :3005)
   - **EXPECT**: Description reads "Run agent code in an isolated MCP sandbox container."
7. Select "MCP Sandbox"
   - **EXPECT**: Toast "Default sandbox updated"
   - **EXPECT**: Dropdown shows "MCP Sandbox" as selected
8. Refresh the page (F5)
   - **EXPECT**: "MCP Sandbox" still selected after reload (URL + sandbox choice persisted)
6. Navigate to the chat page (`/`)
7. Find the sandbox selector button in the bottom utility row
   - **EXPECT**: Button shows "Sandbox MCP" with green dot
8. Click the sandbox button to open popover
   - **EXPECT**: Popover shows all options, checkmark next to "MCP Sandbox"
   - **EXPECT**: Green dot visible next to MCP option

**Health indicator negative test**:
9. Stop the exec_server (`docker stop <exec_server_container>`)
10. Refresh the page or re-open the sandbox selector
    - **EXPECT**: Red dot next to "MCP Sandbox" (exec_server unreachable)
11. Restart exec_server before continuing

---

#### Review 2: Agent Executes on Remote Sandbox + Files Sync to FileEditorPanel (PR-001, 002, 003)

**What to look for**: Agent commands run on the remote sandbox (not local), and files created by the agent appear in the FileEditorPanel.

1. Ensure MCP sandbox is selected (from Review 1)
2. Open the FileEditorPanel (click the file icon or sidebar toggle)
   - **EXPECT**: Panel opens, may show existing files or be empty
3. Type in chat: **"Run `whoami && hostname && pwd` on the sandbox"**
4. Send message
   - **EXPECT**: Agent response shows tool execution
   - **EXPECT**: `whoami` output is `executor` (the sandbox unprivileged user, NOT your local username)
   - **EXPECT**: `pwd` output is `/workspace` (the sandbox working directory)
   - **EXPECT**: `hostname` is the container hostname (NOT your local hostname)
   - This proves the command ran on the remote sandbox at :3005
5. Type: **"Create a file /workspace/hello.py with content: print('Hello from MCP sandbox')"**
6. Send message
   - **EXPECT**: Agent uses the write tool to create the file on the sandbox
   - **EXPECT**: `/workspace/hello.py` appears in the FileEditorPanel file tree
   - **EXPECT**: Clicking on it shows the content: `print('Hello from MCP sandbox')`
7. Type: **"Edit /workspace/hello.py replacing 'Hello' with 'Greetings'"**
8. Send message
   - **EXPECT**: Agent uses the edit tool
   - **EXPECT**: FileEditorPanel updates to show `print('Greetings from MCP sandbox')`
9. Type: **"Run `python3 /workspace/hello.py` on the sandbox"**
10. Send message
    - **EXPECT**: Output is "Greetings from MCP sandbox"
    - **EXPECT**: exit_code is 0
11. Type: **"List all files in /workspace on the sandbox"**
12. Send message
    - **EXPECT**: Response shows `hello.py` in the listing
    - **EXPECT**: ls_info returns structured file metadata

---

#### Review 3: All BaseSandbox Tools Work on Remote Sandbox (PR-005)

**What to look for**: Every BaseSandbox tool (execute, read, write, edit, grep, glob, ls, upload, download) works correctly on the remote sandbox.

1. Type: **"Search for the word 'Greetings' in all files under /workspace on the sandbox"**
   - **EXPECT**: grep returns a match in `/workspace/hello.py` with line number
2. Type: **"Find all .py files under /workspace on the sandbox"**
   - **EXPECT**: glob returns `/workspace/hello.py` with file metadata
3. Type: **"Read /workspace/hello.py from the sandbox with line numbers"**
   - **EXPECT**: Output shows `     1	print('Greetings from MCP sandbox')` (cat -n format)
4. Type: **"Upload a file to /workspace/data.json on the sandbox with content: {\"test\": true}"**
   - **EXPECT**: File uploaded successfully, appears in FileEditorPanel
5. Type: **"Download /workspace/data.json from the sandbox"**
   - **EXPECT**: Content matches `{"test": true}`
6. Type: **"Try to download /workspace/nonexistent.txt from the sandbox"**
   - **EXPECT**: Error response indicating file not found
7. Type: **"Run `ls /nonexistent-dir` on the sandbox"**
   - **EXPECT**: Non-zero exit code reported in response
8. Type: **"Clean up: remove all files in /workspace on the sandbox"**
   - **EXPECT**: Cleanup succeeds

---

#### Review 4: Fallback UX When Sandbox Unreachable (PR-002, 003)

**What to look for**: User-approved fallback with toast and action button.

1. Ensure MCP sandbox is still selected
2. Stop the exec_server: `docker stop <exec_server_container>`
3. Type: **"What is 2+2?"**
4. Send message
   - **EXPECT**: Toast appears: "MCP sandbox unreachable"
   - **EXPECT**: Toast has an action button: "Use State for this message"
   - **EXPECT**: Message is NOT processed yet (waiting for user decision)
5. Click "Use State for this message" button
   - **EXPECT**: Message processes using State backend
   - **EXPECT**: Agent responds with "4" (or equivalent)
   - **EXPECT**: MCP sandbox is STILL selected as default (check thread status bar)
6. Restart exec_server: `docker start <exec_server_container>`
7. Type: **"Run `whoami` on the sandbox"**
8. Send message
   - **EXPECT**: Resumes using MCP sandbox (shows `executor`, not local user)
   - **EXPECT**: No fallback toast (exec_server is back)

---

#### Review 5: Sandbox Isolation — State vs MCP (Final Regression)

**What to look for**: State and MCP sandboxes are truly isolated environments.

1. Switch to State sandbox (via thread status bar)
2. Type: **"Run `whoami && pwd`"**
   - **EXPECT**: Shows your LOCAL username and LOCAL working directory
   - **EXPECT**: This is different from the sandbox `executor` / `/workspace`
3. Switch to MCP sandbox
4. Type: **"Run `whoami && pwd`"**
   - **EXPECT**: Shows `executor` and `/workspace`
5. Switch to State sandbox
6. Type: **"List files in /workspace"**
   - **EXPECT**: Either error (no /workspace locally) or different contents than sandbox
7. Switch to MCP sandbox
8. Type: **"List files in /workspace"**
   - **EXPECT**: Shows files from the sandbox container (may include files from Review 2-3)

**Reviewer sign-off**: If all 5 reviews pass, the implementation correctly provides a full BaseSandbox-conformant MCP sandbox backend with proper UI integration, health monitoring, and user-approved fallback.

### Merge Order

```
1. Sandboxes PR (ruska-ai/sandboxes#3 — independent, merge + RC tag first)
2. Orchestra PR (feat/890-mcp-sandbox → development — single PR with all specs)
3. Run Human Reviewer UI Walkthrough after both PRs merged
```

### RC Tag Workflow

Per project convention (feedback_rc_tag_workflow): NEVER merge Docker/infra changes before validating with an RC tag in production. After Sandboxes PR is approved:
1. Tag a release candidate: `git tag v1.x.x-rc.1` in sandboxes repo
2. Deploy RC to staging/test environment
3. Run conformance test suite against RC deployment: `bash tests/conformance.sh`
4. Only merge to main after RC validation passes
5. Then proceed with Orchestra PR review

## Documentation Update Spec (Part of Implementation)

Documentation gaps that must be addressed as part of the PR. Each spec includes its doc updates.

### Docs to UPDATE (existing files):

| File | Gap | Update Required |
|------|-----|-----------------|
| `wiki/docs/tools/sandbox.md` | Documents only `exec_command` tool | Update to list all 9 BaseSandbox-conformant MCP tools (execute, read, write, edit, grep, glob, ls, upload_file, download_file). Update endpoint from `/exec` to `/mcp`. Document `/workspace` working directory convention. |
| `wiki/docs/tools/sandbox-tutorial.md` | Shows only MCP tool config, not sandbox backend selection | Add section: "Selecting MCP Sandbox as Execution Backend" — settings page + thread status bar walkthrough with screenshots. Document health indicator (green/red dot). |
| `wiki/docs/tools/mcp.md` | No mention of sandbox backends | Add subsection: "MCP Servers as Sandbox Backends" explaining that conformant MCP servers can serve as DeepAgents execution backends. |
| `wiki/docs/getting-started.md` | Sandbox selection mentioned briefly ("Auto tries Daytona, falls back to local") | Expand to document all 3 options: State (Default), Daytona, MCP Sandbox. Explain fallback chain. Document the "MCP sandbox unreachable" toast + user-approved fallback UX. |
| `backend/.example.env` | `SHELL_EXEC_SERVER_URL` points to `/exec` (old endpoint) | Add deprecation note for `SHELL_EXEC_SERVER_URL`. Document that MCP sandbox URL is now user-configured via Settings page, not an env var. |
| `backend/CLAUDE.md` | Only mentions `COMPOSE_PROFILES=tools` briefly | Add "MCP Sandbox" section documenting: how to start exec_server, how users configure sandbox URL in Settings, how to run conformance tests. |
| `sandboxes/README.md` | No protocol specification | Add "BaseSandbox Protocol Conformance" section: required MCP tools, exit code semantics, `/workspace` convention, session lifecycle, python3 requirement. |
| `sandboxes/ubuntu/README.md` | Documents only `exec_command` | Update to list all 9 tools. Add conformance test instructions: `bash tests/conformance.sh http://localhost:3005`. |
| `website/public/llm.txt` | Likely missing MCP Sandbox capabilities | Add MCP Sandbox as an execution backend option. Document how external LLMs can use it. |

### Docs to CREATE (new files):

| File | Purpose |
|------|---------|
| `wiki/docs/tools/sandbox-protocol.md` | **BaseSandbox Protocol Specification**: All 9 MCP tools with params, return formats, exit code semantics. Session lifecycle. Working directory convention. Conformance requirements. This is the canonical spec for anyone building a new sandbox. |
| `sandboxes/tests/README.md` | **Conformance Test Suite Documentation**: How to run tests, what they validate, how to interpret results, how to add new tests. |

### Doc Update Rules

- Documentation updates are committed in the **same PR** as the code they document
- Wiki changes go to `wiki/` submodule (committed inside wiki directory)
- `llm.txt` updates require running `npm run prebuild` in `website/` after changes
- All doc updates must be reviewable in the PR diff
- Screenshots for UI docs are captured via agent-browser during QA

## Development Environment Optimizations

The MCP Sandbox feature introduces a new service dependency (exec_server at :3005) that exposes gaps in the current dev tooling. These optimizations reduce friction for developers working with sandboxes.

### 1. New Makefile Targets (root `Makefile`)

Currently developers must remember `COMPOSE_PROFILES=tools make dev.docker.up` to include exec_server. Add dedicated targets:

```makefile
# Sandbox-specific targets
dev.sandbox.up:        # docker compose -f docker-compose.services.yml --profile tools up -d exec_server
dev.sandbox.down:      # docker compose -f docker-compose.services.yml --profile tools stop exec_server
dev.sandbox.health:    # curl -sf http://localhost:3005/health | jq . || echo "Sandbox unreachable"
dev.sandbox.logs:      # docker compose -f docker-compose.services.yml logs -f exec_server
dev.sandbox.test:      # cd sandboxes && bash tests/conformance.sh http://localhost:3005

# Full stack with sandbox
dev.full.up:           # make dev.storage.up && make dev.sandbox.up && make dev.docker.up
dev.full.down:         # make dev.docker.down && make dev.sandbox.down && make dev.storage.down
```

**Files**: `Makefile`

### 2. CI Pipeline: Sandbox Image Build + Integration Test

Currently CI (`test.yml`) skips sandbox entirely. `build.yml` never builds the sandbox image.

**Add to `.github/workflows/test.yml`**:
```yaml
test-sandbox:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { submodules: true }
    - name: Build exec_server
      run: docker build -t exec-server-test sandboxes/ubuntu/
    - name: Start exec_server
      run: docker run -d -p 3005:3005 --name exec-server exec-server-test
    - name: Run conformance tests
      run: cd sandboxes && bash tests/conformance.sh http://localhost:3005
    - name: Cleanup
      run: docker stop exec-server
```

**Add to `.github/workflows/build.yml`**:
```yaml
- name: Build sandbox image
  run: docker build -t ghcr.io/${{ github.repository_owner }}/orchestra-sandbox:${{ env.TAG }} sandboxes/ubuntu/
- name: Push sandbox image
  run: docker push ghcr.io/${{ github.repository_owner }}/orchestra-sandbox:${{ env.TAG }}
```

**Files**: `.github/workflows/test.yml`, `.github/workflows/build.yml`

### 3. Backend Test Fixture for Sandbox

Currently `backend/tests/conftest.py` has no sandbox fixture. Tests skip sandbox entirely.

**Add sandbox fixture**:
```python
@pytest.fixture
def mock_mcp_sandbox(respx_mock):
    """Mock MCP sandbox for unit tests — no exec_server needed."""
    respx_mock.get("http://localhost:3005/health").respond(json={"status": "ok", "sandbox_id": "test-sandbox-123"})
    respx_mock.post("http://localhost:3005/mcp").respond(json={
        "jsonrpc": "2.0", "id": 1,
        "result": {"content": [{"type": "text", "text": "mocked output\nexit_code: 0"}]}
    })
    return respx_mock
```

**Add integration test marker**:
```python
# backend/tests/integration/test_mcp_sandbox_integration.py
@pytest.mark.skipif(not is_sandbox_available(), reason="exec_server not running at :3005")
class TestMcpSandboxIntegration:
    ...
```

**Files**: `backend/tests/conftest.py`, `backend/tests/integration/test_mcp_sandbox_integration.py` (NEW)

### 4. Environment Variable Fixes

**Current problem**: `.example.env` has `SHELL_EXEC_SERVER_URL="http://localhost:3005/exec"` — the `/exec` endpoint doesn't exist on the MCP server (it's `/mcp`).

**Fix in `.example.env`**:
```bash
## MCP Sandbox Backend
# MCP Sandbox URL is user-configured via Settings page (not an env var)
# Users enter their sandbox URL in Settings > Default Sandbox > MCP Sandbox URL
# Example: http://localhost:3005/mcp
# SHELL_EXEC_SERVER_URL is deprecated
```

**Files**: `backend/.example.env`

### 5. Hot-Reload for Sandbox Development

Currently the exec_server container doesn't support hot-reload — changes to `sandboxes/ubuntu/index.js` require rebuilding the image.

**Add volume mount in `docker-compose.services.yml`**:
```yaml
exec_server:
  volumes:
    - ./sandboxes/ubuntu/index.js:/app/index.js:ro   # Hot-reload on save
    - ./sandboxes/ubuntu/package.json:/app/package.json:ro
```

Combined with `node --watch` in the entrypoint (Node 22 supports `--watch` natively), this enables live-reload during sandbox development.

**Files**: `docker-compose.services.yml`, `sandboxes/ubuntu/entrypoint.sh`

### 6. Pre-commit Hook: Sandbox Conformance (Optional)

Too heavy for every commit, but add as an optional hook that runs when sandbox files change:

```yaml
- id: sandbox-conformance
  name: Sandbox Conformance Test
  entry: bash -c 'cd sandboxes && bash tests/conformance.sh http://localhost:3005 2>/dev/null || echo "SKIP: exec_server not running"'
  language: system
  files: ^sandboxes/
  stages: [manual]  # Only runs with: pre-commit run sandbox-conformance
```

**Files**: `.pre-commit-config.yaml`

### Summary of Dev Environment Changes

| Change | Impact | Files |
|--------|--------|-------|
| Makefile sandbox targets | Reduces 1-line commands to memorable `make` targets | `Makefile` |
| CI sandbox build + test | Catches sandbox regressions in PR checks | `.github/workflows/test.yml`, `build.yml` |
| Backend test fixture | Enables unit testing without running exec_server | `backend/tests/conftest.py` |
| Env var fix | Corrects stale `/exec` endpoint to `/mcp` | `backend/.example.env` |
| Hot-reload volumes | Live sandbox development without image rebuilds | `docker-compose.services.yml` |
| Pre-commit hook (optional) | Conformance validation on sandbox file changes | `.pre-commit-config.yaml` |

## Post-Implementation Insights & Follow-Up Improvements

After each spec is implemented, the implementing agent should capture insights that improve future sessions. These go into `.claude/projects/` memory files:

### Insights to Capture During Implementation

| Spec | Insight Category | What to Record |
|------|-----------------|----------------|
| 001 | **MCP protocol** | Exact JSON-RPC 2.0 message format that worked, any protocol quirks discovered (e.g., session header casing, content-type requirements, error response format) |
| 001 | **httpx patterns** | Which httpx client configuration worked best (timeouts, connection pooling, headers). Record as reusable pattern for future MCP integrations |
| 002 | **Fallback chain** | Any race conditions or edge cases in the dispatch logic. Record error types that need special handling |
| 003 | **Health check** | Latency of health check on page load — does it cause visible delay? Record if debouncing/caching was needed |
| 003 | **Toast UX** | How the retry-with-state flow interacts with SSE streaming. Record if the stream needs special reconnection logic |
| 004 | **exec_server tools** | Zod schema patterns that map cleanly to BaseSandbox params. Record as template for adding future tools |
| 004 | **Conformance tests** | Which tests caught real bugs vs. which were just validation. Prune or highlight accordingly |
| 005 | **Tool discovery** | Performance impact of `tools/list` call on session init. Record if caching strategy needed adjustment |
| 005 | **Native vs shell** | Measurable latency difference between native MCP tools and shell-delegation fallback. Record metrics |

### Memory Files to Create/Update

After implementation, create or update these memory files:

1. **`memory/feedback_mcp_sandbox_patterns.md`** — Validated MCP JSON-RPC patterns (message format, session lifecycle, error handling) that worked. Future MCP integrations should reference this.

2. **`memory/project_sandbox_architecture.md`** — How the sandbox system works post-MCP: factory pattern, fallback chain, BaseSandbox protocol conformance. Prevents re-exploration in future sandbox work.

3. **`memory/feedback_conformance_testing.md`** — What the conformance test suite caught, what it missed. Guide for improving the suite.

4. **`memory/feedback_file_editor_sync.md`** — How agent tool outputs sync to FileEditorPanel via SSE streaming. Any gotchas with file source tagging, dirty state, or persistence timing.

### Process Improvements for Future Specs

After the full feature ships, reflect on:

1. **Spec granularity**: Were 5 specs the right number? Would fewer (bundled) or more (finer-grained) have been better for Ralph execution?
2. **QA story effectiveness**: Which agent-browser QA steps caught real issues vs. were redundant? Trim the template.
3. **Human review efficiency**: Did the reviewer find the 5-section walkthrough practical? Were any sections skippable or missing?
4. **Conformance test ROI**: Did the conformance test suite catch bugs that unit tests missed? Worth the investment for future features?
5. **Parallel spec execution**: Did specs 001, 003, 004 actually parallelize well, or did implicit dependencies cause rework?

Record these reflections in **`memory/project_mcp_sandbox_retro.md`** to improve the next feature's spec generation process.

## Deliverables

Create 5 spec files at `.claude/specs/feat-890-mcp-sandbox/` following the feature spec template format with frontmatter, requirements, success criteria checkboxes, example output, and Ralph instructions. Each spec includes its corresponding QA story from above as a "QA Validation" section.
