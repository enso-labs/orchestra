---
task: McpSandboxBackend v2 Native MCP Tools (Feature #890)
test_command: "cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v"
---

# Task: McpSandboxBackend v2 — Native MCP Tools for Full BaseSandbox (Feature #890)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Upgrade `McpSandboxBackend` to use native MCP tools for ALL BaseSandbox operations, overriding the inherited shell-delegation implementations when the exec_server supports them. This enables direct MCP tool calls for `read`, `write`, `edit`, `grep`, `glob`, `ls`, `upload_file`, and `download_file` instead of routing everything through `execute()`.

**Depends on**: Spec 002 (dispatch wiring) + Spec 004 (exec_server structured tools)

## Architecture

Spec 001 implemented `McpSandboxBackend` with only `execute()` as the core MCP call — all other tools work via inherited shell-delegation through `execute()`. This spec adds **native MCP tool overrides** that call the server's tools directly, with automatic fallback to inherited implementations when the server doesn't have the tools.

### Method Override Table

| BaseSandbox Method | Spec 001 (shell fallback via execute) | Spec 005 (native MCP tool) |
|---|---|---|
| `execute()` | `exec_command` + text-parse exit_code | `execute` + `_meta.exit_code` |
| `read()` | Inherited python3 heredoc via `execute()` | Native `read` MCP tool |
| `write()` | Inherited python3 heredoc via `execute()` | Native `write` MCP tool |
| `edit()` | Inherited python3 heredoc via `execute()` | Native `edit` MCP tool |
| `grep_raw()` | Inherited `grep -rHnF` via `execute()` | Native `grep` MCP tool |
| `glob_info()` | Inherited python3 heredoc via `execute()` | Native `glob` MCP tool |
| `ls_info()` | Inherited python3 scandir via `execute()` | Native `ls` MCP tool |
| `upload_files()` | Shell base64 via `execute()` | Native `upload_file` MCP tool |
| `download_files()` | Shell base64 via `execute()` | Native `download_file` MCP tool |

## Requirements

### Tool Discovery

1. **Discover available tools on session init**:
   - After `initialize`, call `tools/list` JSON-RPC method
   - Cache the set of available tool names (e.g., `{"execute", "read", "write", "edit", "grep", "glob", "ls", "upload_file", "download_file"}`)
   - Store as `self._available_tools: set[str]`
2. **Use native tool when available, fall back to inherited when not**:
   - Check `self._available_tools` before each call
   - If tool is available: call it directly via `_call_tool()`
   - If not available: call `super().method()` (inherited shell-delegation via `execute()`)

### Dual-Mode Exit Code

3. **Prefer `_meta.exit_code`** (structured int from Spec 004 exec_server):
   - When response contains `_meta.exit_code`, use it directly
   - Fall back to text-parsing regex (`r'exit_code:\s*(\d+)'`) for older exec_servers that only have text-embedded exit codes
   - This makes `McpSandboxBackend` work with both old and new exec_servers

### Sandbox ID from _meta

4. **Use `_meta.sandbox_id`** for the `id` property when available:
   - On first tool call, extract `_meta.sandbox_id` from the response
   - Cache it as `self._sandbox_id`
   - `id` property returns `_meta.sandbox_id` if available, otherwise the generated fallback from Spec 001

### Native Tool Overrides

5. **Override `execute(command, *, timeout=None) -> ExecuteResponse`**:
   - Call `execute` MCP tool (renamed from `exec_command` in Spec 004)
   - Also support `exec_command` fallback for old servers (check `_available_tools`)
   - Parse `_meta.exit_code` first, fall back to text regex
   - Return `ExecuteResponse(output=text, exit_code=int)`

6. **Override `read(file_path, offset=0, limit=2000) -> str`**:
   - If `"read"` in `_available_tools`: call `read` MCP tool with `{path, offset, limit}`
   - Parse text content (already in cat -n format from server)
   - Otherwise: fall back to `super().read()` (inherited python3 heredoc via execute)

7. **Override `write(file_path, content) -> WriteResult`**:
   - If `"write"` in `_available_tools`: call `write` MCP tool with `{path, content}`
   - Parse `_meta.exit_code` for success/error
   - Return `WriteResult(error=None, path=file_path)` on success
   - Otherwise: fall back to `super().write()`

8. **Override `edit(file_path, old_string, new_string, replace_all=False) -> EditResult`**:
   - If `"edit"` in `_available_tools`: call `edit` MCP tool with `{path, old_string, new_string, replace_all}`
   - Parse `_meta.exit_code` (0=ok, 1=not found, 2=multiple, 3=file missing)
   - Parse occurrence count from text content
   - Return `EditResult(error=None, path=file_path, occurrences=N)` on success
   - Return `EditResult(error="...", path=file_path)` on error codes 1-3
   - Otherwise: fall back to `super().edit()`

9. **Override `grep_raw(pattern, path, glob_pattern) -> list[GrepMatch]`**:
   - If `"grep"` in `_available_tools`: call `grep` MCP tool with `{pattern, path, glob}`
   - Parse JSON lines response: each line is `{"path": "...", "line": N, "text": "..."}`
   - Return list of `GrepMatch(path=..., line=..., text=...)`
   - Otherwise: fall back to `super().grep_raw()`

10. **Override `glob_info(pattern, path) -> list[FileInfo]`**:
    - If `"glob"` in `_available_tools`: call `glob` MCP tool with `{pattern, path}`
    - Parse JSON lines: `{"path": "...", "is_dir": bool, "size": N, "mtime": "ISO"}`
    - Return list of `FileInfo(path=..., is_dir=..., size=..., mtime=...)`
    - Otherwise: fall back to `super().glob_info()`

11. **Override `ls_info(path) -> list[FileInfo]`**:
    - If `"ls"` in `_available_tools`: call `ls` MCP tool with `{path}`
    - Parse JSON lines: `{"path": "...", "is_dir": bool}`
    - Return list of `FileInfo(path=..., is_dir=...)`
    - Otherwise: fall back to `super().ls_info()`

12. **Override `upload_files(files) -> list[FileUploadResponse]`**:
    - If `"upload_file"` in `_available_tools`: for each `(path, content_bytes)`, call `upload_file` MCP tool with `{path, content_base64: base64.b64encode(content).decode()}`
    - Parse `_meta.exit_code` for success/error
    - Otherwise: fall back to Spec 001's shell-based base64 implementation

13. **Override `download_files(paths) -> list[FileDownloadResponse]`**:
    - If `"download_file"` in `_available_tools`: for each path, call `download_file` MCP tool with `{path}`
    - Decode base64 text content to bytes
    - Parse `_meta.exit_code` for file_not_found errors
    - Otherwise: fall back to Spec 001's shell-based base64 implementation

### Return Type Parity

14. **All native tool overrides must return the exact same types** as the inherited implementations:
    - `ExecuteResponse(output: str, exit_code: int, truncated: bool)`
    - `WriteResult(error: str | None, path: str | None)`
    - `EditResult(error: str | None, path: str | None, occurrences: int | None)`
    - `GrepMatch(path: str, line: int, text: str)`
    - `FileInfo(path: str, is_dir: bool, size: int | None, mtime: str | None)`
    - `FileUploadResponse(path: str, error: str | None)`
    - `FileDownloadResponse(path: str, content: bytes | None, error: str | None)`

### Graceful Degradation

15. **If exec_server only has `execute` (no native tools)**: all inherited methods still work via `execute()` delegation — zero regression from Spec 001 behavior

## Implementation Approach

Update `backend/src/agents/mcp_sandbox.py` to:

1. Add `_available_tools: set[str]` attribute, populated during `_ensure_initialized()`
2. Add helper `_has_tool(name: str) -> bool` that checks the cached set
3. Add response parser `_parse_meta(result: dict) -> tuple[int | None, str | None]` that extracts `exit_code` and `sandbox_id` from `_meta`
4. Add JSON lines parser `_parse_json_lines(text: str) -> list[dict]` for grep/glob/ls responses
5. Override each method with the native-first, fallback-second pattern

### Session Init Update

```python
def _ensure_initialized(self) -> None:
    if self._initialized:
        return
    # ... existing initialize call ...

    # Discover available tools
    tools_response = self._jsonrpc("tools/list", {})
    self._available_tools = {
        tool["name"] for tool in tools_response.get("tools", [])
    }
```

### Override Pattern

```python
def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> str:
    if self._has_tool("read"):
        result = self._call_tool("read", {"path": file_path, "offset": offset, "limit": limit})
        return self._extract_text(result)
    return super().read(file_path, offset, limit)
```

## Success Criteria

1. [ ] `_ensure_initialized()` calls `tools/list` and caches available tool names in `_available_tools`
2. [ ] `execute()` prefers `_meta.exit_code` over text-parsed exit code
3. [ ] `execute()` supports both `execute` (new) and `exec_command` (old) tool names based on `_available_tools`
4. [ ] `id` property uses `_meta.sandbox_id` when available
5. [ ] `read()` override calls native `read` MCP tool when available, returns cat -n formatted text
6. [ ] `write()` override calls native `write` MCP tool when available, returns `WriteResult`
7. [ ] `edit()` override calls native `edit` MCP tool when available, returns `EditResult` with correct exit code semantics (0-3)
8. [ ] `grep_raw()` override calls native `grep` MCP tool when available, parses JSON lines, returns `list[GrepMatch]`
9. [ ] `glob_info()` override calls native `glob` MCP tool when available, parses JSON lines, returns `list[FileInfo]`
10. [ ] `ls_info()` override calls native `ls` MCP tool when available, parses JSON lines, returns `list[FileInfo]`
11. [ ] `upload_files()` override calls native `upload_file` MCP tool when available, returns `list[FileUploadResponse]`
12. [ ] `download_files()` override calls native `download_file` MCP tool when available, returns `list[FileDownloadResponse]`
13. [ ] All overrides fall back to inherited implementations when the tool is not in `_available_tools`
14. [ ] Return type parity: all native overrides return the exact same types as inherited implementations
15. [ ] Graceful degradation: old exec_server (only `exec_command`) still works — all inherited methods function via `execute()`
16. [ ] Unit tests cover: native tool paths, fallback paths, mixed availability, _meta parsing, JSON lines parsing
17. [ ] Code passes `make format` and `make lint`

## Example Output

```python
# With updated exec_server (Spec 004) — uses native tools
sandbox = McpSandboxBackend(base_url="http://localhost:3005")

# execute() — uses _meta.exit_code
result = sandbox.execute("echo hello")
# ExecuteResponse(output="stdout:\nhello\nexit_code: 0", exit_code=0)
# exit_code=0 came from _meta, not text parsing

# read() — native MCP tool
content = sandbox.read("/workspace/AGENTS.md")
# "     1\t# Agent Instructions\n     2\t..."

# write() — native MCP tool
result = sandbox.write("/workspace/test.py", "print('hello')")
# WriteResult(error=None, path="/workspace/test.py")

# edit() — native MCP tool
result = sandbox.edit("/workspace/test.py", "hello", "world")
# EditResult(error=None, path="/workspace/test.py", occurrences=1)

# grep_raw() — native MCP tool
matches = sandbox.grep_raw("world", "/workspace")
# [GrepMatch(path="/workspace/test.py", line=1, text="print('world')")]

# id — from _meta.sandbox_id
print(sandbox.id)  # "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# With OLD exec_server (only exec_command, no _meta) — uses fallback
sandbox_old = McpSandboxBackend(base_url="http://old-server:3005")
result = sandbox_old.execute("echo hello")
# Still works — text-parsed exit_code
content = sandbox_old.read("/tmp/test.txt")
# Still works — inherited python3 heredoc via execute()
```

## QA Validation

### Backend unit tests:
```bash
cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v
```

### Integration validation (requires updated exec_server from Spec 004):
```bash
# 1. Verify structured _meta parsing
cd backend && uv run python -c "
from src.agents.mcp_sandbox import McpSandboxBackend
sb = McpSandboxBackend(base_url='http://localhost:3005')
result = sb.execute('echo structured test')
print(f'exit_code={result.exit_code}, output={result.output[:50]}')
print(f'sandbox_id={sb.id}')
print(f'available_tools={sb._available_tools}')
"
# Expected: exit_code=0, sandbox_id=<uuid>, available_tools includes all 9 tools

# 2. Verify native read
cd backend && uv run python -c "
from src.agents.mcp_sandbox import McpSandboxBackend
sb = McpSandboxBackend(base_url='http://localhost:3005')
content = sb.read('/workspace/AGENTS.md')
print(f'content_preview={content[:100]}')
"

# 3. Verify native upload + download round-trip
cd backend && uv run python -c "
from src.agents.mcp_sandbox import McpSandboxBackend
sb = McpSandboxBackend(base_url='http://localhost:3005')
sb.upload_files([('/tmp/v2-test.txt', b'native upload works')])
files = sb.download_files(['/tmp/v2-test.txt'])
print(f'downloaded={files[0].content.decode()}')
"
# Expected: downloaded=native upload works
```

## Files

| File | Action |
|------|--------|
| `backend/src/agents/mcp_sandbox.py` | MODIFY (add tool discovery, override all methods, dual-mode exit_code) |
| `backend/tests/unit/agents/test_mcp_sandbox.py` | MODIFY (add tests for native tool paths, fallback, _meta parsing) |

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes: `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v`
4. Run format after changes: `cd backend && make format`
5. Commit your changes frequently
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
