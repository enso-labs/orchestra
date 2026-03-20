"""Unit tests for McpSandboxBackend (US-010 through US-014, US-046 through US-059)."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock

import httpx
import pytest
from deepagents.backends.protocol import ExecuteResponse

from src.agents.mcp_sandbox import McpSandboxBackend, McpSandboxError, _parse_json_lines


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_response(status_code: int = 200, json_data: dict | None = None, headers: dict | None = None):
    """Create a mock httpx.Response."""
    import json

    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    data = json_data or {}
    resp.json.return_value = data
    resp.text = json.dumps(data)
    resp.headers = headers or {}
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        http_error = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(spec=httpx.Request),
            response=resp,
        )
        resp.raise_for_status.side_effect = http_error
    return resp


def _init_response(session_id: str = "test-session-123"):
    """Standard successful initialize response."""
    return _mock_response(
        json_data={"jsonrpc": "2.0", "id": 0, "result": {"protocolVersion": "2025-03-26"}},
        headers={"Mcp-Session-Id": session_id},
    )


def _tools_list_response(tools: list[str] | None = None):
    """Standard tools/list response."""
    if tools is None:
        tools = [
            "execute",
            "exec_command",
            "read",
            "write",
            "edit",
            "grep",
            "glob",
            "ls",
            "upload_file",
            "download_file",
        ]
    tool_list = [{"name": t} for t in tools]
    return _mock_response(
        json_data={"jsonrpc": "2.0", "id": 2, "result": {"tools": tool_list}},
    )


def _tool_response(text: str = "hello world\nexit_code: 0", meta: dict | None = None):
    """Standard successful tool call response."""
    result: dict = {"content": [{"type": "text", "text": text}]}
    if meta is not None:
        result["_meta"] = meta
    return _mock_response(
        json_data={"jsonrpc": "2.0", "id": 1, "result": result},
    )


def _make_backend(base_url: str = "http://localhost:3005", api_key: str | None = None) -> McpSandboxBackend:
    """Create a backend with a mocked httpx.Client."""
    backend = McpSandboxBackend(base_url=base_url, api_key=api_key)
    backend._client = MagicMock(spec=httpx.Client)
    return backend


def _make_initialized_backend(
    tools: list[str] | None = None,
    **kwargs,
) -> McpSandboxBackend:
    """Create a backend already initialized with tools."""
    backend = _make_backend(**kwargs)
    backend._initialized = True
    backend._session_id = "sess"
    if tools is None:
        tools = [
            "execute",
            "exec_command",
            "read",
            "write",
            "edit",
            "grep",
            "glob",
            "ls",
            "upload_file",
            "download_file",
        ]
    backend._available_tools = set(tools)
    return backend


def _init_side_effects(tools: list[str] | None = None):
    """Return side_effect list for init + notification + tools/list."""
    return [_init_response(), _mock_response(), _tools_list_response(tools)]


# ===========================================================================
# US-010: Constructor and id property
# ===========================================================================


class TestConstructorAndId:
    def test_base_url_trailing_slash_stripped(self):
        b = McpSandboxBackend(base_url="http://localhost:3005/")
        assert b._base_url == "http://localhost:3005"

    def test_base_url_stored_without_trailing_slash(self):
        b = McpSandboxBackend(base_url="http://localhost:3005")
        assert b._base_url == "http://localhost:3005"

    def test_api_key_none_when_not_provided(self):
        b = McpSandboxBackend(base_url="http://localhost:3005")
        assert b._api_key is None

    def test_api_key_stored_when_provided(self):
        b = McpSandboxBackend(base_url="http://localhost:3005", api_key="secret")
        assert b._api_key == "secret"

    def test_id_property_format(self):
        b = McpSandboxBackend(base_url="http://localhost:3005")
        assert b.id == "mcp-sandbox:http://localhost:3005"

    def test_initial_state(self):
        b = McpSandboxBackend(base_url="http://localhost:3005")
        assert b._initialized is False
        assert b._session_id is None
        assert b._request_id == 0
        assert b._available_tools == set()


# ===========================================================================
# US-011: MCP initialize handshake
# ===========================================================================


class TestEnsureInitialized:
    def test_sends_initialize_payload(self):
        backend = _make_backend()
        backend._client.post.side_effect = _init_side_effects()

        backend._ensure_initialized()

        first_call = backend._client.post.call_args_list[0]
        assert first_call[0][0] == "http://localhost:3005/mcp"
        payload = first_call[1]["json"]
        assert payload["method"] == "initialize"
        assert payload["params"]["protocolVersion"] == "2025-03-26"

    def test_extracts_session_id(self):
        backend = _make_backend()
        backend._client.post.side_effect = [
            _init_response("my-session-456"),
            _mock_response(),
            _tools_list_response(),
        ]

        backend._ensure_initialized()

        assert backend._session_id == "my-session-456"

    def test_sets_initialized_true(self):
        backend = _make_backend()
        backend._client.post.side_effect = _init_side_effects()

        backend._ensure_initialized()

        assert backend._initialized is True
        # request_id incremented: 0 (init) -> 1 (after init) -> 2 (tools/list)
        assert backend._request_id == 2

    def test_no_op_when_already_initialized(self):
        backend = _make_backend()
        backend._initialized = True

        backend._ensure_initialized()

        backend._client.post.assert_not_called()

    def test_sends_notifications_initialized(self):
        backend = _make_backend()
        backend._client.post.side_effect = _init_side_effects()

        backend._ensure_initialized()

        # 3 POST calls: init, notification, tools/list
        assert backend._client.post.call_count == 3
        second_call = backend._client.post.call_args_list[1]
        payload = second_call[1]["json"]
        assert payload["method"] == "notifications/initialized"

    def test_raises_on_http_error(self):
        backend = _make_backend()
        backend._client.post.return_value = _mock_response(status_code=500)

        with pytest.raises(McpSandboxError, match="MCP initialize failed"):
            backend._ensure_initialized()

    def test_includes_api_key_header(self):
        backend = _make_backend(api_key="my-key")
        backend._client.post.side_effect = _init_side_effects()

        backend._ensure_initialized()

        first_call = backend._client.post.call_args_list[0]
        headers = first_call[1]["headers"]
        assert headers["x-api-key"] == "my-key"

    def test_discovers_tools(self):
        backend = _make_backend()
        backend._client.post.side_effect = _init_side_effects(["execute", "read", "write"])

        backend._ensure_initialized()

        assert backend._available_tools == {"execute", "read", "write"}

    def test_tools_list_failure_is_nonfatal(self):
        backend = _make_backend()
        backend._client.post.side_effect = [
            _init_response(),
            _mock_response(),
            _mock_response(status_code=500),
        ]

        backend._ensure_initialized()

        assert backend._initialized is True
        assert backend._available_tools == set()


# ===========================================================================
# US-012: execute method
# ===========================================================================


class TestExecute:
    def _init_and_exec(self, backend: McpSandboxBackend, exec_response=None, tools=None):
        """Helper: set up client to return init, notification, tools/list, then exec responses."""
        if exec_response is None:
            exec_response = _tool_response("hello world\nexit_code: 0")
        backend._client.post.side_effect = [*_init_side_effects(tools), exec_response]

    def test_sends_correct_tool_call_payload(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello")

        # 4th call is the tool call (init + notification + tools/list + tool call)
        tool_call = backend._client.post.call_args_list[3]
        payload = tool_call[1]["json"]
        assert payload["method"] == "tools/call"
        assert payload["params"]["name"] == "execute"
        assert payload["params"]["arguments"] == {"cmd": "echo hello"}

    def test_includes_session_id_header(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello")

        tool_call = backend._client.post.call_args_list[3]
        headers = tool_call[1]["headers"]
        assert "Mcp-Session-Id" in headers

    def test_parses_exit_code_from_text(self):
        backend = _make_backend()
        self._init_and_exec(backend, _tool_response("some output\nexit_code: 1"))

        result = backend.execute("false")

        assert result.exit_code == 1

    def test_exit_code_defaults_to_zero(self):
        backend = _make_backend()
        self._init_and_exec(backend, _tool_response("just some output with no exit code"))

        result = backend.execute("echo hello")

        assert result.exit_code == 0

    def test_returns_execute_response(self):
        backend = _make_backend()
        self._init_and_exec(backend, _tool_response("hello world\nexit_code: 0"))

        result = backend.execute("echo hello")

        assert isinstance(result, ExecuteResponse)
        assert result.output == "hello world\nexit_code: 0"
        assert result.truncated is False

    def test_retries_on_http_400(self):
        backend = _make_backend()
        error_resp = _mock_response(status_code=400)
        backend._client.post.side_effect = [
            *_init_side_effects(),  # init + notification + tools/list
            error_resp,  # tool call -> 400
            *_init_side_effects(),  # re-init + notification + tools/list
            _tool_response("retry output\nexit_code: 0"),  # retry tool call
        ]

        result = backend.execute("echo retry")

        assert result.output == "retry output\nexit_code: 0"

    def test_raises_when_retry_fails(self):
        backend = _make_backend()
        error_resp = _mock_response(status_code=400)
        backend._client.post.side_effect = [
            *_init_side_effects(),  # init + notification + tools/list
            error_resp,  # tool call -> 400
            _mock_response(status_code=500),  # re-init fails
        ]

        with pytest.raises(McpSandboxError, match="retry"):
            backend.execute("echo fail")

    def test_passes_timeout_to_httpx(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello", timeout=30)

        tool_call = backend._client.post.call_args_list[3]
        assert tool_call[1]["timeout"] == 30

    def test_uses_exec_command_on_old_server(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("output\nexit_code: 0")

        result = backend.execute("echo old")

        tool_call = backend._client.post.call_args_list[0]
        assert tool_call[1]["json"]["params"]["name"] == "exec_command"
        assert result.exit_code == 0

    def test_prefers_execute_over_exec_command(self):
        backend = _make_initialized_backend(tools=["execute", "exec_command"])
        backend._client.post.return_value = _tool_response("output")

        backend.execute("echo test")

        tool_call = backend._client.post.call_args_list[0]
        assert tool_call[1]["json"]["params"]["name"] == "execute"

    def test_raises_when_no_execute_tool(self):
        backend = _make_initialized_backend(tools=["read", "write"])

        with pytest.raises(McpSandboxError, match="No execute tool"):
            backend.execute("echo fail")

    def test_meta_exit_code_preferred(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response(
            "output\nexit_code: 1", meta={"exit_code": 42, "sandbox_id": "abc"}
        )

        result = backend.execute("test")

        assert result.exit_code == 42


# ===========================================================================
# US-013: upload_files and download_files
# ===========================================================================


class TestUploadFiles:
    def test_upload_success(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("ok", meta={"exit_code": 0, "sandbox_id": "x"})

        results = backend.upload_files([("/tmp/test.txt", b"hello")])

        assert len(results) == 1
        assert results[0].path == "/tmp/test.txt"
        assert results[0].error is None

    def test_upload_permission_denied(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("denied", meta={"exit_code": 1, "sandbox_id": "x"})

        results = backend.upload_files([("/root/secret.txt", b"nope")])

        assert results[0].error == "permission_denied"

    def test_upload_partial_success(self):
        backend = _make_initialized_backend()
        backend._client.post.side_effect = [
            _tool_response("ok", meta={"exit_code": 0, "sandbox_id": "x"}),
            _tool_response("fail", meta={"exit_code": 1, "sandbox_id": "x"}),
        ]

        results = backend.upload_files([("/tmp/a.txt", b"a"), ("/tmp/b.txt", b"b")])

        assert results[0].error is None
        assert results[1].error == "permission_denied"

    def test_upload_invalid_path(self):
        backend = _make_initialized_backend()

        results = backend.upload_files([("relative/path.txt", b"data")])

        assert results[0].error == "invalid_path"

    def test_upload_fallback_shell(self):
        """When upload_file tool not available, falls back to shell base64."""
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("ok\nexit_code: 0")

        results = backend.upload_files([("/tmp/test.txt", b"hello")])

        assert results[0].error is None


class TestDownloadFiles:
    def test_download_success(self):
        backend = _make_initialized_backend()
        encoded = base64.b64encode(b"file content").decode()
        backend._client.post.return_value = _tool_response(encoded, meta={"exit_code": 0, "sandbox_id": "x"})

        results = backend.download_files(["/tmp/test.txt"])

        assert results[0].content == b"file content"
        assert results[0].error is None

    def test_download_file_not_found(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("not found", meta={"exit_code": 1, "sandbox_id": "x"})

        results = backend.download_files(["/tmp/missing.txt"])

        assert results[0].content is None
        assert results[0].error == "file_not_found"

    def test_download_strips_whitespace(self):
        backend = _make_initialized_backend()
        encoded = base64.b64encode(b"data").decode()
        backend._client.post.return_value = _tool_response(f"{encoded}  \n", meta={"exit_code": 0, "sandbox_id": "x"})

        results = backend.download_files(["/tmp/test.txt"])

        assert results[0].content == b"data"

    def test_download_invalid_path(self):
        backend = _make_initialized_backend()

        results = backend.download_files(["relative/path.txt"])

        assert results[0].error == "invalid_path"
        assert results[0].content is None

    def test_download_fallback_shell(self):
        """When download_file tool not available, falls back to shell base64."""
        backend = _make_initialized_backend(tools=["exec_command"])
        encoded = base64.b64encode(b"data").decode()
        # Fallback uses execute(f"base64 '/path'") which returns raw base64 output
        backend._client.post.return_value = _tool_response(f"{encoded}\nexit_code: 0")

        results = backend.download_files(["/tmp/test.txt"])

        assert results[0].content == b"data"


# ===========================================================================
# US-014: health check and cleanup
# ===========================================================================


class TestHealth:
    def test_health_returns_true(self):
        backend = _make_backend()
        backend._client.get.return_value = _mock_response(json_data={"status": "ok"})

        assert backend.health() is True

    def test_health_returns_false_on_error(self):
        backend = _make_backend()
        backend._client.get.side_effect = httpx.ConnectError("refused")

        assert backend.health() is False

    def test_health_returns_false_on_bad_status(self):
        backend = _make_backend()
        backend._client.get.return_value = _mock_response(json_data={"status": "degraded"})

        assert backend.health() is False

    def test_health_uses_short_timeout(self):
        backend = _make_backend()
        backend._client.get.return_value = _mock_response(json_data={"status": "ok"})

        backend.health()

        backend._client.get.assert_called_once()
        _, kwargs = backend._client.get.call_args
        assert kwargs["timeout"] == 5.0


class TestClose:
    def test_close_sends_delete_with_session(self):
        backend = _make_backend()
        backend._session_id = "sess-123"
        backend._initialized = True

        backend.close()

        backend._client.delete.assert_called_once()
        call_args = backend._client.delete.call_args
        assert "/mcp" in call_args[0][0]
        assert call_args[1]["headers"]["Mcp-Session-Id"] == "sess-123"

    def test_close_calls_client_close(self):
        backend = _make_backend()

        backend.close()

        backend._client.close.assert_called_once()

    def test_close_resets_state(self):
        backend = _make_backend()
        backend._session_id = "sess"
        backend._initialized = True

        backend.close()

        assert backend._session_id is None
        assert backend._initialized is False

    def test_close_safe_without_session(self):
        backend = _make_backend()
        backend._session_id = None

        backend.close()  # should not raise

        backend._client.delete.assert_not_called()

    def test_context_manager_calls_close(self):
        backend = _make_backend()
        backend._session_id = "sess"

        with backend:
            pass

        backend._client.close.assert_called_once()


# ===========================================================================
# US-046: Tool discovery
# ===========================================================================


class TestToolDiscovery:
    def test_has_tool_true(self):
        backend = _make_initialized_backend(tools=["execute", "read"])
        assert backend._has_tool("execute") is True
        assert backend._has_tool("read") is True

    def test_has_tool_false(self):
        backend = _make_initialized_backend(tools=["execute"])
        assert backend._has_tool("write") is False


# ===========================================================================
# US-047: _parse_meta
# ===========================================================================


class TestParseMeta:
    def test_meta_present(self):
        backend = _make_initialized_backend()
        exit_code, sandbox_id = backend._parse_meta({"_meta": {"exit_code": 42, "sandbox_id": "abc-123"}})
        assert exit_code == 42
        assert sandbox_id == "abc-123"

    def test_meta_absent(self):
        backend = _make_initialized_backend()
        exit_code, sandbox_id = backend._parse_meta({})
        assert exit_code is None
        assert sandbox_id is None

    def test_meta_caches_sandbox_id(self):
        backend = _make_initialized_backend()
        backend._parse_meta({"_meta": {"sandbox_id": "cached-id"}})
        assert backend._sandbox_id == "cached-id"


# ===========================================================================
# US-048: Sandbox ID from _meta
# ===========================================================================


class TestSandboxId:
    def test_id_fallback_before_tool_call(self):
        b = McpSandboxBackend(base_url="http://localhost:3005")
        assert b.id == "mcp-sandbox:http://localhost:3005"

    def test_id_uses_meta_sandbox_id(self):
        backend = _make_initialized_backend()
        backend._sandbox_id = "remote-uuid"
        assert backend.id == "remote-uuid"


# ===========================================================================
# US-050-055: Native tool overrides
# ===========================================================================


class TestReadOverride:
    def test_native_read(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("     1\tline1\n     2\tline2", meta={"exit_code": 0})

        result = backend.read("/workspace/file.txt")

        assert "line1" in result

    def test_fallback_read(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("stdout:\n     1\tline1\nexit_code: 0")

        result = backend.read("/workspace/file.txt")

        assert "line1" in result


class TestWriteOverride:
    def test_native_write_success(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("Written to /workspace/f.txt", meta={"exit_code": 0})

        result = backend.write("/workspace/f.txt", "content")

        assert result.error is None
        assert result.path == "/workspace/f.txt"

    def test_native_write_error(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("Permission denied", meta={"exit_code": 1})

        result = backend.write("/workspace/f.txt", "content")

        assert result.error is not None


class TestEditOverride:
    def test_native_edit_success(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("Replaced 1 occurrence(s)", meta={"exit_code": 0})

        result = backend.edit("/workspace/f.txt", "old", "new")

        assert result.error is None
        assert result.occurrences == 1

    def test_native_edit_not_found(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("not found", meta={"exit_code": 1})

        result = backend.edit("/workspace/f.txt", "old", "new")

        assert result.error == "old_string not found in file"

    def test_native_edit_multiple(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("3 occurrences", meta={"exit_code": 2})

        result = backend.edit("/workspace/f.txt", "old", "new")

        assert result.error == "multiple matches found (use replace_all=true)"

    def test_native_edit_file_not_found(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("no file", meta={"exit_code": 3})

        result = backend.edit("/workspace/f.txt", "old", "new")

        assert "file not found" in result.error


class TestGrepOverride:
    def test_native_grep_matches(self):
        backend = _make_initialized_backend()
        line1 = '{"path":"/workspace/a.py","line":1,"text":"hello"}'
        line2 = '{"path":"/workspace/b.py","line":2,"text":"hello world"}'
        backend._client.post.return_value = _tool_response(f"{line1}\n{line2}", meta={"exit_code": 0})

        result = backend.grep_raw("hello")

        assert len(result) == 2
        assert result[0]["path"] == "/workspace/a.py"

    def test_native_grep_no_matches(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("", meta={"exit_code": 1})

        result = backend.grep_raw("nonexistent")

        assert result == []


class TestGlobOverride:
    def test_native_glob(self):
        backend = _make_initialized_backend()
        text = '{"path":"/workspace/a.py","is_dir":false,"size":100,"mtime":"2025-01-01T00:00:00Z"}'
        backend._client.post.return_value = _tool_response(text, meta={"exit_code": 0})

        result = backend.glob_info("*.py")

        assert len(result) == 1
        assert result[0]["path"] == "/workspace/a.py"

    def test_native_glob_empty(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("", meta={"exit_code": 0})

        result = backend.glob_info("*.xyz")

        assert result == []


class TestLsOverride:
    def test_native_ls(self):
        backend = _make_initialized_backend()
        text = '{"path":"/workspace/file.py","is_dir":false}\n{"path":"/workspace/dir","is_dir":true}'
        backend._client.post.return_value = _tool_response(text, meta={"exit_code": 0})

        result = backend.ls_info("/workspace")

        assert len(result) == 2
        assert result[1]["is_dir"] is True

    def test_native_ls_not_found(self):
        backend = _make_initialized_backend()
        backend._client.post.return_value = _tool_response("not found", meta={"exit_code": 1})

        result = backend.ls_info("/nonexistent")

        assert result == []


# ===========================================================================
# US-058: Graceful degradation — old exec_server
# ===========================================================================


class TestGracefulDegradation:
    def test_old_server_execute_uses_exec_command(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("output\nexit_code: 0")

        result = backend.execute("echo test")

        assert result.exit_code == 0
        call = backend._client.post.call_args_list[0]
        assert call[1]["json"]["params"]["name"] == "exec_command"

    def test_old_server_read_falls_back(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("stdout:\n     1\tline\nexit_code: 0")

        result = backend.read("/file.txt")

        # Falls back to super().read() which calls execute()
        assert "line" in result

    def test_old_server_upload_falls_back(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        backend._client.post.return_value = _tool_response("ok\nexit_code: 0")

        results = backend.upload_files([("/tmp/f.txt", b"data")])

        assert results[0].error is None

    def test_old_server_download_falls_back(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        encoded = base64.b64encode(b"data").decode()
        backend._client.post.return_value = _tool_response(f"{encoded}\nexit_code: 0")

        results = backend.download_files(["/tmp/f.txt"])

        assert results[0].content == b"data"

    def test_old_server_id_is_fallback(self):
        backend = _make_initialized_backend(tools=["exec_command"])
        assert backend.id == "mcp-sandbox:http://localhost:3005"


# ===========================================================================
# Helper tests
# ===========================================================================


class TestParseJsonLines:
    def test_valid_lines(self):
        text = '{"a":1}\n{"b":2}\n'
        result = _parse_json_lines(text)
        assert len(result) == 2
        assert result[0] == {"a": 1}

    def test_empty_string(self):
        assert _parse_json_lines("") == []

    def test_invalid_json_skipped(self):
        text = '{"a":1}\nnot json\n{"b":2}'
        result = _parse_json_lines(text)
        assert len(result) == 2
