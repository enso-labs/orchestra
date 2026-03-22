# PRD: McpSandboxBackend Core Class (Phase 1 -- Feature #890)

## Ralph Story Mapping

> This PRD covers **Ralph US-001 through US-014** (Phase 1 — McpSandboxBackend core class and unit tests).

## Introduction

Orchestra currently supports two sandbox backends for DeepAgents: `DaytonaSandbox` (cloud-managed via the Daytona API) and `StateBackend` (in-memory, checkpoint-based). Both are wired through `resolve_sandbox_backend()` in `backend/src/agents/__init__.py`.

This PRD introduces a third option -- `McpSandboxBackend` -- that connects to the `ruska-ai/sandboxes` exec_server via the MCP (Model Context Protocol) JSON-RPC 2.0 over Streamable HTTP. The exec_server already exists (`sandboxes/ubuntu/index.js`), exposes a single `exec_command` tool on `POST /mcp`, and runs in Docker on port 3005. Today, it is only accessible through the `shell_exec` LangChain tool or via the frontend MCP configuration. This backend promotes it to a first-class sandbox that DeepAgents can use for all file operations (read, write, edit, grep, glob, ls) and command execution, just like the Daytona backend.

Phase 1 covers only the `McpSandboxBackend` class and its unit tests. It does NOT wire the backend into agent construction, modify `resolve_sandbox_backend()`, or add any frontend/config changes. Those will be handled in Phase 2.

## Goals

- Create `McpSandboxBackend(BaseSandbox)` in `backend/src/agents/mcp_sandbox.py` that implements all 4 abstract methods required by `BaseSandbox`
- Communicate with the exec_server using MCP JSON-RPC 2.0 over Streamable HTTP (POST to `/mcp` endpoint)
- Manage MCP session lifecycle: lazy initialization, session ID reuse, and automatic reconnection on session expiry
- Parse `exit_code` from the exec_server's text response using regex, since the MCP tool returns exit codes embedded in response text (not as structured fields)
- Implement `upload_files()` and `download_files()` by encoding/decoding file content as base64 and piping through `execute()` shell commands
- Provide a `health()` async method for checking exec_server availability
- Achieve full unit test coverage with mocked HTTP calls -- no live exec_server required for tests
- Follow existing codebase patterns: `httpx.Client` (sync) for HTTP, `src.utils.logger.logger` for logging, and the `DaytonaSandbox` class as the reference implementation

## User Stories

### US-001: McpSandboxBackend Class Skeleton and Constructor

**Description:** As a developer, I need the `McpSandboxBackend` class created with a constructor that accepts the exec_server base URL and optional API key, storing them as instance attributes alongside an `httpx.Client` (sync) and session state.

**Acceptance Criteria:**
- [ ] File `backend/src/agents/mcp_sandbox.py` is created
- [ ] Class `McpSandboxBackend` extends `BaseSandbox` (imported from `deepagents.backends.sandbox`)
- [ ] Constructor signature: `__init__(self, *, base_url: str, api_key: str | None = None)`
- [ ] `base_url` is stored and has its trailing slash stripped (e.g., `http://localhost:3005/` becomes `http://localhost:3005`)
- [ ] An `httpx.Client` (sync, matching DaytonaSandbox pattern) is created and stored as `self._client` with a default timeout of 120 seconds
- [ ] `api_key` is stored as `self._api_key` for use in the `x-api-key` header
- [ ] Session state attributes initialized: `self._session_id: str | None = None` and `self._request_id: int = 0`
- [ ] `self._initialized: bool = False` flag to track whether the MCP `initialize` handshake has been completed
- [ ] `from src.utils.logger import logger` is used for all logging
- [ ] `make format` passes with no errors on the new file

### US-002: MCP Session Initialization (initialize handshake)

**Description:** As a developer, I need a private method `_ensure_initialized()` that performs the MCP `initialize` handshake if it has not been done yet, obtaining and storing the `Mcp-Session-Id` for subsequent requests.

**Acceptance Criteria:**
- [ ] Private sync method `_ensure_initialized(self) -> None` is implemented
- [ ] If `self._initialized` is `True`, the method returns immediately (no-op)
- [ ] Sends a POST to `{base_url}/mcp` with JSON body:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": {"name": "orchestra", "version": "1.0.0"}
    }
  }
  ```
- [ ] Request includes headers: `Content-Type: application/json`, `Accept: application/json, text/event-stream`
- [ ] If `self._api_key` is set, includes `x-api-key: {api_key}` header
- [ ] On success (HTTP 200), extracts `Mcp-Session-Id` from response headers and stores it in `self._session_id`
- [ ] Sets `self._initialized = True` and `self._request_id = 1` (since ID 1 was used for init)
- [ ] After initialization, sends the `notifications/initialized` notification (no `id` field, not a request) to the same endpoint with the `Mcp-Session-Id` header
- [ ] On HTTP error, raises `McpSandboxError` (a custom exception class defined in the same file) with a descriptive message
- [ ] Logs the session ID at debug level on success, logs errors at error level on failure

### US-003: MCP Tool Call (execute method)

**Description:** As a developer, I need the `execute()` method to send shell commands to the exec_server via the MCP `tools/call` JSON-RPC method and parse the response into an `ExecuteResponse`.

**Acceptance Criteria:**
- [ ] `execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse` is implemented
- [ ] Calls `_ensure_initialized()` before sending the tool call
- [ ] Increments `self._request_id` and uses it as the JSON-RPC `id`
- [ ] Sends POST to `{base_url}/mcp` with JSON body:
  ```json
  {
    "jsonrpc": "2.0",
    "id": <request_id>,
    "method": "tools/call",
    "params": {
      "name": "exec_command",
      "arguments": {"cmd": "<command>"}
    }
  }
  ```
- [ ] Includes `Mcp-Session-Id: {session_id}` header on the request
- [ ] If `self._api_key` is set, includes `x-api-key: {api_key}` header
- [ ] Extracts the text content from `response["result"]["content"][0]["text"]`
- [ ] Parses exit code using regex `r'exit_code:\s*(\d+)'` on the response text; defaults to `0` if the pattern is not found (the exec_server only appends `exit_code: N` when there is an error, so absence means success)
- [ ] Returns `ExecuteResponse(output=text, exit_code=parsed_code, truncated=False)`
- [ ] If the HTTP request fails with a session-related error (HTTP 400 with "Invalid or missing session ID", or connection error), resets session state (`self._initialized = False`, `self._session_id = None`) and retries once by calling `_ensure_initialized()` and re-sending the tool call
- [ ] If the retry also fails, raises `McpSandboxError`
- [ ] If `timeout` is provided, passes it to `httpx` as the request timeout (in seconds)
- [ ] Logs the command at debug level, errors at error level

### US-004: Sandbox ID Property

**Description:** As a developer, I need the `id` property to return a stable, descriptive identifier for this backend instance.

**Acceptance Criteria:**
- [ ] `@property` method `id(self) -> str` is implemented
- [ ] Returns `f"mcp-sandbox:{self._base_url}"` (e.g., `"mcp-sandbox:http://localhost:3005"`)
- [ ] Does not trigger network calls or session initialization

### US-005: Upload Files via execute()

**Description:** As a developer, I need `upload_files()` to write files to the exec_server filesystem by base64-encoding file content and piping it through shell commands via `execute()`.

**Acceptance Criteria:**
- [ ] `upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]` is implemented
- [ ] For each `(path, content)` tuple in the input list:
  - Base64-encodes the `content` bytes
  - Constructs a shell command: `mkdir -p "$(dirname '{path}')" && echo '{b64_content}' | base64 -d > '{path}'`
  - Calls `self.execute(cmd)` to run the command
  - If `execute()` returns `exit_code == 0`, appends `FileUploadResponse(path=path, error=None)`
  - If `execute()` returns non-zero exit code, appends `FileUploadResponse(path=path, error="permission_denied")` (best-effort error mapping)
  - If `execute()` raises an exception, catches it and appends `FileUploadResponse(path=path, error="permission_denied")` with the error logged
- [ ] Returns a list with one `FileUploadResponse` per input file, in the same order
- [ ] Partial success is supported -- one file failing does not prevent others from being uploaded
- [ ] Paths that do not start with `/` get `FileUploadResponse(path=path, error="invalid_path")` without calling execute

### US-006: Download Files via execute()

**Description:** As a developer, I need `download_files()` to read files from the exec_server filesystem by base64-encoding their content through shell commands via `execute()`.

**Acceptance Criteria:**
- [ ] `download_files(self, paths: list[str]) -> list[FileDownloadResponse]` is implemented
- [ ] For each path in the input list:
  - Constructs a shell command: `base64 '{path}'`
  - Calls `self.execute(cmd)` to run the command
  - If `execute()` returns `exit_code == 0`, base64-decodes the output and appends `FileDownloadResponse(path=path, content=decoded_bytes, error=None)`
  - If `execute()` returns non-zero exit code, appends `FileDownloadResponse(path=path, content=None, error="file_not_found")` (best-effort error mapping)
  - If `execute()` raises an exception, catches it and appends `FileDownloadResponse(path=path, content=None, error="file_not_found")` with the error logged
- [ ] Returns a list with one `FileDownloadResponse` per input path, in the same order
- [ ] Partial success is supported -- one file failing does not prevent others from being downloaded
- [ ] Paths that do not start with `/` get `FileDownloadResponse(path=path, content=None, error="invalid_path")` without calling execute
- [ ] Strips trailing whitespace from the base64 output before decoding (the exec_server may include trailing newlines in stdout)

### US-007: Health Check

**Description:** As a developer, I need an async `health()` method that checks whether the exec_server is reachable and responding.

**Acceptance Criteria:**
- [ ] `def health(self) -> bool` is implemented
- [ ] Sends GET to `{base_url}/health`
- [ ] If `self._api_key` is set, includes `x-api-key: {api_key}` header
- [ ] Returns `True` if the response is HTTP 200 and the JSON body contains `"status": "ok"`
- [ ] Returns `False` on any exception (`httpx.HTTPError`, `httpx.TimeoutException`, `KeyError`, etc.)
- [ ] Uses a short timeout (5 seconds) separate from the default client timeout
- [ ] Does not modify session state

### US-008: Custom Exception Class

**Description:** As a developer, I need a custom `McpSandboxError` exception for MCP-specific failures, separate from generic HTTP errors.

**Acceptance Criteria:**
- [ ] `class McpSandboxError(Exception)` is defined in `backend/src/agents/mcp_sandbox.py`
- [ ] Accepts a `message: str` parameter
- [ ] Used by `_ensure_initialized()` and `execute()` when MCP communication fails after retries

### US-009: Client Cleanup

**Description:** As a developer, I need a way to cleanly close the HTTP client and MCP session when the backend is no longer needed.

**Acceptance Criteria:**
- [ ] `def close(self) -> None` is implemented
- [ ] If `self._session_id` is set, sends a DELETE to `{base_url}/mcp` with the `Mcp-Session-Id` header to cleanly terminate the MCP session (best-effort, exceptions are caught and logged)
- [ ] Calls `await self._client.aclose()` to release HTTP connections
- [ ] Resets `self._session_id = None`, `self._initialized = False`
- [ ] Safe to call multiple times (idempotent)
- [ ] Implements `__aenter__` and `__aexit__` for use as an async context manager (`async with McpSandboxBackend(...) as backend:`)

### US-010: Unit Tests -- Constructor and ID

**Description:** As a developer, I need unit tests verifying the constructor stores arguments correctly and the `id` property returns the expected format.

**Acceptance Criteria:**
- [ ] File `backend/tests/unit/agents/test_mcp_sandbox.py` is created
- [ ] Test: constructor stores `base_url` with trailing slash stripped
- [ ] Test: constructor stores `api_key` as `None` when not provided
- [ ] Test: constructor stores `api_key` when provided
- [ ] Test: `id` property returns `"mcp-sandbox:http://localhost:3005"` for base_url `"http://localhost:3005"`
- [ ] Test: initial state has `_initialized == False` and `_session_id is None`
- [ ] `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v` passes

### US-011: Unit Tests -- MCP Initialize Handshake

**Description:** As a developer, I need unit tests verifying the `_ensure_initialized()` method performs the correct HTTP calls and stores the session ID.

**Acceptance Criteria:**
- [ ] Test: `_ensure_initialized()` sends correct JSON-RPC initialize payload to `{base_url}/mcp`
- [ ] Test: `_ensure_initialized()` extracts and stores `Mcp-Session-Id` from response headers
- [ ] Test: `_ensure_initialized()` sets `_initialized = True` after success
- [ ] Test: calling `_ensure_initialized()` a second time is a no-op (does not send another HTTP request)
- [ ] Test: `_ensure_initialized()` sends `notifications/initialized` after successful init
- [ ] Test: `_ensure_initialized()` raises `McpSandboxError` on HTTP error
- [ ] Test: `_ensure_initialized()` includes `x-api-key` header when `api_key` is set
- [ ] All HTTP calls are mocked using `unittest.mock.MagicMock` patching `httpx.Client.post` (sync client)
- [ ] `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v` passes

### US-012: Unit Tests -- Execute Method

**Description:** As a developer, I need unit tests verifying `execute()` sends correct tool call payloads, parses exit codes from response text, and handles session reconnection.

**Acceptance Criteria:**
- [ ] Test: `execute("echo hello")` sends correct `tools/call` JSON-RPC payload with `exec_command` tool name
- [ ] Test: `execute()` includes `Mcp-Session-Id` header in the request
- [ ] Test: exit code is parsed from response text containing `"exit_code: 1"` -> `ExecuteResponse.exit_code == 1`
- [ ] Test: exit code defaults to `0` when response text does not contain `exit_code` pattern (success case)
- [ ] Test: `execute()` returns `ExecuteResponse` with correct `output` field from response text content
- [ ] Test: when exec_server returns HTTP 400 with session error, `execute()` resets session and retries once
- [ ] Test: when retry also fails, `execute()` raises `McpSandboxError`
- [ ] Test: `execute()` passes `timeout` to httpx when provided
- [ ] All HTTP calls are mocked
- [ ] `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v` passes

### US-013: Unit Tests -- Upload and Download Files

**Description:** As a developer, I need unit tests verifying `upload_files()` and `download_files()` correctly encode/decode content and handle errors per-file.

**Acceptance Criteria:**
- [ ] Test: `upload_files()` calls `execute()` with the correct base64-encoding shell command for each file
- [ ] Test: `upload_files()` returns `FileUploadResponse(error=None)` on success (exit_code 0)
- [ ] Test: `upload_files()` returns `FileUploadResponse(error="permission_denied")` when execute returns non-zero
- [ ] Test: `upload_files()` returns `FileUploadResponse(error="invalid_path")` for paths not starting with `/`
- [ ] Test: `upload_files()` handles partial success (first file succeeds, second fails)
- [ ] Test: `download_files()` calls `execute()` with `base64 '/path'` command
- [ ] Test: `download_files()` base64-decodes the output and returns correct `content` bytes
- [ ] Test: `download_files()` returns `FileDownloadResponse(error="file_not_found")` when execute returns non-zero
- [ ] Test: `download_files()` returns `FileDownloadResponse(error="invalid_path")` for paths not starting with `/`
- [ ] Test: `download_files()` strips trailing whitespace before decoding
- [ ] `execute()` is mocked (these tests should not make real HTTP calls)
- [ ] `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v` passes

### US-014: Unit Tests -- Health Check and Cleanup

**Description:** As a developer, I need unit tests verifying the `health()` method and `close()` cleanup behavior.

**Acceptance Criteria:**
- [ ] Test: `health()` returns `True` when GET `/health` returns `{"status": "ok"}`
- [ ] Test: `health()` returns `False` when the server is unreachable (connection error)
- [ ] Test: `health()` returns `False` when the response JSON does not contain `"status": "ok"`
- [ ] Test: `health()` uses a 5-second timeout
- [ ] Test: `close()` sends DELETE to `/mcp` with session ID header when session is active
- [ ] Test: `close()` calls `_client.aclose()`
- [ ] Test: `close()` resets `_session_id` and `_initialized`
- [ ] Test: `close()` is safe to call when no session exists (no DELETE sent, no error)
- [ ] Test: async context manager (`__aenter__` / `__aexit__`) calls `close()` on exit
- [ ] All HTTP calls are mocked
- [ ] `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v` passes

## Functional Requirements

- FR-1: `McpSandboxBackend` MUST extend `BaseSandbox` from `deepagents.backends.sandbox`, inheriting the 6 file operation methods (`read`, `write`, `edit`, `grep_raw`, `ls_info`, `glob_info`) that delegate to `execute()`.
- FR-2: `execute()` MUST send JSON-RPC 2.0 `tools/call` requests to the exec_server's `/mcp` endpoint with the `exec_command` tool name and the command as the `cmd` argument.
- FR-3: `execute()` MUST parse the exit code from the response text using the regex `r'exit_code:\s*(\d+)'`. If the pattern is not found, exit code MUST default to `0`.
- FR-4: The MCP session MUST be lazily initialized on the first call to `execute()`. The `Mcp-Session-Id` header from the `initialize` response MUST be stored and reused for all subsequent requests.
- FR-5: If a tool call fails due to an invalid/expired session (HTTP 400), `execute()` MUST reset session state and retry the full sequence (initialize + tool call) exactly once before raising an error.
- FR-6: `upload_files()` MUST base64-encode file content and write it via shell commands through `execute()`. Each file MUST be handled independently so that one failure does not block others.
- FR-7: `download_files()` MUST read file content via `base64 <path>` shell commands through `execute()` and base64-decode the output. Each file MUST be handled independently.
- FR-8: `health()` MUST send GET to `/health` and return `True` only when the response contains `{"status": "ok"}`.
- FR-9: `close()` MUST send DELETE to `/mcp` with the session ID (best-effort) and close the `httpx.Client`.
- FR-10: All HTTP requests MUST include the `x-api-key` header when an API key is configured.
- FR-11: The `id` property MUST return `"mcp-sandbox:{base_url}"` without triggering any network calls.
- FR-12: All logging MUST use `src.utils.logger.logger` (loguru-based), consistent with the rest of the backend.
- FR-13: A custom `McpSandboxError(Exception)` MUST be defined for MCP-specific failures and used instead of raw `httpx` exceptions in public methods.

## Non-Goals (Out of Scope)

- **No wiring into `resolve_sandbox_backend()`** -- Phase 2 will add `"mcp"` as a sandbox type option and modify the dispatch logic in `backend/src/agents/__init__.py`.
- **No constants or environment variable additions** -- The `SHELL_EXEC_SERVER_URL` constant already exists. Phase 2 will decide whether to reuse it or create a new one.
- **No `SandboxType` enum changes** -- Adding `MCP = "mcp"` to `backend/src/schemas/entities/settings.py` is Phase 2.
- **No frontend changes** -- The sandbox type selector in the UI is a Phase 2 concern.
- **No integration tests against a live exec_server** -- Phase 1 uses only mocked HTTP calls.
- **No SSE/streaming support** -- The exec_server supports Streamable HTTP but the current `tools/call` responses are simple JSON. Streaming will be evaluated in a future phase if needed.
- **No persistent session management across agent invocations** -- Each `McpSandboxBackend` instance manages its own session. Cross-request session pooling is out of scope.

## Technical Considerations

- **BaseSandbox contract**: `BaseSandbox` (in `deepagents.backends.sandbox`) requires exactly 4 abstract methods: `execute()`, `id` (property), `upload_files()`, `download_files()`. The other 6 methods (`read`, `write`, `edit`, `grep_raw`, `ls_info`, `glob_info`) are inherited and delegate to `execute()` via shell command templates. This means the only HTTP communication needed is through `execute()` -- all file operations are automatically handled.
- **Sync HTTP client (RESOLVED)**: `BaseSandbox.execute()` is a synchronous method. `DaytonaSandbox` uses sync `httpx.Client`. **McpSandboxBackend must also use `httpx.Client` (sync) for consistency.** All public methods (`execute()`, `upload_files()`, `download_files()`, `health()`, `close()`) and private methods (`_ensure_initialized()`, `_call_tool()`) must be sync `def`, not `async def`. The framework's `aexecute()` wraps sync `execute()` in `asyncio.to_thread()` automatically.
- **Exit code parsing**: The exec_server (`sandboxes/ubuntu/index.js` line 57) only appends `exit_code: N` when there is an error (`if (error) output.push(...)`). Successful commands have no exit code in the output. The regex must handle both cases: extract the code when present, default to 0 when absent.
- **MCP session lifecycle**: The exec_server creates a new `StreamableHTTPServerTransport` per session. Sessions are identified by the `Mcp-Session-Id` header. If the server restarts or the session expires, the client gets HTTP 400. The reconnection logic (reset + retry once) handles this transparently.
- **Auth middleware**: The exec_server checks `x-api-key` header against the `API_KEY` env var. If the env var is not set on the server, auth is disabled. The backend must support both authenticated and unauthenticated modes.
- **Reference implementations**: `DaytonaSandbox` at `/home/ryaneggz/ruska-ai/orchestra/backend/.venv/lib/python3.12/site-packages/langchain_daytona/sandbox.py` is the closest reference -- same base class, similar method signatures. The `A2AClient` at `backend/src/common/client/client.py` shows the httpx patterns used in this codebase.
- **File paths**: The exec_server runs commands as user `executor` with home directory `/home/executor`. Commands involving absolute paths will work as expected. The `upload_files()` and `download_files()` implementations should use shell quoting (e.g., `shlex.quote()`) on file paths to prevent injection.

## Success Metrics

- `McpSandboxBackend` passes `isinstance(backend, BaseSandbox)` check -- confirming it correctly extends the base class
- `execute("echo hello")` returns `ExecuteResponse(output="stdout:\nhello\n", exit_code=0)` when tested against a mocked exec_server response
- Exit code parsing: `"exit_code: 1"` in response text produces `exit_code=1`; absence of pattern produces `exit_code=0`
- Session reconnection: a simulated session expiry (HTTP 400) triggers exactly one retry, and the second attempt succeeds
- `upload_files([("/test.txt", b"hello")])` produces a shell command containing base64-encoded content and returns `FileUploadResponse(error=None)` on success
- `download_files(["/test.txt"])` decodes base64 output and returns `FileDownloadResponse(content=b"hello")` on success
- `health()` returns `True` for a healthy server and `False` for an unreachable one
- All unit tests pass: `uv run pytest backend/tests/unit/agents/test_mcp_sandbox.py -v`
- Full test suite unaffected: `make test` passes with no regressions
- Lint passes: `make format` and `make lint` produce no errors

## Open Questions

1. **~~Sync or async `execute()`?~~** RESOLVED: Use sync `httpx.Client` to match `DaytonaSandbox` pattern. `BaseSandbox.execute()` is sync; the framework wraps it in `asyncio.to_thread()` automatically via `aexecute()`.
2. **Should `close()` be called automatically?** Phase 2 will wire this into `resolve_sandbox_backend()`. Should the cleanup happen in a `finally` block (like Daytona's `sandbox.stop()`) or should we rely on the async context manager pattern?
3. **Should the default timeout (120s) match the exec_server's timeout (120s)?** The exec_server's `exec()` call has a 120-second timeout. The httpx client timeout should be >= this to avoid premature client-side timeouts while the server is still processing.
4. **Base64 encoding for large files in `upload_files()`**: The current approach pipes base64-encoded content through a shell command. For very large files, this could hit shell argument limits. The `BaseSandbox.write()` method already handles this via heredoc templates -- should `upload_files()` use a similar heredoc approach, or is the base64 pipe sufficient for expected file sizes?
5. **~~Should the backend accept `base_url` only, or a full URL with `/mcp` path?~~** RESOLVED: Accept `base_url` only (e.g., `http://localhost:3005`), append `/mcp` internally. This matches the exec_server structure where `/health` and `/mcp` are sibling routes.
