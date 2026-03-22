---
task: exec_server BaseSandbox-Conformant MCP Tools (Feature #890 + sandboxes#3)
test_command: "cd sandboxes && bash tests/conformance.sh http://localhost:3005"
---

# Task: exec_server BaseSandbox-Conformant MCP Tools (Feature #890 + sandboxes#3)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Enhance `sandboxes/ubuntu/index.js` to expose MCP tools that mirror the full `BaseSandbox` protocol 1:1. Rename `exec_command` to `execute`. Add 8 new tools. Add structured `_meta` with `exit_code` and `sandbox_id` to all tool responses. Create a conformance test suite. Any sandbox that passes this suite is a drop-in DeepAgents sandbox backend.

**Independent**: Can be implemented in parallel with Specs 001, 002, and 003. This is in the `sandboxes/` submodule (separate `ruska-ai/sandboxes` repo).

## Requirements

### Tool Rename + New Tools

1. **Rename `exec_command` to `execute`** — add `exec_command` as a backward-compatibility alias that delegates to the same handler. This prevents a breakage window between Phase 4 deploy (tool rename) and Phase 5 deploy (dual-name support in Python client). The alias can be removed in a future cleanup pass once all consumers use `execute`.
2. **Add structured `_meta` to ALL tool responses**:
   ```json
   {
     "content": [{"type": "text", "text": "..."}],
     "_meta": {"exit_code": 0, "sandbox_id": "<uuid>"}
   }
   ```
   - `exit_code`: integer (not text-embedded)
   - `sandbox_id`: UUID generated once at server startup via `crypto.randomUUID()`
3. **`execute` tool** (renamed from `exec_command`):
   - Params: `{cmd: string, timeout?: number}`
   - Keep text-embedded `exit_code: N` in output text for backward compat (Phase 1)
   - Also include `_meta.exit_code` as structured integer
   - Timeout: use provided timeout or default 120s, cap at 120s max
4. **`read` tool** (NEW):
   - Params: `{path: string, offset?: number, limit?: number}`
   - Returns file content in `cat -n` format (line numbers + tab + content)
   - `offset`: 0-based line offset, default 0
   - `limit`: max lines to return, default 2000
   - `_meta.exit_code`: 0 on success, 1 if file not found
5. **`write` tool** (NEW):
   - Params: `{path: string, content: string}`
   - Creates parent directories with `mkdir -p`
   - Writes content to file (overwrites if exists)
   - `_meta.exit_code`: 0 on success, 1 on error
6. **`edit` tool** (NEW):
   - Params: `{path: string, old_string: string, new_string: string, replace_all?: boolean}`
   - Exit code semantics matching BaseSandbox's `_EDIT_COMMAND_TEMPLATE`:
     - 0: success (replacement made)
     - 1: `old_string` not found in file
     - 2: `old_string` found multiple times (and `replace_all` is false)
     - 3: file not found
   - Returns occurrence count as text content
7. **`grep` tool** (NEW):
   - Params: `{pattern: string, path?: string, glob?: string}`
   - Returns newline-delimited JSON objects: `{"path": "...", "line": N, "text": "..."}`
   - Uses fixed-string grep (`grep -rHnF`)
   - Default path: `/workspace` (or cwd)
   - `_meta.exit_code`: 0 on matches found, 1 on no matches
8. **`glob` tool** (NEW):
   - Params: `{pattern: string, path?: string}`
   - Returns newline-delimited JSON objects: `{"path": "...", "is_dir": bool, "size": N, "mtime": "ISO"}`
   - Default path: `/workspace`
   - `_meta.exit_code`: 0 on success
9. **`ls` tool** (NEW):
   - Params: `{path: string}`
   - Returns newline-delimited JSON objects: `{"path": "...", "is_dir": bool}`
   - `_meta.exit_code`: 0 on success, 1 if path not found
10. **`upload_file` tool** (NEW):
    - Params: `{path: string, content_base64: string}`
    - Decodes base64, creates parent dirs, writes binary file
    - Returns: `"Written N bytes to <path>"`
    - `_meta.exit_code`: 0 on success, 1 on error
11. **`download_file` tool** (NEW):
    - Params: `{path: string}`
    - Reads file, returns base64-encoded content as text
    - `_meta.exit_code`: 0 on success, 1 if file not found

### Infrastructure Changes

12. **Sandbox ID**: Generate `crypto.randomUUID()` once at server startup. Include in:
    - `/health` response: `{"status": "ok", "sessions": N, "sandbox_id": "<uuid>"}`
    - Every tool response `_meta.sandbox_id`
13. **Ensure python3 available**: Update Dockerfile to install `python3`:
    ```dockerfile
    RUN apt-get update && apt-get install -y --no-install-recommends python3
    ```
    (Debian bookworm-slim may already have python3 — verify and add if missing)
14. **Working directory (OpenClaw model)**: Change default cwd from `/home/executor` to `/workspace`:
    - Update Dockerfile/entrypoint to create `/workspace` directory structure:
      ```
      /workspace/
      ├── AGENTS.md
      ├── SOUL.md
      ├── USER.md
      ├── IDENTITY.md
      ├── TOOLS.md
      ├── MEMORY.md
      ├── memory/
      ├── skills/
      └── canvas/
      ```
    - Create empty template files on container startup (in `entrypoint.sh`)
    - Set `cwd: "/workspace"` in `exec()` calls instead of `/home/executor`
    - Ensure `/workspace` is writable by the `executor` user
15. **Update `tools/list` response**: All 9 tools should be listed with descriptions and Zod schemas

### Conformance Test Suite

16. **Create `sandboxes/tests/conformance.sh`**:
    - Accepts server URL as argument: `bash tests/conformance.sh http://localhost:3005`
    - Tests ALL 9 MCP tools are registered and functional
    - Tests exit_code semantics for each tool (success + error cases)
    - Tests `sandbox_id` in `/health` and `_meta`
    - Tests `python3` availability via execute tool
    - Tests timeout behavior
    - Tests `/workspace` as default working directory with OpenClaw layout
    - Tests session lifecycle: init, reuse across calls, concurrent requests, session cleanup (DELETE `/mcp`), reconnect after session expiry
    - Output format: `PASS: <test_name>` or `FAIL: <test_name> - <reason>`
    - Exit code 0 if all pass, 1 if any fail
    - Summary at end: `N/M tests passed`

## Tool Registration Pattern

```javascript
const SANDBOX_ID = crypto.randomUUID();

function makeResult(text, exitCode) {
  return {
    content: [{ type: "text", text }],
    _meta: { exit_code: exitCode, sandbox_id: SANDBOX_ID },
  };
}

function registerTools(server) {
  server.tool("execute", "Execute a shell command", { cmd: z.string(), timeout: z.number().optional() }, executeHandler);
  server.tool("exec_command", "Execute a shell command (backward-compat alias)", { cmd: z.string(), timeout: z.number().optional() }, executeHandler);
  server.tool("read", "Read file with line numbers", { path: z.string(), offset: z.number().optional(), limit: z.number().optional() }, readHandler);
  server.tool("write", "Write content to file", { path: z.string(), content: z.string() }, writeHandler);
  server.tool("edit", "Replace string in file", { path: z.string(), old_string: z.string(), new_string: z.string(), replace_all: z.boolean().optional() }, editHandler);
  server.tool("grep", "Search for pattern in files", { pattern: z.string(), path: z.string().optional(), glob: z.string().optional() }, grepHandler);
  server.tool("glob", "Find files by glob pattern", { pattern: z.string(), path: z.string().optional() }, globHandler);
  server.tool("ls", "List directory contents", { path: z.string() }, lsHandler);
  server.tool("upload_file", "Upload base64 file", { path: z.string(), content_base64: z.string() }, uploadHandler);
  server.tool("download_file", "Download file as base64", { path: z.string() }, downloadHandler);
}
```

## Success Criteria

1. [ ] `exec_command` renamed to `execute` with `exec_command` kept as backward-compat alias (same handler)
2. [ ] `execute` tool includes both text-embedded `exit_code: N` and `_meta.exit_code` (integer)
3. [ ] `read` tool returns `cat -n` formatted content with `offset`/`limit` support
4. [ ] `write` tool creates files with parent dirs, `exit_code=1` on error
5. [ ] `edit` tool implements exit codes 0-3 matching BaseSandbox semantics
6. [ ] `grep` tool returns JSON lines format `{path, line, text}` with fixed-string search
7. [ ] `glob` tool returns JSON lines format `{path, is_dir, size, mtime}`
8. [ ] `ls` tool returns JSON lines format `{path, is_dir}`
9. [ ] `upload_file` tool decodes base64, writes binary, returns byte count
10. [ ] `download_file` tool reads file, returns base64-encoded content
11. [ ] `_meta.sandbox_id` present in ALL tool responses (UUID generated at startup)
12. [ ] `_meta.exit_code` is integer (not string) in ALL tool responses
13. [ ] `/health` endpoint returns `sandbox_id` field
14. [ ] `tools/list` returns all 9 tools with correct names and schemas
15. [ ] Dockerfile ensures `python3` is available in the container
16. [ ] `/workspace` is the default working directory with OpenClaw layout (AGENTS.md, SOUL.md, etc.)
17. [ ] Conformance test suite `sandboxes/tests/conformance.sh` exists and tests all 9 tools
18. [ ] Conformance tests validate exit_code semantics, sandbox_id, python3, /workspace, session lifecycle
19. [ ] Conformance tests pass when run against the updated exec_server
20. [ ] All tool handlers run commands as `executor` user (unprivileged)

## Example Output

### Health check:
```json
{"status": "ok", "sessions": 0, "sandbox_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}
```

### execute tool response:
```json
{
  "content": [{"type": "text", "text": "stdout:\nhello\nexit_code: 0"}],
  "_meta": {"exit_code": 0, "sandbox_id": "a1b2c3d4..."}
}
```

### read tool response:
```json
{
  "content": [{"type": "text", "text": "     1\tHello World\n     2\tLine 2"}],
  "_meta": {"exit_code": 0, "sandbox_id": "a1b2c3d4..."}
}
```

### grep tool response:
```json
{
  "content": [{"type": "text", "text": "{\"path\":\"/workspace/test.txt\",\"line\":1,\"text\":\"Hello World\"}\n{\"path\":\"/workspace/test.txt\",\"line\":3,\"text\":\"Hello Again\"}"}],
  "_meta": {"exit_code": 0, "sandbox_id": "a1b2c3d4..."}
}
```

### Conformance test output:
```
Running conformance tests against http://localhost:3005
PASS: health_check - status ok, sandbox_id present
PASS: session_init - got Mcp-Session-Id header
PASS: tools_list - all 9 tools registered
PASS: execute_success - exit_code=0, output contains expected text
PASS: execute_failure - exit_code=2 for ls /nonexistent
PASS: read_success - cat -n format, exit_code=0
PASS: read_not_found - exit_code=1
PASS: write_success - file created, exit_code=0
PASS: edit_success - replacement made, exit_code=0
PASS: edit_not_found - exit_code=1
PASS: edit_multiple - exit_code=2 (replace_all=false)
PASS: edit_file_missing - exit_code=3
PASS: grep_match - JSON lines output, exit_code=0
PASS: grep_no_match - exit_code=1
PASS: glob_success - JSON lines with metadata
PASS: ls_success - JSON lines with is_dir
PASS: upload_file - binary round-trip preserved
PASS: download_file - base64 content returned
PASS: download_not_found - exit_code=1
PASS: python3_available - python3 --version succeeds
PASS: workspace_default - pwd returns /workspace
PASS: workspace_layout - AGENTS.md, SOUL.md, etc. exist
PASS: session_reuse - multiple calls on same session
PASS: session_cleanup - DELETE /mcp removes session
24/24 tests passed
```

## QA Validation

### Build and start updated exec_server:
```bash
cd sandboxes/ubuntu && docker build -t exec-server-test . && docker run -d -p 3005:3005 --name exec-server-test exec-server-test
```

### Run conformance tests:
```bash
cd sandboxes && bash tests/conformance.sh http://localhost:3005
```

### Manual tool validation (see plan QA-004 for full curl commands)

## Files

| File | Action |
|------|--------|
| `sandboxes/ubuntu/index.js` | MODIFY (rename exec_command, add 8 tools, add _meta, add sandbox_id) |
| `sandboxes/ubuntu/Dockerfile` | MODIFY (ensure python3, create /workspace) |
| `sandboxes/ubuntu/entrypoint.sh` | MODIFY (create /workspace OpenClaw layout on startup) |
| `sandboxes/tests/conformance.sh` | CREATE (full conformance test suite) |

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes: build the Docker image and run `cd sandboxes && bash tests/conformance.sh http://localhost:3005`
4. Commit your changes frequently (commit inside `sandboxes/` directory, it's a separate git repo)
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
