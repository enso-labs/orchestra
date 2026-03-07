"""Tests for Daytona error handling helpers and resolve_sandbox_backend return values."""

from unittest.mock import MagicMock, patch

from src.agents import is_daytona_error, resolve_sandbox_backend


class TestIsDaytonaError:
    """Tests for is_daytona_error() helper."""

    def test_returns_true_for_daytona_error(self):
        """When DaytonaError class is available, should detect it."""
        mock_error = type("DaytonaError", (Exception,), {})
        exc = mock_error("test error")
        with patch("src.agents.DaytonaError", mock_error):
            assert is_daytona_error(exc) is True

    def test_returns_false_when_package_not_installed(self):
        """When DaytonaError is None (not installed), always returns False."""
        with patch("src.agents.DaytonaError", None):
            assert is_daytona_error(RuntimeError("anything")) is False

    def test_returns_false_for_non_daytona_exception(self):
        """Regular exceptions should not be detected as DaytonaError."""
        mock_error = type("DaytonaError", (Exception,), {})
        with patch("src.agents.DaytonaError", mock_error):
            assert is_daytona_error(ValueError("not daytona")) is False
            assert is_daytona_error(RuntimeError("nope")) is False


class TestResolveSandboxBackendReturnType:
    """Tests that resolve_sandbox_backend returns 3-tuple with effective_type."""

    def test_state_mode_returns_state_type(self):
        """Explicit 'state' mode should return effective_type='state'."""
        runtime = MagicMock()
        backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type="state")
        assert effective_type == "state"
        assert sandbox is None

    @patch("src.agents._create_daytona_backend_checked", return_value=None)
    def test_auto_mode_fallback_returns_state_type(self, _mock):
        """When Daytona is unavailable in auto mode, should fallback to 'state'."""
        runtime = MagicMock()
        backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type=None)
        assert effective_type == "state"
        assert sandbox is None

    @patch("src.agents._create_daytona_backend_checked")
    def test_auto_mode_daytona_available_returns_daytona_type(self, mock_checked):
        """When Daytona succeeds in auto mode, should return 'daytona'."""
        mock_backend = MagicMock()
        mock_sandbox = MagicMock()
        mock_checked.return_value = (mock_backend, mock_sandbox)
        runtime = MagicMock()
        backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type="auto")
        assert effective_type == "daytona"
        assert sandbox is mock_sandbox

    @patch("src.agents._create_daytona_backend_checked")
    def test_daytona_mode_success_returns_daytona_type(self, mock_checked):
        """Explicit 'daytona' mode with success should return 'daytona'."""
        mock_backend = MagicMock()
        mock_sandbox = MagicMock()
        mock_checked.return_value = (mock_backend, mock_sandbox)
        runtime = MagicMock()
        backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type="daytona")
        assert effective_type == "daytona"

    @patch("src.agents._create_daytona_backend_checked", return_value=None)
    def test_daytona_mode_fallback_returns_state_type(self, _mock):
        """Explicit 'daytona' mode with Daytona unavailable should fallback to 'state'."""
        runtime = MagicMock()
        backend, sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type="daytona")
        assert effective_type == "state"
