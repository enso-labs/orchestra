"""MCP Sandbox backend — communicates with exec_server via MCP JSON-RPC 2.0."""

from __future__ import annotations

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

    # -- Abstract method stubs (implemented in later stories) --

    @property
    def id(self) -> str:
        return f"mcp-sandbox:{self._base_url}"

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        raise NotImplementedError("US-004")

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        raise NotImplementedError("US-006")

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        raise NotImplementedError("US-007")
