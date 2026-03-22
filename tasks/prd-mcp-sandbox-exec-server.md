# PRD: exec_server BaseSandbox-Conformant MCP Tools (Phase 4 — Feature #890)

## Ralph Story Mapping

> This PRD covers **Ralph US-024 through US-035** (Phase 4 — exec_server structured tools).
> **Note**: Phase 4 operates in the `sandboxes/` submodule (`ruska-ai/sandboxes` repo). Ralph cannot commit to the submodule, build Docker images, or start containers. Phase 4 stories should be executed manually or in a separate Ralph run targeting the sandboxes repo.

## Introduction

Enhance `sandboxes/ubuntu/index.js` to expose MCP tools that mirror the full `BaseSandbox` protocol 1:1, making the exec_server a drop-in sandbox backend for DeepAgents. This involves renaming `exec_command` to `execute`, adding 8 new tools (`read`, `write`, `edit`, `grep`, `glob`, `ls`, `upload_file`, `download_file`), adding structured `_meta` with `exit_code` and `sandbox_id` to every tool response, and creating a conformance test suite that validates the entire contract.

Phase 4 is **independent** and can be built in parallel with Phases 1, 2, and 3. All work is scoped to the `sandboxes/` submodule, which lives in the separate `ruska-ai/sandboxes` repository.

**GitHub Feature:** [#890](https://github.com/ruska-ai/orchestra/issues/890)

**4 files touched: 3 modified, 1 created.**

| File | Action |
|------|--------|
| `sandboxes/ubuntu/index.js` | MODIFY — rename `exec_command`, add 8 tools, add `_meta`, add `sandbox_id` |
| `sandboxes/ubuntu/Dockerfile` | MODIFY — install `python3`, create `/workspace` directory structure |
| `sandboxes/ubuntu/entrypoint.sh` | MODIFY — create `/workspace` OpenClaw layout on container startup |
| `sandboxes/tests/conformance.sh` | CREATE — full conformance test suite for all 9 tools |

## Goals

- Rename `exec_command` to `execute` as a clean break (no backward-compat alias)
- Implement 8 new MCP tools (`read`, `write`, `edit`, `grep`, `glob`, `ls`, `upload_file`, `download_file`) that mirror the BaseSandbox protocol
- Add structured `_meta` (containing `exit_code` as integer and `sandbox_id` as UUID) to every tool response
- Establish `/workspace` as the default working directory with the OpenClaw layout (`AGENTS.md`, `SOUL.md`, etc.)
- Ensure `python3` is available inside the container for agent workloads
- Create a conformance test suite (`tests/conformance.sh`) that validates all 9 tools, exit-code semantics, sandbox identity, and session lifecycle
- All tool handlers must execute commands as the unprivileged `executor` user

## User Stories

### US-001: Rename `exec_command` to `execute`
**Description:** As a sandbox consumer, I need the shell execution tool renamed from `exec_command` to `execute` so it aligns with the BaseSandbox protocol naming convention.

**Acceptance Criteria:**
- [ ] `exec_command` tool registration replaced with `execute` in `registerTools()`, with `exec_command` kept as a backward-compat alias (same handler) to prevent breakage between Phase 4 and Phase 5 deploys
- [ ] Tool accepts `{cmd: string, timeout?: number}` via Zod schema
- [ ] `timeout` parameter is optional; defaults to 120s, capped at 120s max
- [ ] Text-embedded `exit_code: N` preserved in output text for backward compatibility with Phase 1 consumers
- [ ] Tool handler runs commands as `executor` user (uid/gid)
- [ ] `tools/list` MCP response shows `execute` (not `exec_command`)
- [ ] `exec_command` registered as backward-compat alias (same `executeHandler` function) — prevents breakage during Phase 4→5 rollout window

### US-002: Add `_meta` Structure to All Tool Responses
**Description:** As a sandbox consumer, I need every tool response to include a structured `_meta` object containing `exit_code` (integer) and `sandbox_id` (UUID) so I can programmatically inspect tool outcomes without parsing text output.

**Acceptance Criteria:**
- [ ] `SANDBOX_ID` constant generated once at module load via `crypto.randomUUID()`
- [ ] Helper function `makeResult(text, exitCode)` returns `{content: [{type: "text", text}], _meta: {exit_code: exitCode, sandbox_id: SANDBOX_ID}}`
- [ ] `_meta.exit_code` is always an integer (not a string)
- [ ] `_meta.sandbox_id` is the same UUID for every response within a server process lifetime
- [ ] All 9 tool handlers use `makeResult()` for their return value
- [ ] `execute` tool includes both text-embedded `exit_code: N` in content AND `_meta.exit_code` as structured integer

### US-003: Implement `read` Tool
**Description:** As a sandbox consumer, I need a `read` tool to retrieve file contents with line numbers (cat -n format), supporting offset and line-limit pagination.

**Acceptance Criteria:**
- [ ] Tool registered as `read` with description "Read file with line numbers"
- [ ] Params: `{path: z.string(), offset: z.number().optional(), limit: z.number().optional()}`
- [ ] Returns file content in `cat -n` format: right-justified line numbers + tab + content per line
- [ ] `offset`: 0-based line offset, defaults to 0
- [ ] `limit`: maximum lines to return, defaults to 2000
- [ ] `_meta.exit_code`: 0 on success, 1 if file not found or unreadable
- [ ] Runs as `executor` user; cannot read files outside executor's permissions

### US-004: Implement `write` Tool
**Description:** As a sandbox consumer, I need a `write` tool that creates or overwrites files, automatically creating parent directories.

**Acceptance Criteria:**
- [ ] Tool registered as `write` with description "Write content to file"
- [ ] Params: `{path: z.string(), content: z.string()}`
- [ ] Creates parent directories with `mkdir -p` before writing
- [ ] Overwrites file if it already exists
- [ ] `_meta.exit_code`: 0 on success, 1 on error (permission denied, disk full, etc.)
- [ ] Runs as `executor` user

### US-005: Implement `edit` Tool
**Description:** As a sandbox consumer, I need an `edit` tool that performs string replacement in files with exit-code semantics matching the BaseSandbox `_EDIT_COMMAND_TEMPLATE`.

**Acceptance Criteria:**
- [ ] Tool registered as `edit` with description "Replace string in file"
- [ ] Params: `{path: z.string(), old_string: z.string(), new_string: z.string(), replace_all: z.boolean().optional()}`
- [ ] Exit code 0: replacement made successfully
- [ ] Exit code 1: `old_string` not found in file
- [ ] Exit code 2: `old_string` found multiple times and `replace_all` is false (ambiguous match)
- [ ] Exit code 3: file not found at `path`
- [ ] When `replace_all` is true, replaces all occurrences (exit code 0, never 2)
- [ ] Returns occurrence count as text content
- [ ] Runs as `executor` user

### US-006: Implement `grep` Tool
**Description:** As a sandbox consumer, I need a `grep` tool that searches files for a fixed-string pattern and returns structured JSON lines output.

**Acceptance Criteria:**
- [ ] Tool registered as `grep` with description "Search for pattern in files"
- [ ] Params: `{pattern: z.string(), path: z.string().optional(), glob: z.string().optional()}`
- [ ] Uses fixed-string search (`grep -rHnF` or equivalent)
- [ ] Default search path: `/workspace`
- [ ] Returns newline-delimited JSON objects: `{"path": "...", "line": N, "text": "..."}`
- [ ] `_meta.exit_code`: 0 when matches found, 1 when no matches
- [ ] `glob` parameter filters files by pattern (e.g., `"*.js"`)
- [ ] Runs as `executor` user

### US-007: Implement `glob` Tool
**Description:** As a sandbox consumer, I need a `glob` tool that finds files matching a glob pattern and returns file metadata as structured JSON lines.

**Acceptance Criteria:**
- [ ] Tool registered as `glob` with description "Find files by glob pattern"
- [ ] Params: `{pattern: z.string(), path: z.string().optional()}`
- [ ] Default search path: `/workspace`
- [ ] Returns newline-delimited JSON objects: `{"path": "...", "is_dir": bool, "size": N, "mtime": "ISO"}`
- [ ] `_meta.exit_code`: 0 on success
- [ ] Runs as `executor` user

### US-008: Implement `ls` Tool
**Description:** As a sandbox consumer, I need an `ls` tool that lists directory contents as structured JSON lines.

**Acceptance Criteria:**
- [ ] Tool registered as `ls` with description "List directory contents"
- [ ] Params: `{path: z.string()}`
- [ ] Returns newline-delimited JSON objects: `{"path": "...", "is_dir": bool}`
- [ ] `_meta.exit_code`: 0 on success, 1 if path not found
- [ ] Runs as `executor` user

### US-009: Implement `upload_file` Tool
**Description:** As a sandbox consumer, I need an `upload_file` tool that decodes base64-encoded content and writes it as a binary file.

**Acceptance Criteria:**
- [ ] Tool registered as `upload_file` with description "Upload base64 file"
- [ ] Params: `{path: z.string(), content_base64: z.string()}`
- [ ] Decodes base64 content and writes binary file
- [ ] Creates parent directories with `mkdir -p`
- [ ] Returns text: `"Written N bytes to <path>"`
- [ ] `_meta.exit_code`: 0 on success, 1 on error (invalid base64, permission denied, etc.)
- [ ] Runs as `executor` user

### US-010: Implement `download_file` Tool
**Description:** As a sandbox consumer, I need a `download_file` tool that reads a file and returns its content as base64-encoded text.

**Acceptance Criteria:**
- [ ] Tool registered as `download_file` with description "Download file as base64"
- [ ] Params: `{path: z.string()}`
- [ ] Returns base64-encoded file content as text
- [ ] `_meta.exit_code`: 0 on success, 1 if file not found
- [ ] Runs as `executor` user

### US-011: Infrastructure — Sandbox ID, Python3, /workspace
**Description:** As a sandbox operator, I need the container to have a stable sandbox identity, Python3 runtime, and an OpenClaw-structured `/workspace` directory so agents have a consistent, capable execution environment.

**Acceptance Criteria:**
- [ ] `SANDBOX_ID` generated via `crypto.randomUUID()` once at server startup
- [ ] `/health` endpoint returns `{"status": "ok", "sessions": N, "sandbox_id": "<uuid>"}`
- [ ] `python3` is available in the container (Dockerfile installs `python3` if not already present in `debian:bookworm-slim`)
- [ ] `/workspace` directory created and owned by `executor` user
- [ ] OpenClaw layout created on container startup in `entrypoint.sh`:
  - `/workspace/AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `MEMORY.md` (empty template files)
  - `/workspace/memory/`, `/workspace/skills/`, `/workspace/canvas/` (directories)
- [ ] Default `cwd` in all `exec()` calls changed from `/home/executor` to `/workspace`
- [ ] `WORKDIR` in Dockerfile updated to `/workspace`
- [ ] All `/workspace` contents are writable by `executor` user

### US-012: Conformance Test Suite
**Description:** As a developer, I need a conformance test suite that validates the full MCP tool contract so any sandbox passing the suite is guaranteed to be a drop-in DeepAgents backend.

**Acceptance Criteria:**
- [ ] `sandboxes/tests/conformance.sh` created
- [ ] Accepts server URL as first argument: `bash tests/conformance.sh http://localhost:3005`
- [ ] Tests health check returns `status: ok` and `sandbox_id`
- [ ] Tests session initialization returns `Mcp-Session-Id` header
- [ ] Tests `tools/list` returns exactly 9 tools with correct names
- [ ] Tests `execute` tool: success case (exit_code=0), failure case (non-zero exit_code), text-embedded exit_code present
- [ ] Tests `read` tool: success (cat -n format, exit_code=0), file not found (exit_code=1)
- [ ] Tests `write` tool: creates file (exit_code=0), parent dir creation
- [ ] Tests `edit` tool: all 4 exit codes (0=success, 1=not found, 2=multiple matches, 3=file missing)
- [ ] Tests `grep` tool: matches found (exit_code=0, JSON lines), no matches (exit_code=1)
- [ ] Tests `glob` tool: returns JSON lines with metadata
- [ ] Tests `ls` tool: returns JSON lines, path not found (exit_code=1)
- [ ] Tests `upload_file` and `download_file`: binary round-trip preserves content
- [ ] Tests `python3 --version` succeeds via `execute` tool
- [ ] Tests `pwd` returns `/workspace` via `execute` tool
- [ ] Tests OpenClaw layout files exist (`AGENTS.md`, `SOUL.md`, etc.)
- [ ] Tests session reuse: multiple calls on same session succeed
- [ ] Tests session cleanup: `DELETE /mcp` removes session
- [ ] Output format: `PASS: <test_name>` or `FAIL: <test_name> - <reason>`
- [ ] Summary at end: `N/M tests passed`
- [ ] Exit code 0 if all pass, 1 if any fail

## Functional Requirements

### FR-1: `execute` Tool
The `execute` tool replaces `exec_command`. It accepts `{cmd: string, timeout?: number}` and runs the command as the `executor` user with cwd `/workspace`. Timeout defaults to 120s, capped at 120s max. Output includes text-embedded `exit_code: N` for backward compatibility and `_meta.exit_code` as a structured integer.

### FR-2: `read` Tool
Accepts `{path, offset?, limit?}`. Reads the file and returns content in `cat -n` format (right-justified line numbers, tab-separated). Offset is 0-based (default 0), limit defaults to 2000 lines. Returns `_meta.exit_code` 0 on success, 1 if the file does not exist or is unreadable.

### FR-3: `write` Tool
Accepts `{path, content}`. Creates parent directories (`mkdir -p`), writes content (overwrites existing files). Returns `_meta.exit_code` 0 on success, 1 on any error.

### FR-4: `edit` Tool
Accepts `{path, old_string, new_string, replace_all?}`. Reads the file, counts occurrences of `old_string`, and applies exit-code semantics:
- 0: replacement made
- 1: `old_string` not found in file
- 2: `old_string` found multiple times and `replace_all` is false
- 3: file does not exist

When `replace_all` is true, all occurrences are replaced (exit code 0, never 2). Returns occurrence count as text.

### FR-5: `grep` Tool
Accepts `{pattern, path?, glob?}`. Performs fixed-string recursive search (equivalent to `grep -rHnF`). Default path is `/workspace`. Returns newline-delimited JSON objects `{path, line, text}`. `_meta.exit_code` is 0 when matches are found, 1 when no matches.

### FR-6: `glob` Tool
Accepts `{pattern, path?}`. Finds files matching the glob pattern under the specified path (default `/workspace`). Returns newline-delimited JSON objects `{path, is_dir, size, mtime}` where `mtime` is ISO 8601. `_meta.exit_code` is 0 on success.

### FR-7: `ls` Tool
Accepts `{path}`. Lists directory contents. Returns newline-delimited JSON objects `{path, is_dir}`. `_meta.exit_code` is 0 on success, 1 if path does not exist.

### FR-8: `upload_file` Tool
Accepts `{path, content_base64}`. Decodes base64, creates parent directories, writes binary content. Returns `"Written N bytes to <path>"`. `_meta.exit_code` is 0 on success, 1 on error.

### FR-9: `download_file` Tool
Accepts `{path}`. Reads file and returns base64-encoded content as text. `_meta.exit_code` is 0 on success, 1 if file not found.

### FR-10: Structured `_meta` in All Responses
Every tool response includes `_meta: {exit_code: <int>, sandbox_id: "<uuid>"}`. `exit_code` is always an integer. `sandbox_id` is a UUID generated once at server startup and is consistent across all responses for the lifetime of the process.

### FR-11: Sandbox Identity
A `SANDBOX_ID` is generated via `crypto.randomUUID()` at server startup. It appears in the `/health` endpoint response (`{"status": "ok", "sessions": N, "sandbox_id": "<uuid>"}`) and in every tool response `_meta`.

### FR-12: Python3 Availability
The Dockerfile installs `python3` (via `apt-get install -y --no-install-recommends python3`). Agents can execute Python scripts via the `execute` tool.

### FR-13: `/workspace` Default Working Directory
The default cwd changes from `/home/executor` to `/workspace`. The Dockerfile creates `/workspace` and sets ownership to `executor`. The entrypoint creates the OpenClaw layout on startup:
- Files: `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `MEMORY.md`
- Directories: `memory/`, `skills/`, `canvas/`

### FR-14: Tool Registration
All 9 tools are registered via `registerTools()` with descriptive names, descriptions, and Zod schemas. `tools/list` MCP response reflects all 9 tools.

### FR-15: Unprivileged Execution
All tool handlers that interact with the filesystem or execute commands do so as the `executor` user (uid/gid resolved at startup). No tool runs as root.

## Non-Goals (Out of Scope)

- **No backend Python changes.** Phase 4 is entirely contained within the `sandboxes/` submodule. The Python backend (`backend/src/`) is not modified.
- **No frontend changes.** No UI work is required for this phase.
- ~~**No backward-compat alias for `exec_command`.**~~ REVISED: `exec_command` is kept as a backward-compat alias to prevent a breakage window between Phase 4 (tool rename) and Phase 5 (dual-name client support). The alias can be removed in a future cleanup once all consumers use `execute`.
- **No multi-container orchestration.** This phase targets the single `ubuntu` sandbox container.
- **No persistent storage or volume mounts.** `/workspace` is ephemeral within the container lifecycle.
- **No authentication changes.** The existing `x-api-key` header auth middleware is unchanged.
- **No TLS or HTTPS.** The sandbox serves HTTP only; TLS termination is handled upstream.

## Technical Considerations

### Submodule Architecture
The `sandboxes/` directory is a git submodule pointing to the `ruska-ai/sandboxes` repository. All commits for Phase 4 must be made **inside the `sandboxes/` directory**. The orchestra repo references a specific submodule commit; after Phase 4 is complete, the orchestra repo's submodule pointer must be updated.

### Docker Build
The Dockerfile (`sandboxes/ubuntu/Dockerfile`) is based on `debian:bookworm-slim`. Changes include:
- Adding `python3` to the `apt-get install` list
- Creating `/workspace` with proper ownership (`executor:executor`)
- Updating `WORKDIR` from `/home/executor` to `/workspace`

### Entrypoint Script
`entrypoint.sh` must create the OpenClaw workspace layout before starting the Node.js server. Files are created as empty templates. The script must ensure all files/directories under `/workspace` are owned by `executor`.

### Zod Schemas
Each tool's input parameters are validated via Zod schemas passed to `server.tool()`. Optional parameters use `z.<type>().optional()`. This ensures the MCP SDK validates inputs before the handler is called.

### Session Lifecycle
The existing session management (session creation via `StreamableHTTPServerTransport`, session map, `DELETE /mcp` for cleanup) is preserved. Each session gets its own `McpServer` instance with all 9 tools registered. The `SANDBOX_ID` is process-global, not per-session.

### Backward Compatibility for `execute` Text Output
The `execute` tool must keep the text-embedded `exit_code: N` line in its content output. Phase 1 of Feature #890 parses this text to extract exit codes on the Python backend side. The new `_meta.exit_code` is additive and does not replace the text format.

### Tool Handler Pattern
All tool handlers follow a consistent pattern:
```javascript
const SANDBOX_ID = crypto.randomUUID();

function makeResult(text, exitCode) {
  return {
    content: [{ type: "text", text }],
    _meta: { exit_code: exitCode, sandbox_id: SANDBOX_ID },
  };
}
```

Filesystem operations (`read`, `write`, `edit`, `ls`, `glob`, `upload_file`, `download_file`) should use Node.js `fs` APIs (promises or sync) running under the `executor` user's permissions. The `grep` tool can delegate to `child_process.exec` with `grep -rHnF`.

### Conformance Test Suite
`sandboxes/tests/conformance.sh` is a bash script that uses `curl` and `jq` to exercise the MCP Streamable HTTP endpoint. It must:
1. Initialize a session (capture `Mcp-Session-Id` header)
2. Call `tools/list` to verify all 9 tools
3. Invoke each tool with success and error inputs
4. Parse `_meta.exit_code` and `_meta.sandbox_id` from JSON-RPC responses
5. Validate `/health` includes `sandbox_id`
6. Test session reuse and cleanup
7. Report `PASS`/`FAIL` per test with summary

The test script depends on `curl` and `jq`, both of which are already available in the container and standard on development machines.

## Success Metrics

1. **Tool completeness**: `tools/list` returns exactly 9 tools (`execute`, `read`, `write`, `edit`, `grep`, `glob`, `ls`, `upload_file`, `download_file`)
2. **Protocol conformance**: Every tool response includes `_meta.exit_code` (integer) and `_meta.sandbox_id` (UUID)
3. **Exit-code accuracy**: Each tool returns the correct exit code for both success and error cases, especially `edit` with its 4 exit codes (0-3)
4. **Conformance test suite**: `bash tests/conformance.sh http://localhost:3005` reports 24/24 tests passed with exit code 0
5. **Environment readiness**: `python3 --version` succeeds, `pwd` returns `/workspace`, OpenClaw layout files exist
6. **Security**: All operations execute as unprivileged `executor` user; no root escalation paths
7. **No regressions**: The `execute` tool's text-embedded `exit_code: N` output is preserved for Phase 1 consumers

## Open Questions

1. **File size limits**: Should `read`, `download_file`, and `upload_file` enforce maximum file size limits to prevent memory exhaustion? If so, what threshold (e.g., 50 MB)?
2. **Glob implementation**: Should `glob` use Node.js `fs.glob` (Node 22+), a library like `fast-glob`, or shell out to `find`? Node 22 is already installed; `fs.glob` is the simplest approach if stable.
3. **OpenClaw template content**: Should the workspace template files (`AGENTS.md`, `SOUL.md`, etc.) contain default boilerplate content, or should they be created as empty files?
4. **Concurrent write safety**: Should `write` and `edit` tools use file locking to prevent race conditions when multiple sessions operate on the same file, or is last-write-wins acceptable for the sandbox use case?
5. **grep regex support**: The spec calls for fixed-string grep (`grep -F`). Should we also support regex mode via an optional `regex: boolean` parameter, or keep it strictly fixed-string for Phase 4?
