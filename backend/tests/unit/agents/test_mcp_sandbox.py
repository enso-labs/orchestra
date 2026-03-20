"""Unit tests for McpSandboxBackend (US-010 through US-014)."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock

import httpx
import pytest
from deepagents.backends.protocol import ExecuteResponse

from src.agents.mcp_sandbox import McpSandboxBackend, McpSandboxError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_response(status_code: int = 200, json_data: dict | None = None, headers: dict | None = None):
    """Create a mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
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


def _tool_response(text: str = "hello world\nexit_code: 0"):
    """Standard successful tool call response."""
    return _mock_response(
        json_data={"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": text}]}},
    )


def _make_backend(base_url: str = "http://localhost:3005", api_key: str | None = None) -> McpSandboxBackend:
    """Create a backend with a mocked httpx.Client."""
    backend = McpSandboxBackend(base_url=base_url, api_key=api_key)
    backend._client = MagicMock(spec=httpx.Client)
    return backend


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


# ===========================================================================
# US-011: MCP initialize handshake
# ===========================================================================


class TestEnsureInitialized:
    def test_sends_initialize_payload(self):
        backend = _make_backend()
        backend._client.post.return_value = _init_response()

        backend._ensure_initialized()

        first_call = backend._client.post.call_args_list[0]
        assert first_call[0][0] == "http://localhost:3005/mcp"
        payload = first_call[1]["json"]
        assert payload["method"] == "initialize"
        assert payload["params"]["protocolVersion"] == "2025-03-26"

    def test_extracts_session_id(self):
        backend = _make_backend()
        backend._client.post.return_value = _init_response("my-session-456")

        backend._ensure_initialized()

        assert backend._session_id == "my-session-456"

    def test_sets_initialized_true(self):
        backend = _make_backend()
        backend._client.post.return_value = _init_response()

        backend._ensure_initialized()

        assert backend._initialized is True
        assert backend._request_id == 1

    def test_no_op_when_already_initialized(self):
        backend = _make_backend()
        backend._initialized = True

        backend._ensure_initialized()

        backend._client.post.assert_not_called()

    def test_sends_notifications_initialized(self):
        backend = _make_backend()
        backend._client.post.return_value = _init_response()

        backend._ensure_initialized()

        # Second POST call is the notification
        assert backend._client.post.call_count == 2
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
        backend._client.post.return_value = _init_response()

        backend._ensure_initialized()

        first_call = backend._client.post.call_args_list[0]
        headers = first_call[1]["headers"]
        assert headers["x-api-key"] == "my-key"


# ===========================================================================
# US-012: execute method
# ===========================================================================


class TestExecute:
    def _init_and_exec(self, backend: McpSandboxBackend, exec_response=None):
        """Helper: set up client to return init then exec responses."""
        if exec_response is None:
            exec_response = _tool_response("hello world\nexit_code: 0")
        backend._client.post.side_effect = [_init_response(), _mock_response(), exec_response]

    def test_sends_correct_tool_call_payload(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello")

        # Third call is the tool call (after init + notification)
        tool_call = backend._client.post.call_args_list[2]
        payload = tool_call[1]["json"]
        assert payload["method"] == "tools/call"
        assert payload["params"]["name"] == "exec_command"
        assert payload["params"]["arguments"] == {"cmd": "echo hello"}

    def test_includes_session_id_header(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello")

        tool_call = backend._client.post.call_args_list[2]
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
        # First init succeeds, notification ok, tool call returns 400, then re-init, notification, retry succeeds
        error_resp = _mock_response(status_code=400)
        backend._client.post.side_effect = [
            _init_response(),  # init
            _mock_response(),  # notification
            error_resp,  # tool call -> 400
            _init_response(),  # re-init
            _mock_response(),  # notification
            _tool_response("retry output\nexit_code: 0"),  # retry tool call
        ]

        result = backend.execute("echo retry")

        assert result.output == "retry output\nexit_code: 0"

    def test_raises_when_retry_fails(self):
        backend = _make_backend()
        error_resp = _mock_response(status_code=400)
        backend._client.post.side_effect = [
            _init_response(),  # init
            _mock_response(),  # notification
            error_resp,  # tool call -> 400
            _mock_response(status_code=500),  # re-init fails
        ]

        with pytest.raises(McpSandboxError, match="retry"):
            backend.execute("echo fail")

    def test_passes_timeout_to_httpx(self):
        backend = _make_backend()
        self._init_and_exec(backend)

        backend.execute("echo hello", timeout=30)

        tool_call = backend._client.post.call_args_list[2]
        assert tool_call[1]["timeout"] == 30


# ===========================================================================
# US-013: upload_files and download_files
# ===========================================================================


class TestUploadFiles:
    def test_upload_success(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        backend._client.post.return_value = _tool_response("ok\nexit_code: 0")

        results = backend.upload_files([("/tmp/test.txt", b"hello")])

        assert len(results) == 1
        assert results[0].path == "/tmp/test.txt"
        assert results[0].error is None

    def test_upload_permission_denied(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        backend._client.post.return_value = _tool_response("permission denied\nexit_code: 1")

        results = backend.upload_files([("/root/secret.txt", b"nope")])

        assert results[0].error == "permission_denied"

    def test_upload_partial_success(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        backend._client.post.side_effect = [
            _tool_response("ok\nexit_code: 0"),
            _tool_response("fail\nexit_code: 1"),
        ]

        results = backend.upload_files([("/tmp/a.txt", b"a"), ("/tmp/b.txt", b"b")])

        assert results[0].error is None
        assert results[1].error == "permission_denied"

    def test_upload_invalid_path(self):
        backend = _make_backend()

        results = backend.upload_files([("relative/path.txt", b"data")])

        assert results[0].error == "invalid_path"


class TestDownloadFiles:
    def test_download_success(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        encoded = base64.b64encode(b"file content").decode()
        backend._client.post.return_value = _tool_response(f"{encoded}\nexit_code: 0")

        results = backend.download_files(["/tmp/test.txt"])

        assert results[0].content == b"file content"
        assert results[0].error is None

    def test_download_file_not_found(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        backend._client.post.return_value = _tool_response("No such file\nexit_code: 1")

        results = backend.download_files(["/tmp/missing.txt"])

        assert results[0].content is None
        assert results[0].error == "file_not_found"

    def test_download_strips_whitespace(self):
        backend = _make_backend()
        backend._initialized = True
        backend._session_id = "sess"
        encoded = base64.b64encode(b"data").decode()
        backend._client.post.return_value = _tool_response(f"{encoded}  \n\nexit_code: 0")

        results = backend.download_files(["/tmp/test.txt"])

        assert results[0].content == b"data"

    def test_download_invalid_path(self):
        backend = _make_backend()

        results = backend.download_files(["relative/path.txt"])

        assert results[0].error == "invalid_path"
        assert results[0].content is None


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
