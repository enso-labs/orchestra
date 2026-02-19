"""Unit tests for create_daytona_backend(), resolve_sandbox_backend(), and LocalSandbox."""

from unittest.mock import MagicMock, patch


class TestCreateDaytonaBackend:
    """Tests for create_daytona_backend()."""

    def test_returns_none_when_daytona_not_installed(self):
        """When DaytonaSandbox is None (not installed), returns (None, None)."""
        with (
            patch("src.agents.DaytonaSandbox", None),
            patch("src.agents.Daytona", None),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_none_when_api_key_missing(self):
        """When DAYTONA_API_KEY is empty, returns (None, None)."""
        with (
            patch("src.agents.DaytonaSandbox", MagicMock()),
            patch("src.agents.Daytona", MagicMock()),
            patch("src.agents.DAYTONA_API_KEY", ""),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_sandbox_and_backend_on_success(self):
        """When Daytona is available and key is set, returns (sandbox, backend)."""
        mock_sandbox = MagicMock()
        mock_backend = MagicMock()
        mock_client = MagicMock()
        mock_client.create.return_value = mock_sandbox
        mock_daytona_cls = MagicMock(return_value=mock_client)
        mock_sandbox_cls = MagicMock(return_value=mock_backend)

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaSandbox", mock_sandbox_cls),
            patch("src.agents.DaytonaConfig", MagicMock()),
            patch("src.agents.DAYTONA_API_KEY", "test-key-123"),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is mock_sandbox
            assert backend is mock_backend
            mock_client.create.assert_called_once()
            mock_sandbox_cls.assert_called_once_with(sandbox=mock_sandbox)

    def test_returns_none_on_exception(self):
        """When sandbox creation throws, returns (None, None) silently."""
        mock_daytona_cls = MagicMock(side_effect=RuntimeError("connection refused"))

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaSandbox", MagicMock()),
            patch("src.agents.DaytonaConfig", MagicMock()),
            patch("src.agents.DAYTONA_API_KEY", "test-key-123"),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None


class TestResolveSandboxBackend:
    """Tests for resolve_sandbox_backend()."""

    def test_daytona_success_path(self):
        """When Daytona is available and capable, returns Daytona-backed CompositeBackend."""
        mock_sandbox = MagicMock()
        mock_daytona_backend = MagicMock()
        mock_daytona_backend.execute = MagicMock()  # has execute method
        mock_runtime = MagicMock()

        with (
            patch(
                "src.agents.create_daytona_backend",
                return_value=(mock_sandbox, mock_daytona_backend),
            ),
            patch(
                "src.agents.daytona.validate_daytona_execute_capability",
                return_value=(True, None),
            ),
        ):
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime)

            assert sandbox is mock_sandbox
            assert backend is not None
            assert backend.routes == {}

    def test_fallback_when_daytona_not_capable(self):
        """When Daytona is not capable, falls back to StateBackend and cleans up sandbox."""
        mock_sandbox = MagicMock()
        mock_daytona_backend = MagicMock()
        mock_runtime = MagicMock()

        with (
            patch(
                "src.agents.create_daytona_backend",
                return_value=(mock_sandbox, mock_daytona_backend),
            ),
            patch(
                "src.agents.daytona.validate_daytona_execute_capability",
                return_value=(False, "not capable"),
            ),
        ):
            from src.agents import resolve_sandbox_backend

            result_backend, sandbox = resolve_sandbox_backend(mock_runtime)

            assert sandbox is None
            assert result_backend is not None
            assert result_backend.routes == {}
            mock_sandbox.stop.assert_called_once()

    def test_fallback_when_daytona_not_installed(self):
        """When Daytona is not installed, falls back to StateBackend silently."""
        mock_runtime = MagicMock()

        with patch(
            "src.agents.create_daytona_backend",
            return_value=(None, None),
        ):
            from src.agents import resolve_sandbox_backend

            result_backend, sandbox = resolve_sandbox_backend(mock_runtime)

            assert sandbox is None
            assert result_backend is not None
            assert result_backend.routes == {}

    def test_sandbox_cleanup_exception_is_swallowed(self):
        """When sandbox.stop() throws, the exception is silently swallowed."""
        mock_sandbox = MagicMock()
        mock_sandbox.stop.side_effect = RuntimeError("cleanup failed")
        mock_daytona_backend = MagicMock()
        mock_runtime = MagicMock()

        with (
            patch(
                "src.agents.create_daytona_backend",
                return_value=(mock_sandbox, mock_daytona_backend),
            ),
            patch(
                "src.agents.daytona.validate_daytona_execute_capability",
                return_value=(False, "not capable"),
            ),
        ):
            from src.agents import resolve_sandbox_backend

            # Should not raise
            cleanup_backend, sandbox = resolve_sandbox_backend(mock_runtime)

            assert sandbox is None
            assert cleanup_backend is not None
            assert cleanup_backend.routes == {}
            mock_sandbox.stop.assert_called_once()

    def test_silent_fallback_no_messages(self):
        """Fallback produces no SystemMessage, no SSE events, no log messages about fallback."""
        mock_runtime = MagicMock()

        with (
            patch(
                "src.agents.create_daytona_backend",
                return_value=(None, None),
            ),
            patch("src.agents.logger") as mock_logger,
        ):
            from src.agents import resolve_sandbox_backend

            result_backend, sandbox = resolve_sandbox_backend(mock_runtime)

            assert sandbox is None
            assert result_backend is not None
            assert result_backend.routes == {}
            # No fallback warning/info logged — fallback is completely silent
            mock_logger.warning.assert_not_called()
            mock_logger.info.assert_not_called()


class TestResolveSandboxBackendDispatch:
    """Tests for sandbox_type dispatch in resolve_sandbox_backend()."""

    def test_auto_uses_daytona_when_available(self):
        """sandbox_type=None (auto) uses Daytona when it is available."""
        mock_sandbox = MagicMock()
        mock_daytona_backend = MagicMock()
        mock_daytona_backend.execute = MagicMock()
        mock_runtime = MagicMock()

        with (
            patch(
                "src.agents.create_daytona_backend",
                return_value=(mock_sandbox, mock_daytona_backend),
            ),
            patch(
                "src.agents.daytona.validate_daytona_execute_capability",
                return_value=(True, None),
            ),
        ):
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime, sandbox_type=None)

            assert sandbox is mock_sandbox
            assert backend is not None

    def test_auto_falls_back_to_state(self):
        """sandbox_type=None (auto) falls back to StateBackend when Daytona is unavailable."""
        mock_runtime = MagicMock()

        with patch(
            "src.agents.create_daytona_backend",
            return_value=(None, None),
        ):
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime, sandbox_type=None)

            assert sandbox is None
            assert backend is not None
            assert backend.routes == {}

    def test_explicit_state_skips_daytona(self):
        """sandbox_type='state' never calls create_daytona_backend."""
        mock_runtime = MagicMock()

        with patch(
            "src.agents.create_daytona_backend",
        ) as mock_create_daytona:
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime, sandbox_type="state")

            assert sandbox is None
            assert backend is not None
            assert backend.routes == {}
            mock_create_daytona.assert_not_called()

    def test_explicit_daytona_falls_back_gracefully(self):
        """sandbox_type='daytona' falls back to StateBackend if Daytona is unavailable."""
        mock_runtime = MagicMock()

        with patch(
            "src.agents.create_daytona_backend",
            return_value=(None, None),
        ):
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime, sandbox_type="daytona")

            assert sandbox is None
            assert backend is not None
            assert backend.routes == {}

    def test_explicit_local_returns_local_sandbox_backend(self):
        """sandbox_type='local' returns a LocalSandbox-backed CompositeBackend."""
        mock_runtime = MagicMock()

        with patch(
            "src.agents.create_daytona_backend",
        ) as mock_create_daytona:
            from src.agents import resolve_sandbox_backend

            backend, sandbox = resolve_sandbox_backend(mock_runtime, sandbox_type="local")

            assert sandbox is None
            assert backend is not None
            assert backend.routes == {}
            mock_create_daytona.assert_not_called()

            # Verify the default backend is a LocalSandbox instance
            from src.agents.local_sandbox import LocalSandbox

            assert isinstance(backend.default, LocalSandbox)


class TestLocalSandbox:
    """Tests for LocalSandbox."""

    def test_execute_runs_command(self, tmp_path):
        """execute() runs a shell command and returns output."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)
        result = sandbox.execute("echo hello")

        assert result.exit_code == 0
        assert "hello" in result.output
        assert result.truncated is False

    def test_execute_returns_nonzero_on_failure(self, tmp_path):
        """execute() returns non-zero exit code on command failure."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)
        result = sandbox.execute("exit 42")

        assert result.exit_code == 42

    def test_execute_runs_in_workspace_dir(self, tmp_path):
        """execute() uses the workspace as cwd."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)
        result = sandbox.execute("pwd")

        assert result.exit_code == 0
        assert str(tmp_path) in result.output

    def test_id_returns_hex_string(self, tmp_path):
        """id property returns a non-empty hex string."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)

        assert isinstance(sandbox.id, str)
        assert len(sandbox.id) == 32  # uuid4().hex is 32 chars

    def test_upload_and_download_files(self, tmp_path):
        """upload_files writes bytes; download_files reads them back."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)

        upload_resp = sandbox.upload_files([("/test.txt", b"hello world")])
        assert len(upload_resp) == 1
        assert upload_resp[0].error is None
        assert upload_resp[0].path == "/test.txt"

        download_resp = sandbox.download_files(["/test.txt"])
        assert len(download_resp) == 1
        assert download_resp[0].error is None
        assert download_resp[0].content == b"hello world"

    def test_upload_creates_parent_dirs(self, tmp_path):
        """upload_files creates intermediate directories."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)

        resp = sandbox.upload_files([("/a/b/c/file.txt", b"nested")])
        assert resp[0].error is None
        assert (tmp_path / "a" / "b" / "c" / "file.txt").read_bytes() == b"nested"

    def test_download_missing_file_returns_error(self, tmp_path):
        """download_files returns file_not_found for missing files."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)
        resp = sandbox.download_files(["/nonexistent.txt"])

        assert len(resp) == 1
        assert resp[0].error == "file_not_found"
        assert resp[0].content is None

    def test_invalid_path_without_leading_slash(self, tmp_path):
        """Paths not starting with '/' return invalid_path error."""
        from src.agents.local_sandbox import LocalSandbox

        sandbox = LocalSandbox(root_dir=tmp_path)

        upload_resp = sandbox.upload_files([("no_slash.txt", b"data")])
        assert upload_resp[0].error == "invalid_path"

        download_resp = sandbox.download_files(["no_slash.txt"])
        assert download_resp[0].error == "invalid_path"
