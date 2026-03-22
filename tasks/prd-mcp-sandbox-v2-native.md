# PRD: McpSandboxBackend v2 — Native MCP Tools (Phase 5 — Feature #890)

## Ralph Story Mapping

> This PRD covers **Ralph US-046 through US-059** (Phase 5 — McpSandboxBackend v2 native MCP tools).

## Introduction

Phase 1 of Feature #890 introduced `McpSandboxBackend(BaseSandbox)` with `execute()` as the sole MCP tool call. All other `BaseSandbox` operations (`read`, `write`, `edit`, `grep_raw`, `glob_info`, `ls_info`, `upload_files`, `download_files`) work via inherited shell-delegation — they construct python3 heredoc commands or shell pipelines and route them through `execute()`. This works but is inefficient: every file read spawns a python3 process, every grep forks a subprocess chain, and error semantics are inferred from shell exit codes embedded in text output.

Phase 5 upgrades `McpSandboxBackend` to call native MCP tools directly for all 9 `BaseSandbox` operations when the exec_server supports them (Phase 4 delivers those tools). When a native tool is available, the override calls it directly via `_call_tool()`. When it is not available (older exec_server), the override falls back to the inherited shell-delegation implementation — zero regression. This native-first, fallback-second pattern ensures `McpSandboxBackend` works seamlessly with both old and new exec_servers.

**Dependencies:** Phase 2 (dispatch wiring into `resolve_sandbox_backend()`) and Phase 4 (exec_server structured MCP tools with `_meta` responses).

**Spec:** `.claude/specs/feat-890-mcp-sandbox/005-mcp-sandbox-v2.md`

## Goals

- Discover available MCP tools during session initialization and cache them for the lifetime of the session
- Override all 9 `BaseSandbox` methods with native MCP tool calls when the exec_server advertises those tools
- Extract structured metadata (`_meta.exit_code`, `_meta.sandbox_id`) from tool responses, with fallback to text-regex parsing for older servers
- Maintain exact return type parity — every native override returns the identical type as its inherited counterpart
- Guarantee graceful degradation: an exec_server with only `exec_command` (no native tools, no `_meta`) must produce identical behavior to Phase 1

## User Stories

### US-001: Tool Discovery on Session Init

**Description:** As the system, I need `McpSandboxBackend` to discover which MCP tools the connected exec_server supports so that each method can decide whether to use a native tool or fall back to the inherited shell delegation.

**Acceptance Criteria:**
- [ ] `_ensure_initialized()` calls `tools/list` JSON-RPC method after the `initialize` handshake
- [ ] Response tools are cached in `self._available_tools: set[str]` (set of tool name strings)
- [ ] Helper `_has_tool(name: str) -> bool` checks the cached set
- [ ] When `tools/list` returns an empty list or fails, `_available_tools` is an empty set (fallback-safe)
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-002: Dual-Mode Exit Code Extraction

**Description:** As the system, I need to extract `exit_code` from MCP tool responses using the structured `_meta.exit_code` field when present, falling back to text-regex parsing (`r'exit_code:\s*(\d+)'`) for older exec_servers that embed the exit code in the text output.

**Acceptance Criteria:**
- [ ] Helper `_parse_meta(result: dict) -> tuple[int | None, str | None]` extracts `exit_code` and `sandbox_id` from `result.get("_meta", {})`
- [ ] When `_meta.exit_code` is present (integer), it is used directly — no text parsing needed
- [ ] When `_meta.exit_code` is absent, the text content is searched with `EXIT_CODE_RE` regex and the last match is used
- [ ] When neither `_meta` nor regex match is found, exit code defaults to `0`
- [ ] Unit tests cover: `_meta` present, `_meta` absent with text fallback, both absent (default 0)
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-003: Sandbox ID from _meta

**Description:** As the system, I need the `McpSandboxBackend.id` property to use `_meta.sandbox_id` from the exec_server when available, falling back to the locally generated identifier from Phase 1.

**Acceptance Criteria:**
- [ ] On the first tool call response that contains `_meta.sandbox_id`, the value is cached in `self._sandbox_id`
- [ ] The `id` property returns `_meta.sandbox_id` if cached, otherwise the Phase 1 fallback value (URL-based or UUID)
- [ ] `_parse_meta()` updates the cached `_sandbox_id` when it encounters a new `sandbox_id` value
- [ ] Unit test: `id` returns fallback before any tool calls, returns `_meta.sandbox_id` after a tool call
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-004: Override execute() — Dual Tool Name Support

**Description:** As the system, I need `execute()` to call the `execute` MCP tool on new exec_servers and fall back to the `exec_command` tool on old exec_servers, using the dual-mode exit code extraction for both.

**Acceptance Criteria:**
- [ ] `execute()` checks `_has_tool("execute")` first; if present, calls `execute` tool with `{"cmd": command}`
- [ ] If `"execute"` is not available, checks `_has_tool("exec_command")` and calls `exec_command` with `{"cmd": command}`
- [ ] If neither is available, raises a clear error (should never happen — at least one must exist)
- [ ] Exit code extracted via `_parse_meta()` (prefers `_meta.exit_code`, falls back to text regex)
- [ ] `timeout` parameter forwarded to the tool call
- [ ] Returns `ExecuteResponse(output=text, exit_code=int, truncated=False)`
- [ ] Unit tests: new server (`execute` tool), old server (`exec_command` tool), `_meta.exit_code` preferred over text regex
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-005: Override read()

**Description:** As the system, I need `read()` to call the native `read` MCP tool when available, returning cat -n formatted text content, with fallback to the inherited python3 heredoc implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("read")` is true: calls `read` MCP tool with `{"path": file_path, "offset": offset, "limit": limit}`
- [ ] Extracts text content from the response (already in cat -n format from the server)
- [ ] When `_has_tool("read")` is false: calls `super().read(file_path, offset, limit)` (inherited shell delegation)
- [ ] Return type is `str` (cat -n formatted text), matching inherited implementation
- [ ] Unit tests: native path returns text, fallback path calls super
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-006: Override write()

**Description:** As the system, I need `write()` to call the native `write` MCP tool when available, returning a `WriteResult`, with fallback to the inherited python3 heredoc implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("write")` is true: calls `write` MCP tool with `{"path": file_path, "content": content}`
- [ ] Parses `_meta.exit_code` — 0 means success, non-zero means error
- [ ] Returns `WriteResult(error=None, path=file_path)` on success
- [ ] Returns `WriteResult(error="<text>", path=file_path)` on error (exit_code != 0)
- [ ] When `_has_tool("write")` is false: calls `super().write(file_path, content)`
- [ ] Return type is `WriteResult`, matching inherited implementation
- [ ] Unit tests: native success, native error, fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-007: Override edit()

**Description:** As the system, I need `edit()` to call the native `edit` MCP tool when available, parsing the 4-level exit code semantics (0=ok, 1=not found, 2=multiple matches, 3=file missing), with fallback to the inherited implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("edit")` is true: calls `edit` MCP tool with `{"path": file_path, "old_string": old_string, "new_string": new_string, "replace_all": replace_all}`
- [ ] Parses `_meta.exit_code` with semantics: 0=success, 1=old_string not found, 2=multiple matches (replace_all=false), 3=file not found
- [ ] On exit_code 0: returns `EditResult(error=None, path=file_path, occurrences=N)` with occurrence count parsed from text content
- [ ] On exit_code 1-3: returns `EditResult(error="<descriptive message>", path=file_path, occurrences=None)`
- [ ] When `_has_tool("edit")` is false: calls `super().edit(file_path, old_string, new_string, replace_all)`
- [ ] Return type is `EditResult`, matching inherited implementation
- [ ] Unit tests: exit codes 0, 1, 2, 3, fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-008: Override grep_raw()

**Description:** As the system, I need `grep_raw()` to call the native `grep` MCP tool when available, parsing JSON lines into `GrepMatch` objects, with fallback to the inherited grep command.

**Acceptance Criteria:**
- [ ] When `_has_tool("grep")` is true: calls `grep` MCP tool with `{"pattern": pattern, "path": path, "glob": glob_pattern}`
- [ ] Parses newline-delimited JSON response: each line is `{"path": "...", "line": N, "text": "..."}`
- [ ] Helper `_parse_json_lines(text: str) -> list[dict]` added for parsing
- [ ] Returns `list[GrepMatch]` with each match converted from the JSON objects
- [ ] When `_meta.exit_code` is 1 (no matches), returns empty list
- [ ] When `_has_tool("grep")` is false: calls `super().grep_raw(pattern, path, glob_pattern)`
- [ ] Return type is `list[GrepMatch]`, matching inherited implementation
- [ ] Unit tests: matches found (multiple JSON lines), no matches (exit_code 1), fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-009: Override glob_info()

**Description:** As the system, I need `glob_info()` to call the native `glob` MCP tool when available, parsing JSON lines into `FileInfo` objects, with fallback to the inherited implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("glob")` is true: calls `glob` MCP tool with `{"pattern": pattern, "path": path}`
- [ ] Parses newline-delimited JSON response: each line is `{"path": "...", "is_dir": bool, "size": N, "mtime": "ISO"}`
- [ ] Returns `list[FileInfo]` with each entry converted from JSON objects
- [ ] When `_has_tool("glob")` is false: calls `super().glob_info(pattern, path)`
- [ ] Return type is `list[FileInfo]`, matching inherited implementation
- [ ] Unit tests: results found, empty results, fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-010: Override ls_info()

**Description:** As the system, I need `ls_info()` to call the native `ls` MCP tool when available, parsing JSON lines into `FileInfo` objects, with fallback to the inherited implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("ls")` is true: calls `ls` MCP tool with `{"path": path}`
- [ ] Parses newline-delimited JSON response: each line is `{"path": "...", "is_dir": bool}`
- [ ] Returns `list[FileInfo]` with `size=None` and `mtime=None` (ls does not provide these)
- [ ] When `_meta.exit_code` is 1 (path not found), returns empty list
- [ ] When `_has_tool("ls")` is false: calls `super().ls_info(path)`
- [ ] Return type is `list[FileInfo]`, matching inherited implementation
- [ ] Unit tests: results found, path not found (exit_code 1), fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-011: Override upload_files()

**Description:** As the system, I need `upload_files()` to call the native `upload_file` MCP tool per file when available, with fallback to the inherited shell-based base64 implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("upload_file")` is true: for each `(path, content_bytes)` tuple, calls `upload_file` MCP tool with `{"path": path, "content_base64": base64.b64encode(content).decode()}`
- [ ] Parses `_meta.exit_code` — 0 means success, non-zero means error
- [ ] Returns `FileUploadResponse(path=path, error=None)` on success per file
- [ ] Returns `FileUploadResponse(path=path, error="<text>")` on error per file
- [ ] Individual file errors do not abort the batch — all files are attempted
- [ ] When `_has_tool("upload_file")` is false: calls `super().upload_files(files)` (inherited base64 shell implementation)
- [ ] Return type is `list[FileUploadResponse]`, matching inherited implementation
- [ ] Unit tests: all succeed, partial failure, fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-012: Override download_files()

**Description:** As the system, I need `download_files()` to call the native `download_file` MCP tool per file when available, with fallback to the inherited shell-based base64 implementation.

**Acceptance Criteria:**
- [ ] When `_has_tool("download_file")` is true: for each path, calls `download_file` MCP tool with `{"path": path}`
- [ ] Decodes base64 text content to bytes on success (`_meta.exit_code` == 0)
- [ ] Returns `FileDownloadResponse(path=path, content=decoded_bytes, error=None)` on success per file
- [ ] Returns `FileDownloadResponse(path=path, content=None, error="file_not_found")` when `_meta.exit_code` == 1
- [ ] Individual file errors do not abort the batch — all files are attempted
- [ ] When `_has_tool("download_file")` is false: calls `super().download_files(paths)` (inherited base64 shell implementation)
- [ ] Return type is `list[FileDownloadResponse]`, matching inherited implementation
- [ ] Unit tests: all succeed, file not found, fallback path
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-013: Graceful Degradation — Old exec_server Compatibility

**Description:** As the system, I need `McpSandboxBackend` to work identically to Phase 1 behavior when connected to an old exec_server that only exposes `exec_command` (no native tools, no `_meta` in responses). This is the critical regression-safety guarantee.

**Acceptance Criteria:**
- [ ] When `tools/list` returns only `exec_command`: `_available_tools` is `{"exec_command"}`
- [ ] `execute()` correctly uses `exec_command` tool with text-regex exit code parsing
- [ ] `read()`, `write()`, `edit()`, `grep_raw()`, `glob_info()`, `ls_info()` all fall back to `super()` (inherited shell delegation through `execute()`)
- [ ] `upload_files()` and `download_files()` fall back to `super()` (inherited base64 shell implementation)
- [ ] `id` property returns the Phase 1 fallback value (no `_meta.sandbox_id` available)
- [ ] No exceptions raised, no behavioral differences from Phase 1
- [ ] Unit test: mock old exec_server (only `exec_command` in tools list), verify all 9 methods produce correct results via fallback
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes
- [ ] `make format` passes

### US-014: Integration Validation — New and Old exec_servers

**Description:** As a developer, I need to verify that `McpSandboxBackend` works correctly against both new (Phase 4) and old (pre-Phase 4) exec_servers, with all tests passing and code clean.

**Acceptance Criteria:**
- [ ] `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes with all new and existing tests green
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes (no regressions in any test suite)
- [ ] Unit tests cover: native tool paths (9 methods), fallback paths (9 methods), mixed availability (some tools native, others fallback), `_meta` parsing (exit_code + sandbox_id), JSON lines parsing (grep, glob, ls), dual tool name for execute (execute vs exec_command)
- [ ] Test count: minimum 25 new test cases covering the matrix of methods x paths x edge cases

## Functional Requirements

- **FR-1:** `_ensure_initialized()` must call `tools/list` after `initialize` and cache the set of available tool names in `self._available_tools: set[str]`
- **FR-2:** Every method override must check `_has_tool(name)` before deciding between native and fallback paths — this is the native-first, fallback-second pattern
- **FR-3:** `_parse_meta(result: dict) -> tuple[int | None, str | None]` must extract `exit_code` (int) and `sandbox_id` (str) from `result.get("_meta", {})` when present, returning `(None, None)` when `_meta` is absent. Both return values are Optional since `_meta` may not exist on older exec_servers.
- **FR-4:** Exit code resolution order: `_meta.exit_code` (structured int) -> text regex match -> default 0
- **FR-5:** `execute()` must support both `execute` (Phase 4 tool name) and `exec_command` (Phase 1 tool name) based on `_available_tools`
- **FR-6:** Native overrides for `read`, `write`, `edit`, `grep_raw`, `glob_info`, `ls_info`, `upload_files`, and `download_files` must call the corresponding MCP tool when available
- **FR-7:** All native overrides must return the exact same types as their inherited counterparts:
  - `execute()` -> `ExecuteResponse(output: str, exit_code: int, truncated: bool)`
  - `read()` -> `str`
  - `write()` -> `WriteResult(error: str | None, path: str | None)`
  - `edit()` -> `EditResult(error: str | None, path: str | None, occurrences: int | None)`
  - `grep_raw()` -> `list[GrepMatch]`
  - `glob_info()` -> `list[FileInfo]`
  - `ls_info()` -> `list[FileInfo]`
  - `upload_files()` -> `list[FileUploadResponse]`
  - `download_files()` -> `list[FileDownloadResponse]`
- **FR-8:** When a tool is not in `_available_tools`, the override must call `super().method()` to use the inherited shell-delegation path through `execute()`
- **FR-9:** The `id` property must return `_meta.sandbox_id` when available, otherwise the Phase 1 fallback value
- **FR-10:** JSON lines parsing (`_parse_json_lines`) must handle empty text, single-line, and multi-line responses gracefully, skipping malformed lines
- **FR-11:** `edit()` exit code semantics: 0=success, 1=old_string not found, 2=multiple matches (replace_all=false), 3=file not found
- **FR-12:** File upload/download operations must handle per-file errors individually without aborting the batch
- **FR-13:** An exec_server exposing only `exec_command` (no native tools, no `_meta`) must produce identical behavior to Phase 1 — zero regression

## Non-Goals (Out of Scope)

- **No exec_server changes** — Phase 4 delivers the server-side tools; this phase only consumes them from the client side
- **No new MCP tools** — we override existing `BaseSandbox` methods to use existing MCP tools, not invent new operations
- **No frontend changes** — this is a backend-only upgrade; the frontend is unaware of native vs. shell-delegation paths
- **No dispatch wiring changes** — Phase 2 already wires `McpSandboxBackend` into `resolve_sandbox_backend()`; this phase modifies only the sandbox class itself
- **No new dependencies** — all imports (`httpx`, `base64`, `json`, `re`) are already available
- **No schema/migration changes** — no database or API schema modifications
- **No changes to `BaseSandbox` or `deepagents`** — we only override methods, never modify the base class

## Technical Considerations

### Dependency Chain

Phase 5 depends on two prior phases:
- **Phase 2 (dispatch wiring):** `McpSandboxBackend` must be registered in `_SANDBOX_FACTORIES` and wired through `resolve_sandbox_backend()` so it can be instantiated during agent execution. Phase 2 delivers this via `_create_mcp_backend_checked()`.
- **Phase 4 (exec_server structured tools):** The exec_server must expose the 9 native MCP tools (`execute`, `read`, `write`, `edit`, `grep`, `glob`, `ls`, `upload_file`, `download_file`) with `_meta` responses. Phase 4 delivers this server-side. However, Phase 5 is designed to work even when Phase 4 is not deployed — graceful degradation ensures old servers still function.

### Return Type Parity

This is non-negotiable. The `CompositeBackend` and agent framework depend on exact return types from `BaseSandbox` methods. Native overrides must construct the exact same Pydantic models or dataclasses that the inherited implementations return. Any type mismatch will cause runtime errors downstream in the agent loop.

### Native-First, Fallback-Second Pattern

Every override follows an identical structure:

```python
async def method(self, *args, **kwargs) -> ReturnType:
    if self._has_tool("tool_name"):
        result = await self._call_tool("tool_name", {args_dict})
        # Parse result and construct ReturnType
        return ReturnType(...)
    return await super().method(*args, **kwargs)
```

This pattern guarantees that:
1. New exec_servers get efficient native tool calls
2. Old exec_servers get inherited shell-delegation (unchanged from Phase 1)
3. Mixed-capability servers (some tools native, others not) work correctly on a per-method basis

### Backwards Compatibility with Old exec_servers

Old exec_servers expose only `exec_command` (no `execute`, no native tools, no `_meta`). The upgrade path is:
- `execute()` falls back from `execute` to `exec_command` tool name
- Exit code falls back from `_meta.exit_code` to text regex
- `id` falls back from `_meta.sandbox_id` to local UUID
- All other methods fall back to `super()` (inherited shell delegation)

No code path raises an exception due to missing tools or `_meta`.

### JSON Lines Parsing

The `grep`, `glob`, and `ls` tools return newline-delimited JSON objects. The parser must:
- Split on newlines
- Skip empty lines
- Parse each line as JSON independently
- Skip malformed lines (log warning, do not raise)
- Return a list of parsed dictionaries

### Files Modified

| File | Action | What Changes |
|------|--------|-------------|
| `backend/src/agents/mcp_sandbox.py` | MODIFY | Add `_available_tools`, `_has_tool()`, `_parse_meta()`, `_parse_json_lines()`, override all 9 methods |
| `backend/tests/unit/agents/test_mcp_sandbox.py` | MODIFY | Add tests for native tool paths, fallback paths, `_meta` parsing, JSON lines parsing, mixed availability, old server compat |

## Success Metrics

- All 9 `BaseSandbox` method overrides implemented with native-first, fallback-second pattern
- Return type parity verified — native overrides return identical types to inherited implementations
- Graceful degradation verified — old exec_server (only `exec_command`) produces Phase 1-identical behavior
- Minimum 25 new unit test cases covering the full method x path x edge-case matrix
- `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v` passes with all tests green
- `make format` passes
- `make lint` passes
- `make test` passes with zero regressions

## Open Questions

- Should `_parse_json_lines()` silently skip malformed lines, or should it collect parsing errors and include them in a warning log? (Recommended: skip with warning log)
- Should tool discovery (`tools/list`) be retried on transient failure, or should a single failure result in an empty `_available_tools` set? (Recommended: single attempt, empty set on failure — safe fallback)
- For `execute()`, if both `execute` and `exec_command` appear in `_available_tools` (unlikely but possible), should `execute` always take priority? (Recommended: yes, prefer `execute` as the canonical name)
- Should `upload_files()` and `download_files()` batch their native tool calls concurrently (e.g., `asyncio.gather`), or execute them sequentially? (Recommended: sequential for simplicity in Phase 5, optimize in a follow-up if needed)
