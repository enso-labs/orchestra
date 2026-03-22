---
task: McpSandboxBackend Core Class (Feature #890)
test_command: "cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v"
---

# Task: McpSandboxBackend Core Class (Feature #890)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Create `McpSandboxBackend(BaseSandbox)` in `backend/src/agents/mcp_sandbox.py` — a new sandbox backend that connects DeepAgents to the `ruska-ai/sandboxes` exec_server via MCP JSON-RPC 2.0 over Streamable HTTP. This is the foundation for all MCP sandbox functionality.

## Architecture Context

`BaseSandbox` (from `deepagents.backends.sandbox`) defines the sandbox contract. Only 4 methods are abstract — the remaining 6 are inherited and delegate to `execute()` via python3 heredoc commands:

| Method | Abstract? | Implementation Strategy |
|--------|-----------|------------------------|
| `execute(command, *, timeout) -> ExecuteResponse` | **YES** | MCP JSON-RPC `tools/call` to `exec_command` tool |
| `id -> str` | **YES** | Return sandbox URL or generated UUID |
| `upload_files(files) -> list[FileUploadResponse]` | **YES** | Shell base64 encode via `execute()` |
| `download_files(paths) -> list[FileDownloadResponse]` | **YES** | Shell base64 decode via `execute()` |
| `read()`, `write()`, `edit()`, `grep_raw()`, `ls_info()`, `glob_info()` | Inherited | All work automatically via `execute()` delegation |

**Critical**: All inherited methods depend on `execute()` returning a proper `ExecuteResponse` with integer `exit_code`. The python3 heredoc commands use `sys.exit(N)` for error signaling.

**Sync convention**: `BaseSandbox.execute()` is a **synchronous** method. `DaytonaSandbox` uses sync `httpx.Client`. This backend follows the same pattern — all methods are sync, using `httpx.Client` for HTTP. The framework's `aexecute()` wraps sync `execute()` in `asyncio.to_thread()` automatically.

## Requirements

1. **Create `backend/src/agents/mcp_sandbox.py`** with `McpSandboxBackend(BaseSandbox)` class
2. **Implement `execute(command, *, timeout=None) -> ExecuteResponse`**:
   - POST JSON-RPC 2.0 `tools/call` to `{base_url}/mcp` with tool name `exec_command` and `{"cmd": command}`
   - Parse text-embedded `exit_code: N` from the response text via regex (`r'exit_code:\s*(\d+)'`) — first match wins (`re.search` default)
   - If no exit_code found in text, default to `exit_code=0`
   - Forward `timeout` parameter to the httpx request timeout (exec_server enforces 120s max internally)
   - Return `ExecuteResponse(output=<text>, exit_code=<parsed_int>)`
3. **Implement `id` property**:
   - Return a stable identifier for the sandbox (e.g., `f"mcp-sandbox:{base_url}"`)
4. **Implement `upload_files(files) -> list[FileUploadResponse]`**:
   - Each file is a tuple `(path, content_bytes)`
   - Base64-encode content, execute `echo <base64> | base64 -d > <path>` via `execute()`
   - Create parent dirs with `mkdir -p` before writing
   - Return `FileUploadResponse(path=path)` on success, `FileUploadResponse(path=path, error=str)` on failure
   - Handle per-file errors individually (don't abort batch on single failure)
5. **Implement `download_files(paths) -> list[FileDownloadResponse]`**:
   - Execute `base64 <path>` via `execute()` for each file
   - Decode the base64 output to get file content
   - Return `FileDownloadResponse(path=path, content=bytes)` on success
   - Return `FileDownloadResponse(path=path, error="file_not_found")` when exit_code is non-zero
6. **MCP session lifecycle — persistent with reconnect**:
   - Lazy session initialization: first `execute()` call sends `initialize` JSON-RPC request to get `Mcp-Session-Id` header
   - Reuse session across all subsequent calls by including `Mcp-Session-Id` header
   - On session error (e.g., 400 "Invalid or missing session ID"), re-initialize session and retry once before raising
   - Store `httpx.Client` instance for connection pooling
7. **Health check**: Add `def health() -> bool` that GETs `{base_url}/health` endpoint
8. **Use `httpx.Client`** (sync, matching DaytonaSandbox pattern) for all HTTP communication
9. **Create unit tests** in `backend/tests/unit/agents/test_mcp_sandbox.py`

## MCP JSON-RPC 2.0 Protocol Details

### Session initialization:
```json
POST {base_url}/mcp
Content-Type: application/json

{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
  "protocolVersion": "2025-03-26",
  "capabilities": {},
  "clientInfo": {"name": "orchestra", "version": "1.0.0"}
}}

Response headers: Mcp-Session-Id: <uuid>
Response body: {"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": "...", ...}}
```

### Tool call (execute):
```json
POST {base_url}/mcp
Content-Type: application/json
Mcp-Session-Id: <uuid>

{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
  "name": "exec_command",
  "arguments": {"cmd": "echo hello"}
}}

Response body: {"jsonrpc": "2.0", "id": 2, "result": {
  "content": [{"type": "text", "text": "stdout:\nhello\nexit_code: 0"}]
}}
```

### Current exec_server exit_code format (text-embedded):
- Success: text ends with nothing (no exit_code line means 0)
- Failure: text contains `exit_code: N` where N is the exit code integer
- Regex: `r'exit_code:\s*(\d+)'` — first match wins (`re.search` returns first match)

## Class Skeleton

```python
import re
import base64
import httpx
from deepagents.backends.sandbox import BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse

EXIT_CODE_RE = re.compile(r'exit_code:\s*(\d+)')

class McpSandboxBackend(BaseSandbox):
    def __init__(self, *, base_url: str, api_key: str | None = None):
        """
        Args:
            base_url: Exec_server base URL (e.g., "http://localhost:3005").
                      The /mcp endpoint is appended internally.
            api_key: Optional API key for x-api-key header authentication
        """
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._session_id: str | None = None
        self._client = httpx.Client(timeout=httpx.Timeout(120.0))
        self._request_id = 0
        self._initialized = False

    @property
    def id(self) -> str: ...

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse: ...

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]: ...

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]: ...

    def _ensure_initialized(self) -> None:
        """Lazy session init — sends initialize if not yet initialized."""

    def _call_tool(self, tool_name: str, arguments: dict, *, timeout: int | None = None) -> dict:
        """Send tools/call JSON-RPC request. Handles session reconnect on failure."""

    def health(self) -> bool:
        """Check exec_server health via GET {base_url}/health."""

    @property
    def _mcp_url(self) -> str:
        """Return the full MCP endpoint URL: {base_url}/mcp."""
        return f"{self._base_url}/mcp"
```

## Patterns to Follow

- **Daytona backend pattern**: See `backend/src/agents/daytona.py` for validation pattern
- **httpx usage**: See `backend/src/common/client/client.py` for existing httpx patterns in the project
- **Error handling**: Wrap httpx errors in descriptive exceptions. Log with `src.utils.logger.logger`
- **Sync convention**: `BaseSandbox.execute()` is sync. `DaytonaSandbox` uses sync `httpx.Client`. Follow this pattern.

## Success Criteria

1. [ ] `McpSandboxBackend` class exists in `backend/src/agents/mcp_sandbox.py` and extends `BaseSandbox`
2. [ ] `execute()` sends MCP JSON-RPC `tools/call` with `exec_command` tool and parses text-embedded `exit_code: N` via regex
3. [ ] `execute()` returns `ExecuteResponse` with integer `exit_code` (defaults to 0 when not found in text)
4. [ ] `id` property returns a stable sandbox identifier string
5. [ ] `upload_files()` encodes files as base64, executes shell commands via `execute()`, returns `FileUploadResponse` per file with error handling
6. [ ] `download_files()` executes `base64 <path>` via `execute()`, decodes output, returns `FileDownloadResponse` per file with error handling
7. [ ] Session lifecycle: lazy init on first call, reuse across calls, reconnect on session error (retry once)
8. [ ] `health()` method pings `{base_url}/health` endpoint and returns bool
9. [ ] All 6 inherited methods (`read`, `write`, `edit`, `grep_raw`, `ls_info`, `glob_info`) work via `execute()` delegation (no overrides needed — verify in tests)
10. [ ] Unit tests in `backend/tests/unit/agents/test_mcp_sandbox.py` cover: execute success/failure, exit_code parsing, upload/download, session init/reconnect, health check
11. [ ] `timeout` parameter forwarded to httpx request timeout in `execute()`
12. [ ] Code passes `make format` and `make lint`

## Example Output

```python
# Usage
sandbox = McpSandboxBackend(base_url="http://localhost:3005")

# Execute
result = sandbox.execute("echo hello world")
# ExecuteResponse(output="stdout:\nhello world", exit_code=0)

# Execute with failure
result = sandbox.execute("ls /nonexistent")
# ExecuteResponse(output="stderr:\nls: cannot access ...\nexit_code: 2", exit_code=2)

# Upload
responses = sandbox.upload_files([("/tmp/test.txt", b"hello")])
# [FileUploadResponse(path="/tmp/test.txt")]

# Download
responses = sandbox.download_files(["/tmp/test.txt"])
# [FileDownloadResponse(path="/tmp/test.txt", content=b"hello")]

# Health
is_healthy = sandbox.health()
# True

# Inherited methods work automatically:
content = sandbox.read("/tmp/test.txt")  # delegates to execute()
```

## QA Validation

### Backend unit tests:
```bash
cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v
```

### Manual integration validation (requires exec_server at :3005):
```bash
# 1. Verify exec_server health
curl http://localhost:3005/health
# Expected: {"status":"ok","sessions":0}

# 2. Test MCP JSON-RPC initialize
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  -D -
# Expected: 200 OK with Mcp-Session-Id header

# 3. Test execute via tools/call (use session from step 2)
curl -s -X POST http://localhost:3005/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session_id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"exec_command","arguments":{"cmd":"echo hello && echo exit_code: 0"}}}'
# Expected: result.content[0].text contains "hello" and "exit_code: 0"
```

## Files

| File | Action |
|------|--------|
| `backend/src/agents/mcp_sandbox.py` | CREATE |
| `backend/tests/unit/agents/test_mcp_sandbox.py` | CREATE |

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes: `cd backend && uv run pytest tests/unit/agents/test_mcp_sandbox.py -v`
4. Run format after changes: `cd backend && make format`
5. Commit your changes frequently
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
