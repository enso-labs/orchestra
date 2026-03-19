# Spec D: MCP Sandbox Backend

## Approach Summary

Determine the best approach to implement a DeepAgents `BaseSandbox` backend that can run `ls`, `grep`, `write_file`, etc. — backed by the `ruska-ai/sandboxes` MCP server infrastructure. The `McpSandboxBackend(BaseSandbox)` class integrates with any `ruska-ai/sandboxes` MCP server (such as the existing `exec_server` on port 3005) as a first-class DeepAgents sandbox backend. This backend implements the full `BaseSandbox` interface by translating `execute()`, `upload_files()`, and `download_files()` calls into MCP JSON-RPC 2.0 tool invocations over Streamable HTTP.

This spec covers changes to **both sides**: the Orchestra backend adapter AND the `ruska-ai/sandboxes` MCP server.

**Architecture:**

```
Orchestra Backend (Python)
+--------------------------------------------+
| resolve_sandbox_backend()                  |
|   Daytona -> MCP -> State                  |
|                                            |
| McpSandboxBackend(BaseSandbox)             |
|   .execute(cmd) -----> MCP JSON-RPC 2.0   |
|   .upload_files()      over HTTP           |
|   .download_files()    to /mcp endpoint    |
+--------------------------------------------+
          |
          | httpx (async HTTP client)
          | JSON-RPC 2.0 / Streamable HTTP
          v
+--------------------------------------------+
| ruska-ai/sandboxes exec_server (:3005)     |
|   Node.js MCP server                       |
|   Streamable HTTP at /mcp                  |
|   Tool: exec_command                       |
|   Auth: x-api-key header                   |
|   Sessions: mcp-session-id header          |
+--------------------------------------------+
```

**Key design decisions:**
- Uses `httpx` (already in Orchestra deps) for HTTP transport
- Lazy session initialization on first `execute()` call
- `BaseSandbox` provides `read()`, `write()`, `edit()`, `grep_raw()`, `glob_info()`, `ls_info()` for free -- all delegate to `execute()` using shell commands
- Only `execute()`, `upload_files()`, `download_files()`, and `id` need implementation
- Registers as `"mcp"` in `_SANDBOX_FACTORIES`
- Updated fallback chain: Daytona -> MCP -> State
- Reuses existing `SHELL_EXEC_SERVER_URL` UserTokenKey (updated default to `/mcp`)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/agents/mcp_sandbox.py` | **CREATE** | `McpSandboxBackend(BaseSandbox)` implementation |
| `backend/src/agents/__init__.py` | MODIFY | Add `"mcp"` factory, update fallback chain |
| `backend/src/constants/__init__.py` | MODIFY | Update `SHELL_EXEC_SERVER_URL` default to `/mcp` |
| `backend/src/schemas/entities/settings.py` | MODIFY | Add `MCP` to `SandboxType` enum |
| `backend/src/controllers/llm.py` | MODIFY | Add MCP error handling to fallback logic |
| `backend/src/utils/stream.py` | MODIFY | Add MCP error handling to stream fallback |
| `frontend/src/lib/services/userSettingsService.ts` | MODIFY | Add `"mcp"` to `SandboxType` union |
| `frontend/src/lib/config/sandbox.ts` | MODIFY | Add MCP option, update normalize function |

---

## 1. NEW FILE: `backend/src/agents/mcp_sandbox.py`

This is the core implementation. `McpSandboxBackend` extends `BaseSandbox` from the `deepagents` package, which means it only needs to implement:
- `execute()` -- the abstract method that all other file operations delegate to
- `upload_files()` -- for uploading files to the sandbox
- `download_files()` -- for downloading files from the sandbox
- `id` property -- unique identifier

All other methods (`read()`, `write()`, `edit()`, `grep_raw()`, `glob_info()`, `ls_info()`) are inherited from `BaseSandbox` and work by constructing shell commands and passing them to `execute()`.

```python
"""MCP Sandbox Backend: Execute commands via an MCP server over Streamable HTTP.

This module provides McpSandboxBackend, a BaseSandbox implementation that
delegates command execution to a remote MCP server (e.g., ruska-ai/sandboxes
exec_server) via JSON-RPC 2.0 over Streamable HTTP.

The MCP server must expose an `exec_command` tool that accepts:
    - cmd (str): The shell command to execute

The backend manages MCP sessions lazily (initialized on first execute call)
and handles the full MCP protocol lifecycle: initialize, tool/call, and
session tracking via mcp-session-id headers.
"""

from __future__ import annotations

import base64
import uuid

import httpx

from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
)
from deepagents.backends.sandbox import BaseSandbox

from src.utils.logger import logger

# Default timeout for MCP HTTP requests (seconds)
_MCP_HTTP_TIMEOUT = 120
# Default timeout for command execution (seconds)
_MCP_EXECUTE_TIMEOUT = 120
# Max output size before truncation (bytes)
_MCP_MAX_OUTPUT_BYTES = 100_000


class McpSandboxError(Exception):
    """Raised when the MCP sandbox backend encounters an unrecoverable error."""


class McpSandboxBackend(BaseSandbox):
    """Sandbox backend that executes commands via an MCP server.

    Connects to any MCP-compatible server (e.g., ruska-ai/sandboxes exec_server)
    over Streamable HTTP transport. The server must expose an ``exec_command``
    tool for shell command execution.

    Session management is lazy: the MCP session is initialized on the first
    ``execute()`` call and reused for subsequent calls. If a session becomes
    invalid, it is automatically re-initialized.

    Args:
        server_url: Base URL of the MCP server's Streamable HTTP endpoint.
            Example: ``"http://localhost:3005/mcp"``
        api_key: Optional API key for authentication via ``x-api-key`` header.
        tool_name: Name of the MCP tool to invoke for command execution.
            Defaults to ``"exec_command"``.
        http_timeout: Timeout in seconds for HTTP requests to the MCP server.
        max_output_bytes: Maximum bytes of command output before truncation.

    Examples:
        >>> backend = McpSandboxBackend("http://localhost:3005/mcp", api_key="secret")
        >>> result = backend.execute("echo hello")
        >>> print(result.output)
        hello
        >>> print(result.exit_code)
        0
    """

    def __init__(
        self,
        server_url: str,
        *,
        api_key: str | None = None,
        tool_name: str = "exec_command",
        http_timeout: int = _MCP_HTTP_TIMEOUT,
        max_output_bytes: int = _MCP_MAX_OUTPUT_BYTES,
    ) -> None:
        self._server_url = server_url.rstrip("/")
        self._api_key = api_key
        self._tool_name = tool_name
        self._http_timeout = http_timeout
        self._max_output_bytes = max_output_bytes

        # Session state (lazy init)
        self._session_id: str | None = None
        self._sandbox_id = f"mcp-{uuid.uuid4().hex[:8]}"
        self._initialized = False

    # ------------------------------------------------------------------
    # SandboxBackendProtocol: id property
    # ------------------------------------------------------------------
    @property
    def id(self) -> str:
        """Unique identifier for this MCP sandbox backend instance."""
        return self._sandbox_id

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------
    def _build_headers(self) -> dict[str, str]:
        """Build HTTP headers for MCP requests."""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self._api_key:
            headers["x-api-key"] = self._api_key
        if self._session_id:
            headers["mcp-session-id"] = self._session_id
        return headers

    def _extract_session_id(self, response: httpx.Response) -> None:
        """Extract and store the MCP session ID from response headers."""
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self._session_id = session_id

    def _jsonrpc_request(self, method: str, params: dict | None = None) -> dict:
        """Build a JSON-RPC 2.0 request payload."""
        request: dict = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
        }
        if params is not None:
            request["params"] = params
        return request

    def _send_request(self, payload: dict) -> dict:
        """Send a JSON-RPC 2.0 request to the MCP server and return the response.

        Handles session tracking and error responses. Raises McpSandboxError
        on transport or protocol failures.
        """
        try:
            with httpx.Client(timeout=self._http_timeout) as client:
                response = client.post(
                    self._server_url,
                    json=payload,
                    headers=self._build_headers(),
                )
                self._extract_session_id(response)

                if response.status_code == 405:
                    # Session expired or invalid -- clear and retry
                    raise McpSandboxError(
                        f"MCP server returned 405 (session invalid). "
                        f"URL: {self._server_url}"
                    )

                response.raise_for_status()
                return response.json()

        except httpx.HTTPStatusError as e:
            raise McpSandboxError(
                f"MCP server HTTP error {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.ConnectError as e:
            raise McpSandboxError(
                f"Cannot connect to MCP server at {self._server_url}: {e}"
            ) from e
        except httpx.TimeoutException as e:
            raise McpSandboxError(
                f"MCP server request timed out after {self._http_timeout}s: {e}"
            ) from e

    # ------------------------------------------------------------------
    # MCP protocol lifecycle
    # ------------------------------------------------------------------
    def _initialize_session(self) -> None:
        """Initialize the MCP session via the `initialize` JSON-RPC method.

        This is called lazily on the first execute() call. The MCP protocol
        requires an initialize handshake before any tool calls. After
        initialize, we send an `initialized` notification.
        """
        if self._initialized:
            return

        # Step 1: Send initialize request
        init_payload = self._jsonrpc_request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {
                    "name": "orchestra-mcp-sandbox",
                    "version": "1.0.0",
                },
            },
        )

        try:
            result = self._send_request(init_payload)
        except McpSandboxError:
            logger.error(
                f"Failed to initialize MCP session at {self._server_url}"
            )
            raise

        if "error" in result:
            raise McpSandboxError(
                f"MCP initialize failed: {result['error']}"
            )

        logger.info(
            f"MCP session initialized: server_url={self._server_url} "
            f"session_id={self._session_id}"
        )

        # Step 2: Send initialized notification (no id = notification)
        notify_payload = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        }
        try:
            # Notifications may not return a response body
            with httpx.Client(timeout=self._http_timeout) as client:
                resp = client.post(
                    self._server_url,
                    json=notify_payload,
                    headers=self._build_headers(),
                )
                self._extract_session_id(resp)
        except Exception as e:
            # Non-fatal: some servers don't require this notification
            logger.warning(f"MCP initialized notification failed (non-fatal): {e}")

        self._initialized = True

    def _call_tool(self, tool_name: str, arguments: dict) -> dict:
        """Call an MCP tool and return the result.

        Ensures the session is initialized before making the call.
        On session expiry (405), re-initializes and retries once.
        """
        self._initialize_session()

        payload = self._jsonrpc_request(
            "tools/call",
            {
                "name": tool_name,
                "arguments": arguments,
            },
        )

        try:
            result = self._send_request(payload)
        except McpSandboxError as e:
            if "405" in str(e):
                # Session expired: re-initialize and retry
                logger.warning("MCP session expired, re-initializing...")
                self._initialized = False
                self._session_id = None
                self._initialize_session()
                result = self._send_request(payload)
            else:
                raise

        if "error" in result:
            raise McpSandboxError(
                f"MCP tool call '{tool_name}' failed: {result['error']}"
            )

        return result.get("result", {})

    # ------------------------------------------------------------------
    # BaseSandbox abstract method: execute()
    # ------------------------------------------------------------------
    def execute(
        self,
        command: str,
        *,
        timeout: int | None = None,
    ) -> ExecuteResponse:
        """Execute a shell command via the MCP server's exec_command tool.

        Sends the command as a JSON-RPC tools/call request to the MCP server.
        The server's exec_command tool runs the command in its sandbox
        environment and returns the output.

        Args:
            command: Shell command string to execute.
            timeout: Maximum execution time in seconds.
                Currently forwarded as a hint; actual enforcement
                depends on the MCP server implementation.

        Returns:
            ExecuteResponse with combined output, exit code, and truncation flag.
        """
        if not command or not isinstance(command, str):
            return ExecuteResponse(
                output="Error: Command must be a non-empty string.",
                exit_code=1,
                truncated=False,
            )

        # exec_server's TOOL_SCHEMA uses "cmd", not "command"
        arguments: dict = {"cmd": command}

        try:
            result = self._call_tool(self._tool_name, arguments)
        except McpSandboxError as e:
            logger.error(f"MCP execute failed: {e}")
            return ExecuteResponse(
                output=f"Error: MCP sandbox execution failed: {e}",
                exit_code=1,
                truncated=False,
            )

        # Parse the MCP tool result
        # MCP tool results have a "content" array with text entries
        content_items = result.get("content", [])
        output_parts = []
        for item in content_items:
            if isinstance(item, dict):
                text = item.get("text", "")
                if text:
                    output_parts.append(text)
            elif isinstance(item, str):
                output_parts.append(item)

        raw_output = "\n".join(output_parts) if output_parts else "<no output>"

        # --- Extract exit_code ---
        # Prefer structured _meta.exit_code if the exec_server provides it
        meta = result.get("_meta", {})
        if "exit_code" in meta:
            exit_code = int(meta["exit_code"])
            output = raw_output
        else:
            # Current exec_server embeds exit_code in the last line of text:
            #   "stdout:\n...\nstderr:\n...\nexit_code: N"
            # Parse it out so BaseSandbox inherited methods get a proper int.
            exit_code = 0
            output = raw_output
            lines = raw_output.rstrip().split("\n")
            for i in range(len(lines) - 1, max(len(lines) - 5, -1), -1):
                line = lines[i].strip()
                if line.startswith("exit_code:"):
                    try:
                        exit_code = int(line.split(":", 1)[1].strip())
                    except (ValueError, IndexError):
                        pass
                    # Remove the exit_code line from output
                    lines.pop(i)
                    output = "\n".join(lines)
                    break

        # Fallback: if isError is set but we didn't find a non-zero exit_code
        is_error = result.get("isError", False)
        if is_error and exit_code == 0:
            exit_code = 1

        # Check for truncation
        truncated = False
        if len(output) > self._max_output_bytes:
            output = output[: self._max_output_bytes]
            output += f"\n\n... Output truncated at {self._max_output_bytes} bytes."
            truncated = True

        return ExecuteResponse(
            output=output,
            exit_code=exit_code,
            truncated=truncated,
        )

    # ------------------------------------------------------------------
    # BaseSandbox abstract method: upload_files()
    # ------------------------------------------------------------------
    def upload_files(
        self, files: list[tuple[str, bytes]]
    ) -> list[FileUploadResponse]:
        """Upload files to the MCP sandbox.

        Tries the MCP ``upload_file`` tool first (if the exec_server exposes
        it). Falls back to base64-encoded shell commands via ``execute()``
        when the dedicated tool is unavailable.

        Args:
            files: List of (path, content_bytes) tuples.

        Returns:
            List of FileUploadResponse, one per input file. Supports partial
            success -- individual file errors are captured in the response.
        """
        responses: list[FileUploadResponse] = []

        for file_path, content_bytes in files:
            try:
                content_b64 = base64.b64encode(content_bytes).decode("ascii")

                # Strategy 1: dedicated MCP upload_file tool
                try:
                    result = self._call_tool(
                        "upload_file",
                        {"path": file_path, "content_base64": content_b64},
                    )
                    is_err = result.get("isError", False)
                    responses.append(
                        FileUploadResponse(
                            path=file_path,
                            error="permission_denied" if is_err else None,
                        )
                    )
                    continue
                except McpSandboxError:
                    # Tool not available — fall through to shell fallback
                    pass

                # Strategy 2: shell fallback via execute()
                cmd = (
                    f"mkdir -p \"$(dirname '{file_path}')\" && "
                    f"echo '{content_b64}' | base64 -d > '{file_path}'"
                )
                exec_result = self.execute(cmd)

                responses.append(
                    FileUploadResponse(
                        path=file_path,
                        error="permission_denied" if exec_result.exit_code != 0 else None,
                    )
                )
            except Exception as e:
                logger.error(f"MCP upload_files error for {file_path}: {e}")
                responses.append(
                    FileUploadResponse(
                        path=file_path,
                        error="permission_denied",
                    )
                )

        return responses

    # ------------------------------------------------------------------
    # BaseSandbox abstract method: download_files()
    # ------------------------------------------------------------------
    def download_files(
        self, paths: list[str]
    ) -> list[FileDownloadResponse]:
        """Download files from the MCP sandbox.

        Tries the MCP ``download_file`` tool first (if the exec_server
        exposes it). Falls back to ``base64 <path>`` via ``execute()``
        when the dedicated tool is unavailable.

        Args:
            paths: List of absolute file paths to download.

        Returns:
            List of FileDownloadResponse, one per input path. Supports partial
            success -- individual file errors are captured in the response.
        """
        responses: list[FileDownloadResponse] = []

        for file_path in paths:
            try:
                # Strategy 1: dedicated MCP download_file tool
                try:
                    result = self._call_tool(
                        "download_file",
                        {"path": file_path},
                    )
                    if result.get("isError", False):
                        responses.append(
                            FileDownloadResponse(
                                path=file_path,
                                content=None,
                                error="file_not_found",
                            )
                        )
                        continue

                    # Extract base64 content from tool result
                    content_items = result.get("content", [])
                    b64_text = ""
                    for item in content_items:
                        if isinstance(item, dict):
                            b64_text += item.get("text", "")
                        elif isinstance(item, str):
                            b64_text += item

                    content = base64.b64decode(b64_text.strip())
                    responses.append(
                        FileDownloadResponse(
                            path=file_path,
                            content=content,
                            error=None,
                        )
                    )
                    continue
                except McpSandboxError:
                    # Tool not available — fall through to shell fallback
                    pass

                # Strategy 2: shell fallback via execute()
                cmd = f"test -f '{file_path}' && base64 '{file_path}' || echo '__FILE_NOT_FOUND__'"
                exec_result = self.execute(cmd)
                output = exec_result.output.strip()

                if output == "__FILE_NOT_FOUND__" or exec_result.exit_code != 0:
                    responses.append(
                        FileDownloadResponse(
                            path=file_path,
                            content=None,
                            error="file_not_found",
                        )
                    )
                else:
                    try:
                        content = base64.b64decode(output)
                        responses.append(
                            FileDownloadResponse(
                                path=file_path,
                                content=content,
                                error=None,
                            )
                        )
                    except Exception:
                        responses.append(
                            FileDownloadResponse(
                                path=file_path,
                                content=None,
                                error="permission_denied",
                            )
                        )
            except Exception as e:
                logger.error(f"MCP download_files error for {file_path}: {e}")
                responses.append(
                    FileDownloadResponse(
                        path=file_path,
                        content=None,
                        error="permission_denied",
                    )
                )

        return responses


def validate_mcp_sandbox(server_url: str, api_key: str | None = None) -> tuple[bool, str | None]:
    """Validate that an MCP server is reachable and supports exec_command.

    Attempts to initialize a session and list available tools. Returns
    (True, None) on success, or (False, reason) on failure.

    This function is used by the sandbox factory to determine whether
    the MCP backend is available before committing to it.
    """
    try:
        backend = McpSandboxBackend(
            server_url,
            api_key=api_key,
            http_timeout=10,  # Short timeout for validation
        )
        backend._initialize_session()

        # Try a simple echo command to verify execution works
        result = backend.execute("echo __mcp_sandbox_probe__")
        if "__mcp_sandbox_probe__" in result.output:
            return True, None
        return False, f"exec_command probe failed: {result.output}"

    except McpSandboxError as e:
        return False, str(e)
    except Exception as e:
        return False, f"Unexpected error: {e}"
```

---

## 2. MODIFY: `backend/src/agents/__init__.py`

### 2a. Add import for MCP sandbox factory

After line 33 (`from src.constants import APP_ENV, DAYTONA_API_KEY`), add the SHELL_EXEC_SERVER_URL import:

```python
from src.constants import APP_ENV, DAYTONA_API_KEY, SHELL_EXEC_SERVER_URL
```

### 2b. Add `_create_mcp_backend_checked` factory function

Insert after `_create_daytona_backend_checked()` (after line 301) and before `_create_state_backend()`:

```python
def _create_mcp_backend_checked(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, None] | None:
    """Try to create an MCP-backed CompositeBackend.

    Returns ``(backend, None)`` on success, or ``None`` if the MCP server
    is unavailable or not reachable. The second element is always None
    because MCP backends don't have a sandbox object to clean up.
    """
    if not SHELL_EXEC_SERVER_URL:
        return None

    try:
        from src.agents.mcp_sandbox import McpSandboxBackend, validate_mcp_sandbox

        supported, reason = validate_mcp_sandbox(SHELL_EXEC_SERVER_URL)
        if not supported:
            logger.info(f"MCP sandbox not available: {reason}")
            return None

        mcp_backend = McpSandboxBackend(SHELL_EXEC_SERVER_URL)
        backend = CompositeBackend(default=mcp_backend, routes={})
        return backend, None
    except Exception as exc:
        logger.error(f"Failed to create MCP sandbox backend: {exc}")
        return None
```

### 2c. Update `_SANDBOX_FACTORIES` dict

Change from:

```python
_SANDBOX_FACTORIES: dict[str, Callable] = {
    "daytona": _create_daytona_backend_checked,
    "state": _create_state_backend,
}
```

To:

```python
_SANDBOX_FACTORIES: dict[str, Callable] = {
    "daytona": _create_daytona_backend_checked,
    "mcp": _create_mcp_backend_checked,
    "state": _create_state_backend,
}
```

### 2d. Update `resolve_sandbox_backend()` fallback chain

Replace the current `resolve_sandbox_backend()` function with:

```python
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
    """Resolve a sandbox backend based on *sandbox_type*.

    Dispatch rules:
    * ``None`` / ``"auto"`` -- try Daytona first, then MCP, fall back to State.
    * ``"state"`` -- use StateBackend directly (never attempts others).
    * ``"daytona"`` -- try Daytona, fall back to MCP then State if unavailable.
    * ``"mcp"`` -- try MCP, fall back to State if unavailable.
    * Any unknown value -- treated as ``"auto"``.

    Returns ``(backend, daytona_sandbox_or_None, effective_type)``
    where effective_type is ``"daytona"``, ``"mcp"``, or ``"state"``.
    """
    effective = sandbox_type if sandbox_type in _SANDBOX_FACTORIES else None

    if effective == "state":
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    if effective == "mcp":
        result = _create_mcp_backend_checked(runtime)
        if result is not None:
            return result[0], result[1], "mcp"
        # Fallback to state
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    # "daytona" or auto (None) -- try Daytona first
    result = _create_daytona_backend_checked(runtime)
    if result is not None:
        return result[0], result[1], "daytona"

    # Try MCP next
    mcp_result = _create_mcp_backend_checked(runtime)
    if mcp_result is not None:
        return mcp_result[0], mcp_result[1], "mcp"

    # Fallback: plain StateBackend (silent, no messages)
    backend, sandbox = _create_state_backend(runtime)
    return backend, sandbox, "state"
```

### 2e. Add `is_mcp_sandbox_error()` helper

Add after the existing `is_daytona_error()` function (after line 53):

```python
def is_mcp_sandbox_error(exc: Exception) -> bool:
    """Check if an exception is an McpSandboxError."""
    try:
        from src.agents.mcp_sandbox import McpSandboxError
        return isinstance(exc, McpSandboxError)
    except ImportError:
        return False
```

---

## 3. MODIFY: `backend/src/constants/__init__.py`

### Update SHELL_EXEC_SERVER_URL default

Change line 112 from:

```python
SHELL_EXEC_SERVER_URL = os.getenv(UserTokenKey.SHELL_EXEC_SERVER_URL.value, "http://localhost:3005/exec")
```

To:

```python
SHELL_EXEC_SERVER_URL = os.getenv(UserTokenKey.SHELL_EXEC_SERVER_URL.value, "http://localhost:3005/mcp")
```

---

## 4. MODIFY: `backend/src/schemas/entities/settings.py`

### Add MCP to SandboxType enum

Change from:

```python
class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    STATE = "state"
```

To:

```python
class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    MCP = "mcp"
    STATE = "state"
```

---

## 5. MODIFY: `backend/src/controllers/llm.py`

### Add MCP error handling to `llm_invoke` fallback logic

Add the `is_mcp_sandbox_error` import at line 14:

```python
from src.agents import (
    construct_agent,
    init_config,
    is_daytona_error,
    is_mcp_sandbox_error,
    prepare_memory_files,
    resolve_sandbox_backend,
    _create_state_backend,
)
```

Then, in the `llm_invoke` exception handler (after the `is_daytona_error` block, around line 196), add MCP fallback handling:

```python
        except Exception as e:
            if is_daytona_error(e):
                if default_sandbox == "daytona":
                    logger.error(f"Daytona sandbox error (daytona mode): {e}")
                    if agent and config:
                        await self._update_store(agent, config)
                    raise
                elif default_sandbox in (None, "auto") and effective_type == "daytona":
                    logger.warning(f"Daytona sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=params.instructions,
                            system_prompt=params.system_prompt,
                            model=params.model,
                            tools=params.tools,
                            subagents=params.subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=self.service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        response = await agent.invoke(
                            params.input,
                            config=config,
                            context=self._init_context(params),
                        )
                        return response
                    except Exception as fallback_err:
                        logger.exception(f"Fallback also failed in llm_invoke: {fallback_err}")
                        if agent and config:
                            await self._update_store(agent, config)
                        raise fallback_err

            elif is_mcp_sandbox_error(e):
                if default_sandbox == "mcp":
                    # Explicit MCP mode: surface the error
                    logger.error(f"MCP sandbox error (mcp mode): {e}")
                    if agent and config:
                        await self._update_store(agent, config)
                    raise
                elif default_sandbox in (None, "auto") and effective_type == "mcp":
                    # Auto mode: fallback to local StateBackend and retry
                    logger.warning(f"MCP sandbox error in auto mode, falling back to state: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=params.instructions,
                            system_prompt=params.system_prompt,
                            model=params.model,
                            tools=params.tools,
                            subagents=params.subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=self.service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        response = await agent.invoke(
                            params.input,
                            config=config,
                            context=self._init_context(params),
                        )
                        return response
                    except Exception as fallback_err:
                        logger.exception(f"MCP fallback also failed in llm_invoke: {fallback_err}")
                        if agent and config:
                            await self._update_store(agent, config)
                        raise fallback_err

            logger.exception(f"Error in llm_invoke: {e}")
            if agent and config:
                await self._update_store(agent, config)
            raise e
```

---

## 6. MODIFY: `backend/src/utils/stream.py`

### Add MCP error handling to stream_generator

Add the `is_mcp_sandbox_error` import at line 18:

```python
from src.agents import (
    construct_agent,
    resolve_sandbox_backend,
    prepare_memory_files,
    is_daytona_error,
    is_mcp_sandbox_error,
    _create_state_backend,
)
```

In the `stream_generator` exception handler (after the `is_daytona_error` block, around line 446), add MCP fallback handling before the final `else`:

```python
            elif is_mcp_sandbox_error(e):
                if sandbox_type == "mcp":
                    logger.error(f"MCP sandbox error (mcp mode): {e}")
                    error_msg = ujson.dumps(("error", f"MCP sandbox error: {e}"))
                    yield f"data: {error_msg}\n\n"
                elif sandbox_type in (None, "auto") and effective_type == "mcp":
                    logger.warning(f"MCP sandbox error in auto mode, falling back to state: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=instructions,
                            system_prompt=system_prompt,
                            model=model,
                            tools=tools,
                            subagents=subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        async for chunk in agent.astream(input, **astream_kwargs):
                            sse_line = _process_and_format_chunk(chunk, agent.model, state)
                            if sse_line:
                                yield sse_line
                    except Exception as fallback_err:
                        logger.exception("MCP fallback also failed in stream_generator: %s", fallback_err)
                        error_msg = ujson.dumps(("error", str(fallback_err)))
                        yield f"data: {error_msg}\n\n"
                else:
                    logger.exception("Error in stream_generator: %s", e)
                    error_msg = ujson.dumps(("error", str(e)))
                    yield f"data: {error_msg}\n\n"
```

The full exception block in `stream_generator` should follow this structure:

```python
        except Exception as e:
            if is_daytona_error(e):
                # ... existing Daytona handling ...
            elif is_mcp_sandbox_error(e):
                # ... new MCP handling (shown above) ...
            else:
                logger.exception("Error in stream_generator: %s", e)
                error_msg = ujson.dumps(("error", str(e)))
                yield f"data: {error_msg}\n\n"
```

---

## 7. MODIFY: `frontend/src/lib/services/userSettingsService.ts`

### Add "mcp" to SandboxType union

Change line 3 from:

```typescript
export type SandboxType = "daytona" | "state";
```

To:

```typescript
export type SandboxType = "daytona" | "mcp" | "state";
```

---

## 8. MODIFY: `frontend/src/lib/config/sandbox.ts`

### Add MCP option to SANDBOX_OPTIONS

Change from:

```typescript
export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
	{
		value: "state",
		label: "State (Default)",
		shortLabel: "State",
		description: "Run agent code with the state sandbox backend.",
	},
	{
		value: "daytona",
		label: "Daytona",
		shortLabel: "Daytona",
		description: "Run agent code in the Daytona sandbox backend.",
	},
] as const;
```

To:

```typescript
export const SANDBOX_OPTIONS: readonly SandboxOption[] = [
	{
		value: "state",
		label: "State (Default)",
		shortLabel: "State",
		description: "Run agent code with the state sandbox backend.",
	},
	{
		value: "mcp",
		label: "MCP Sandbox",
		shortLabel: "MCP",
		description:
			"Run agent code via an MCP exec server (requires SHELL_EXEC_SERVER_URL).",
	},
	{
		value: "daytona",
		label: "Daytona",
		shortLabel: "Daytona",
		description: "Run agent code in the Daytona sandbox backend.",
	},
] as const;
```

### Update normalizeSandboxValue

Change from:

```typescript
export function normalizeSandboxValue(
	value: string | null | undefined,
): SandboxType {
	if (value === "daytona") {
		return value;
	}

	// "auto", null, undefined, and any unknown value all resolve to "state"
	return DEFAULT_SANDBOX;
}
```

To:

```typescript
export function normalizeSandboxValue(
	value: string | null | undefined,
): SandboxType {
	if (value === "daytona" || value === "mcp") {
		return value;
	}

	// "auto", null, undefined, and any unknown value all resolve to "state"
	return DEFAULT_SANDBOX;
}
```

---

## MCP Protocol Interaction Detail

For reference, here is the exact JSON-RPC 2.0 message sequence the `McpSandboxBackend` uses:

### Session initialization (once per backend instance)

**Request:**
```json
{
    "jsonrpc": "2.0",
    "id": "uuid-1",
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-03-26",
        "capabilities": {},
        "clientInfo": {
            "name": "orchestra-mcp-sandbox",
            "version": "1.0.0"
        }
    }
}
```

**Response headers:** `mcp-session-id: <session-id>` (stored for subsequent requests)

**Response body:**
```json
{
    "jsonrpc": "2.0",
    "id": "uuid-1",
    "result": {
        "protocolVersion": "2025-03-26",
        "capabilities": { "tools": {} },
        "serverInfo": { "name": "exec-server", "version": "1.0.0" }
    }
}
```

**Followed by notification:**
```json
{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
}
```

### Command execution (per execute() call)

**Request:**
```json
{
    "jsonrpc": "2.0",
    "id": "uuid-2",
    "method": "tools/call",
    "params": {
        "name": "exec_command",
        "arguments": {
            "cmd": "echo hello && ls -la"
        }
    }
}
```

**Response (current exec_server format — exit_code embedded in text):**
```json
{
    "jsonrpc": "2.0",
    "id": "uuid-2",
    "result": {
        "content": [
            {
                "type": "text",
                "text": "stdout:\nhello\ntotal 42\n...\nstderr:\n\nexit_code: 0"
            }
        ],
        "isError": false
    }
}
```

**Response (proposed structured format — after exec_server update):**
```json
{
    "jsonrpc": "2.0",
    "id": "uuid-2",
    "result": {
        "content": [
            {
                "type": "text",
                "text": "hello\ntotal 42\n..."
            }
        ],
        "isError": false,
        "_meta": {
            "exit_code": 0,
            "truncated": false
        }
    }
}
```

The `McpSandboxBackend` adapter handles **both** formats for backward compatibility: it checks `_meta.exit_code` first, then falls back to parsing the `exit_code: N` line from the text output.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **exec_server changes required before full compatibility** | High | The current exec_server embeds `exit_code` in text output — `BaseSandbox` inherited methods depend on a proper integer `exit_code`. The adapter parses it from text as a stopgap, but the exec_server should return structured `_meta.exit_code` for reliability. |
| MCP server unreachable at runtime | Medium | Validate during factory creation via `validate_mcp_sandbox()`. Fallback chain ensures State backend always available. |
| Session expiry mid-conversation | Low | Auto-retry with session re-initialization on 405 responses. |
| Large command output over HTTP | Low | Truncation at `_MCP_MAX_OUTPUT_BYTES` (100KB), matching `LocalShellBackend` behavior. |
| Network latency on execute() calls | Medium | `BaseSandbox` methods (read, write, edit, grep, glob, ls) all call execute() -- each file operation is an HTTP round-trip. Acceptable for sandbox workloads, but heavier than local. |
| Backward compatibility if exec_server response format changes | Medium | Adapter handles both text-embedded and structured `_meta` formats. Old format parsing is preserved as fallback. |
| SHELL_EXEC_SERVER_URL default change breaks existing /exec users | Low | The `/exec` endpoint is only used by the old `Interpreter` class in `tools/code.py`, which has its own `api_url` parameter. The constant was already unused for that purpose in the sandbox path. |
| MCP auth key exposure | Low | API key is passed in `x-api-key` header (same pattern as existing exec_server auth). Key comes from env var, not stored in code. |
| `upload_files()` via base64+shell has size limits (fallback path) | Medium | Large files (>100KB after base64 expansion) may hit command-line argument limits. Mitigated when exec_server exposes dedicated `upload_file` tool; shell fallback used only when tool is unavailable. |
| Blocking `httpx` calls in sync execute() | Low | `BaseSandbox.aexecute()` (inherited) uses `asyncio.to_thread()` to run sync `execute()` off the event loop. Same pattern as `LocalShellBackend`. |

---

## Estimated Complexity

| Component | Lines of Code | Effort |
|-----------|---------------|--------|
| `mcp_sandbox.py` (new file) | ~350 | Medium -- core implementation |
| `agents/__init__.py` changes | ~50 | Low -- follows existing factory pattern |
| `constants/__init__.py` change | 1 | Trivial |
| `settings.py` change | 1 | Trivial |
| `controllers/llm.py` changes | ~30 | Low -- mirrors Daytona pattern |
| `utils/stream.py` changes | ~25 | Low -- mirrors Daytona pattern |
| `userSettingsService.ts` change | 1 | Trivial |
| `sandbox.ts` changes | ~15 | Low |
| **Total** | **~475** | **3-5 days** |

### Testing plan

1. **Unit tests** (`backend/tests/unit/agents/test_mcp_sandbox.py`):
   - Mock `httpx.Client` to test MCP protocol messages
   - Test session initialization flow
   - Test execute() with success, error, timeout responses
   - Test upload_files() and download_files() via mocked execute()
   - Test session re-initialization on 405
   - Test validate_mcp_sandbox() with reachable/unreachable servers

2. **Integration tests** (requires running exec_server):
   - Test execute() with real commands against exec_server on port 3005
   - Test file upload/download round-trip
   - Test session lifecycle

3. **Factory integration** (`backend/tests/unit/agents/test_sandbox_factories.py`):
   - Test `_create_mcp_backend_checked()` with mocked validation
   - Test `resolve_sandbox_backend()` fallback chain: daytona -> mcp -> state
   - Test explicit `sandbox_type="mcp"` dispatch

4. **Frontend** (manual):
   - Verify MCP option appears in sandbox selector
   - Verify selecting MCP persists to user settings
   - Verify normalizeSandboxValue("mcp") returns "mcp"

---

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHELL_EXEC_SERVER_URL` | `http://localhost:3005/mcp` | URL of the MCP server's Streamable HTTP endpoint |

### Docker Compose (existing)

The `exec_server` service is already defined in `docker-compose.services.yml` under the `tools` profile:

```bash
# Start with exec_server:
COMPOSE_PROFILES=tools docker compose -f docker-compose.services.yml up -d

# Or via the dev environment:
COMPOSE_PROFILES=tools make dev.docker.up
```

### User Settings

Users can select "MCP Sandbox" from the sandbox dropdown in Settings. The backend will:
1. Check if `SHELL_EXEC_SERVER_URL` is configured
2. Validate the MCP server is reachable
3. If validation fails, silently fall back to State backend

---

## Required exec_server Changes (`ruska-ai/sandboxes`)

The current `exec_server` in `ruska-ai/sandboxes/ubuntu/index.js` has compatibility gaps with what `BaseSandbox` requires. These changes should be made in the **sandboxes repo**, not in Orchestra.

### Gap Analysis

| What BaseSandbox needs | exec_server currently provides | Gap |
|---|---|---|
| `ExecuteResponse(output, exit_code: int, truncated: bool)` | Single text blob: `"stdout:\n...\nstderr:\n...\nexit_code: N"` | exit_code embedded in text, not structured |
| `upload_files([(path, bytes)])` → `FileUploadResponse` | Not supported | No file upload tool |
| `download_files([path])` → `FileDownloadResponse` | Not supported | No file download tool |
| `id` property | Not exposed | No sandbox identifier |
| Tool param: `cmd` | Tool param: `cmd` | Match |

**Key insight:** `BaseSandbox`'s inherited methods (`read`, `write`, `edit`, `grep_raw`, `glob_info`, `ls_info`) construct Python heredoc shell commands and pass them to `execute()`. They depend on `exit_code` being a proper integer field — they do **not** parse it from output text. The Orchestra adapter parses `exit_code` from the text response as a stopgap, but the exec_server should return it as structured data for reliability.

### a) Return structured `exit_code`

Change `execCommandHandler` in `ubuntu/index.js` to return `exit_code` as structured metadata, not embedded in text:

```javascript
// Current (text-embedded):
output.push(`exit_code: ${error.code ?? 1}`);

// Proposed (structured JSON content item via _meta):
return {
  content: [
    { type: "text", text: output.join("\n") || "(no output)" }
  ],
  // New: structured metadata for programmatic consumers
  _meta: {
    exit_code: error?.code ?? 0,
    truncated: false
  }
};
```

The text output should contain **only** stdout/stderr, not the `exit_code:` line. The Orchestra adapter handles both formats for backward compatibility during the transition.

### b) Add `upload_file` tool

New MCP tool for writing files to the sandbox:

```javascript
server.tool("upload_file", "Write base64-encoded content to a file",
  { path: z.string(), content_base64: z.string() },
  async ({ path, content_base64 }) => {
    const dir = require("path").dirname(path);
    await fs.promises.mkdir(dir, { recursive: true });
    const buffer = Buffer.from(content_base64, "base64");
    await fs.promises.writeFile(path, buffer);
    return {
      content: [{ type: "text", text: `Written ${buffer.length} bytes to ${path}` }],
      _meta: { exit_code: 0 }
    };
  }
);
```

### c) Add `download_file` tool

New MCP tool for reading files as base64:

```javascript
server.tool("download_file", "Read a file and return as base64",
  { path: z.string() },
  async ({ path }) => {
    const buffer = await fs.promises.readFile(path);
    return {
      content: [{ type: "text", text: buffer.toString("base64") }],
      _meta: { exit_code: 0 }
    };
  }
);
```

### d) Expose sandbox ID

Return a unique identifier for the sandbox instance. This can be included in the `initialize` response's `serverInfo` or as a dedicated MCP resource:

```javascript
// In the initialize handler's serverInfo:
serverInfo: {
  name: "exec-server",
  version: "1.0.0",
  sandbox_id: process.env.SANDBOX_ID || `sandbox-${process.pid}`
}
```

### Migration path

1. **Phase 1 (now):** Orchestra adapter parses text-embedded `exit_code` and uses shell fallbacks for file ops — works with the current exec_server unchanged.
2. **Phase 2:** Update exec_server with structured `_meta`, `upload_file`, and `download_file` tools — Orchestra adapter automatically prefers these when available.
3. **Phase 3:** Remove text-embedded `exit_code` from exec_server output once all consumers are updated.
