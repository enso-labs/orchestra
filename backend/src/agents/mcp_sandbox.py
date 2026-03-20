"""MCP Sandbox backend — communicates with exec_server via MCP JSON-RPC 2.0."""

from __future__ import annotations

import base64
import json
import re

import httpx
from deepagents.backends.sandbox import BaseSandbox
from deepagents.backends.protocol import (
    EditResult,
    ExecuteResponse,
    FileDownloadResponse,
    FileInfo,
    FileUploadResponse,
    GrepMatch,
    WriteResult,
)

from src.utils.logger import logger

EXIT_CODE_RE = re.compile(r"exit_code:\s*(\d+)")


class McpSandboxError(Exception):
    """Raised when MCP sandbox communication fails after retries."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


def _parse_json_lines(text: str) -> list[dict]:
    """Parse newline-delimited JSON into a list of dicts."""
    results: list[dict] = []
    for line in text.strip().splitlines():
        line = line.strip()
        if line:
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return results


class McpSandboxBackend(BaseSandbox):
    """Sandbox backend that delegates execution to an exec_server via MCP protocol."""

    def __init__(self, *, base_url: str, api_key: str | None = None) -> None:
        self._base_url: str = base_url.rstrip("/")
        self._api_key: str | None = api_key
        self._client: httpx.Client = httpx.Client(timeout=httpx.Timeout(120.0))
        self._session_id: str | None = None
        self._request_id: int = 0
        self._initialized: bool = False
        self._available_tools: set[str] = set()
        self._sandbox_id: str | None = None
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

    def _has_tool(self, name: str) -> bool:
        """Check if a tool is available on the connected exec_server."""
        return name in self._available_tools

    def _parse_meta(self, result: dict) -> tuple[int | None, str | None]:
        """Extract exit_code and sandbox_id from _meta if present."""
        meta = result.get("_meta", {})
        exit_code = meta.get("exit_code")
        sandbox_id = meta.get("sandbox_id")
        if sandbox_id and isinstance(sandbox_id, str):
            self._sandbox_id = sandbox_id
        return exit_code, sandbox_id

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

        # Discover available tools
        try:
            self._request_id += 1
            tools_payload = {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": "tools/list",
                "params": {},
            }
            tools_resp = self._client.post(url, json=tools_payload, headers=self._build_headers(include_session=True))
            tools_resp.raise_for_status()
            tools_data = tools_resp.json()
            tool_list = tools_data.get("result", {}).get("tools", [])
            self._available_tools = {t["name"] for t in tool_list if isinstance(t, dict) and "name" in t}
            logger.debug(f"MCP tools discovered: {self._available_tools}")
        except Exception as exc:
            logger.warning(f"tools/list failed (non-fatal, fallback mode): {exc}")
            self._available_tools = set()

    # -- Tool call helpers --

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

    def _get_text_and_meta(self, data: dict) -> tuple[str, int]:
        """Extract text content and exit code from a tool call response."""
        result = data.get("result", {})
        text = result.get("content", [{}])[0].get("text", "")
        meta_exit, _ = self._parse_meta(result)
        if meta_exit is not None:
            return text, meta_exit
        # Fallback: parse exit code from text
        match = EXIT_CODE_RE.search(text)
        return text, int(match.group(1)) if match else 0

    # -- Abstract method implementations --

    @property
    def id(self) -> str:
        if self._sandbox_id:
            return self._sandbox_id
        return f"mcp-sandbox:{self._base_url}"

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        self._ensure_initialized()

        # Determine which tool name to use
        if self._has_tool("execute"):
            tool_name = "execute"
        elif self._has_tool("exec_command"):
            tool_name = "exec_command"
        else:
            raise McpSandboxError("No execute tool available on exec_server")

        try:
            data = self._send_tool_call(tool_name, {"cmd": command}, timeout=timeout)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 400:
                logger.warning("MCP session error on execute, resetting and retrying")
                self._session_id = None
                self._initialized = False
                self._request_id = 0
                try:
                    self._ensure_initialized()
                    data = self._send_tool_call(tool_name, {"cmd": command}, timeout=timeout)
                except (httpx.HTTPError, McpSandboxError) as retry_exc:
                    raise McpSandboxError(f"MCP execute failed after retry: {retry_exc}") from retry_exc
            else:
                raise McpSandboxError(f"MCP execute failed: HTTP {exc.response.status_code}") from exc

        text, exit_code = self._get_text_and_meta(data)
        return ExecuteResponse(output=text, exit_code=exit_code, truncated=False)

    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> str:
        self._ensure_initialized()
        if self._has_tool("read"):
            data = self._send_tool_call("read", {"path": file_path, "offset": offset, "limit": limit})
            text, _ = self._get_text_and_meta(data)
            return text
        return super().read(file_path, offset, limit)

    def write(self, file_path: str, content: str) -> WriteResult:
        self._ensure_initialized()
        if self._has_tool("write"):
            data = self._send_tool_call("write", {"path": file_path, "content": content})
            _, exit_code = self._get_text_and_meta(data)
            if exit_code == 0:
                return WriteResult(error=None, path=file_path)
            text = data.get("result", {}).get("content", [{}])[0].get("text", "write failed")
            return WriteResult(error=text, path=file_path)
        return super().write(file_path, content)

    def edit(self, file_path: str, old_string: str, new_string: str, replace_all: bool = False) -> EditResult:
        self._ensure_initialized()
        if self._has_tool("edit"):
            data = self._send_tool_call(
                "edit",
                {"path": file_path, "old_string": old_string, "new_string": new_string, "replace_all": replace_all},
            )
            text, exit_code = self._get_text_and_meta(data)
            if exit_code == 0:
                # Parse occurrence count from text like "Replaced 1 occurrence(s)"
                occ_match = re.search(r"(\d+)\s+occurrence", text)
                occurrences = int(occ_match.group(1)) if occ_match else 1
                return EditResult(error=None, path=file_path, occurrences=occurrences)
            error_msgs = {
                1: "old_string not found in file",
                2: "multiple matches found (use replace_all=true)",
                3: f"file not found: {file_path}",
            }
            return EditResult(error=error_msgs.get(exit_code, text), path=file_path, occurrences=None)
        return super().edit(file_path, old_string, new_string, replace_all)

    def grep_raw(self, pattern: str, path: str | None = None, glob: str | None = None) -> list[GrepMatch] | str:
        self._ensure_initialized()
        if self._has_tool("grep"):
            args: dict = {"pattern": pattern}
            if path:
                args["path"] = path
            if glob:
                args["glob"] = glob
            data = self._send_tool_call("grep", args)
            _, exit_code = self._get_text_and_meta(data)
            if exit_code == 1:
                return []
            text = data.get("result", {}).get("content", [{}])[0].get("text", "")
            parsed = _parse_json_lines(text)
            return [GrepMatch(path=m["path"], line=m["line"], text=m["text"]) for m in parsed]
        return super().grep_raw(pattern, path, glob)

    def glob_info(self, pattern: str, path: str = "/") -> list[FileInfo]:
        self._ensure_initialized()
        if self._has_tool("glob"):
            data = self._send_tool_call("glob", {"pattern": pattern, "path": path})
            text = data.get("result", {}).get("content", [{}])[0].get("text", "")
            self._parse_meta(data.get("result", {}))
            parsed = _parse_json_lines(text)
            results: list[FileInfo] = []
            for entry in parsed:
                fi = FileInfo(path=entry["path"])
                if "is_dir" in entry:
                    fi["is_dir"] = entry["is_dir"]
                if "size" in entry:
                    fi["size"] = entry["size"]
                if "mtime" in entry:
                    fi["modified_at"] = entry["mtime"]
                results.append(fi)
            return results
        return super().glob_info(pattern, path)

    def ls_info(self, path: str) -> list[FileInfo]:
        self._ensure_initialized()
        if self._has_tool("ls"):
            data = self._send_tool_call("ls", {"path": path})
            _, exit_code = self._get_text_and_meta(data)
            if exit_code == 1:
                return []
            text = data.get("result", {}).get("content", [{}])[0].get("text", "")
            parsed = _parse_json_lines(text)
            return [FileInfo(path=entry["path"], is_dir=entry.get("is_dir", False)) for entry in parsed]
        return super().ls_info(path)

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        self._ensure_initialized()
        if self._has_tool("upload_file"):
            results: list[FileUploadResponse] = []
            for file_path, content in files:
                if not file_path.startswith("/"):
                    results.append(FileUploadResponse(path=file_path, error="invalid_path"))
                    continue
                try:
                    encoded = base64.b64encode(content).decode()
                    data = self._send_tool_call("upload_file", {"path": file_path, "content_base64": encoded})
                    _, exit_code = self._get_text_and_meta(data)
                    if exit_code == 0:
                        results.append(FileUploadResponse(path=file_path, error=None))
                    else:
                        results.append(FileUploadResponse(path=file_path, error="permission_denied"))
                except Exception as exc:
                    logger.error(f"upload_files error for {file_path}: {exc}")
                    results.append(FileUploadResponse(path=file_path, error="permission_denied"))
            return results
        # Fallback to shell-based base64 implementation
        results = []
        for file_path, content in files:
            if not file_path.startswith("/"):
                results.append(FileUploadResponse(path=file_path, error="invalid_path"))
                continue
            try:
                encoded = base64.b64encode(content).decode()
                cmd = f"mkdir -p $(dirname '{file_path}') && echo '{encoded}' | base64 -d > '{file_path}'"
                resp = self.execute(cmd)
                if resp.exit_code == 0:
                    results.append(FileUploadResponse(path=file_path, error=None))
                else:
                    results.append(FileUploadResponse(path=file_path, error="permission_denied"))
            except Exception as exc:
                logger.error(f"upload_files error for {file_path}: {exc}")
                results.append(FileUploadResponse(path=file_path, error="permission_denied"))
        return results

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        self._ensure_initialized()
        if self._has_tool("download_file"):
            results: list[FileDownloadResponse] = []
            for file_path in paths:
                if not file_path.startswith("/"):
                    results.append(FileDownloadResponse(path=file_path, content=None, error="invalid_path"))
                    continue
                try:
                    data = self._send_tool_call("download_file", {"path": file_path})
                    _, exit_code = self._get_text_and_meta(data)
                    if exit_code == 0:
                        text = data.get("result", {}).get("content", [{}])[0].get("text", "")
                        decoded = base64.b64decode(text.strip())
                        results.append(FileDownloadResponse(path=file_path, content=decoded, error=None))
                    else:
                        results.append(FileDownloadResponse(path=file_path, content=None, error="file_not_found"))
                except Exception as exc:
                    logger.error(f"download_files error for {file_path}: {exc}")
                    results.append(FileDownloadResponse(path=file_path, content=None, error="file_not_found"))
            return results
        # Fallback to shell-based base64 implementation
        results = []
        for file_path in paths:
            if not file_path.startswith("/"):
                results.append(FileDownloadResponse(path=file_path, content=None, error="invalid_path"))
                continue
            try:
                resp = self.execute(f"base64 '{file_path}'")
                if resp.exit_code == 0:
                    clean = re.sub(r"\n?exit_code:\s*\d+\s*$", "", resp.output).strip()
                    decoded = base64.b64decode(clean)
                    results.append(FileDownloadResponse(path=file_path, content=decoded, error=None))
                else:
                    results.append(FileDownloadResponse(path=file_path, content=None, error="file_not_found"))
            except Exception as exc:
                logger.error(f"download_files error for {file_path}: {exc}")
                results.append(FileDownloadResponse(path=file_path, content=None, error="file_not_found"))
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
