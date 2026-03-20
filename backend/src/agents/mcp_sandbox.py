"""MCP Sandbox backend — communicates with exec_server via MCP JSON-RPC 2.0."""

from __future__ import annotations

import base64
import re

import httpx
from deepagents.backends.sandbox import BaseSandbox
from deepagents.backends.protocol import ExecuteResponse, FileUploadResponse, FileDownloadResponse

from src.utils.logger import logger


class McpSandboxError(Exception):
    """Raised when MCP sandbox communication fails after retries."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class McpSandboxBackend(BaseSandbox):
    """Sandbox backend that delegates execution to an exec_server via MCP protocol."""

    def __init__(self, *, base_url: str, api_key: str | None = None) -> None:
        self._base_url: str = base_url.rstrip("/")
        self._api_key: str | None = api_key
        self._client: httpx.Client = httpx.Client(timeout=httpx.Timeout(120.0))
        self._session_id: str | None = None
        self._request_id: int = 0
        self._initialized: bool = False
        logger.debug(f"McpSandboxBackend created for {self._base_url}")

    # -- Private helpers --

    def _build_headers(self, *, include_session: bool = False) -> dict[str, str]:
        """Build common request headers."""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._api_key:
            headers["x-api-key"] = self._api_key
        if include_session and self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    def _ensure_initialized(self) -> None:
        """Perform MCP initialize handshake if not already done."""
        if self._initialized:
            return

        url = f"{self._base_url}/mcp"
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "orchestra-mcp-sandbox", "version": "1.0.0"},
            },
        }

        try:
            resp = self._client.post(url, json=payload, headers=self._build_headers())
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(f"MCP initialize failed: HTTP {exc.response.status_code}")
            raise McpSandboxError(f"MCP initialize failed: HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            logger.error(f"MCP initialize failed: {exc}")
            raise McpSandboxError(f"MCP initialize failed: {exc}") from exc

        self._session_id = resp.headers.get("Mcp-Session-Id")
        self._initialized = True
        self._request_id = 1
        logger.debug(f"MCP session initialized: {self._session_id}")

        # Send notifications/initialized
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        }
        try:
            self._client.post(url, json=notification, headers=self._build_headers(include_session=True))
        except httpx.HTTPError as exc:
            logger.warning(f"notifications/initialized failed (non-fatal): {exc}")

    # -- Abstract method implementations --

    @property
    def id(self) -> str:
        return f"mcp-sandbox:{self._base_url}"

    def _send_tool_call(self, tool_name: str, arguments: dict, *, timeout: int | None = None) -> dict:
        """Send a tools/call JSON-RPC request and return the parsed result."""
        self._request_id += 1
        url = f"{self._base_url}/mcp"
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }
        kwargs: dict = {"json": payload, "headers": self._build_headers(include_session=True)}
        if timeout is not None:
            kwargs["timeout"] = timeout
        resp = self._client.post(url, **kwargs)
        resp.raise_for_status()
        return resp.json()

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        self._ensure_initialized()
        try:
            data = self._send_tool_call("exec_command", {"cmd": command}, timeout=timeout)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 400:
                logger.warning("MCP session error on execute, resetting and retrying")
                self._session_id = None
                self._initialized = False
                self._request_id = 0
                try:
                    self._ensure_initialized()
                    data = self._send_tool_call("exec_command", {"cmd": command}, timeout=timeout)
                except (httpx.HTTPError, McpSandboxError) as retry_exc:
                    raise McpSandboxError(f"MCP execute failed after retry: {retry_exc}") from retry_exc
            else:
                raise McpSandboxError(f"MCP execute failed: HTTP {exc.response.status_code}") from exc

        text = data["result"]["content"][0]["text"]
        match = re.search(r"exit_code:\s*(\d+)", text)
        exit_code = int(match.group(1)) if match else 0
        return ExecuteResponse(output=text, exit_code=exit_code, truncated=False)

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        results: list[FileUploadResponse] = []
        for path, content in files:
            if not path.startswith("/"):
                results.append(FileUploadResponse(path=path, error="invalid_path"))
                continue
            try:
                encoded = base64.b64encode(content).decode()
                cmd = f"mkdir -p $(dirname '{path}') && echo '{encoded}' | base64 -d > '{path}'"
                resp = self.execute(cmd)
                if resp.exit_code == 0:
                    results.append(FileUploadResponse(path=path, error=None))
                else:
                    results.append(FileUploadResponse(path=path, error="permission_denied"))
            except Exception as exc:
                logger.error(f"upload_files error for {path}: {exc}")
                results.append(FileUploadResponse(path=path, error="permission_denied"))
        return results

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        results: list[FileDownloadResponse] = []
        for path in paths:
            if not path.startswith("/"):
                results.append(FileDownloadResponse(path=path, content=None, error="invalid_path"))
                continue
            try:
                resp = self.execute(f"base64 '{path}'")
                if resp.exit_code == 0:
                    # Strip the exit_code line from output before decoding
                    clean = re.sub(r"\n?exit_code:\s*\d+\s*$", "", resp.output).strip()
                    decoded = base64.b64decode(clean)
                    results.append(FileDownloadResponse(path=path, content=decoded, error=None))
                else:
                    results.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
            except Exception as exc:
                logger.error(f"download_files error for {path}: {exc}")
                results.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
        return results

    def health(self) -> bool:
        """Check if exec_server is reachable."""
        try:
            headers: dict[str, str] = {}
            if self._api_key:
                headers["x-api-key"] = self._api_key
            resp = self._client.get(f"{self._base_url}/health", headers=headers, timeout=5.0)
            return resp.status_code == 200 and resp.json().get("status") == "ok"
        except Exception:
            return False

    def close(self) -> None:
        """Close the HTTP client and MCP session."""
        if self._session_id:
            try:
                self._client.delete(
                    f"{self._base_url}/mcp",
                    headers=self._build_headers(include_session=True),
                )
            except Exception as exc:
                logger.warning(f"MCP session cleanup failed (non-fatal): {exc}")
        try:
            self._client.close()
        except Exception:
            pass
        self._session_id = None
        self._initialized = False

    def __enter__(self) -> McpSandboxBackend:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
