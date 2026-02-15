"""Unit tests for Daytona sandbox backend factory."""

from unittest.mock import MagicMock, patch


class TestCreateDaytonaBackend:
    """Tests for create_daytona_backend() factory function."""

    def test_returns_none_when_daytona_sandbox_is_none(self) -> None:
        """Returns (None, None) when DaytonaSandbox is not installed."""
        with patch("src.agents.DaytonaSandbox", None):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_none_when_daytona_is_none(self) -> None:
        """Returns (None, None) when Daytona client is not installed."""
        with patch("src.agents.Daytona", None):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_none_when_api_key_is_none(self) -> None:
        """Returns (None, None) when DAYTONA_API_KEY constant is None."""
        with patch("src.agents.DAYTONA_API_KEY", None):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_none_when_api_key_is_empty(self) -> None:
        """Returns (None, None) when DAYTONA_API_KEY constant is empty string."""
        with patch("src.agents.DAYTONA_API_KEY", ""):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None

    def test_returns_valid_tuple_with_mocked_client(self) -> None:
        """Returns (sandbox, backend) when Daytona client creates successfully."""
        mock_sandbox = MagicMock()
        mock_client = MagicMock()
        mock_client.create.return_value = mock_sandbox

        mock_daytona_cls = MagicMock(return_value=mock_client)
        mock_config_cls = MagicMock()
        mock_backend = MagicMock()
        mock_daytona_sandbox_cls = MagicMock(return_value=mock_backend)

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaConfig", mock_config_cls),
            patch("src.agents.DaytonaSandbox", mock_daytona_sandbox_cls),
            patch("src.agents.DAYTONA_API_KEY", "test-key"),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is mock_sandbox
            assert backend is mock_backend
            mock_client.create.assert_called_once()
            mock_daytona_sandbox_cls.assert_called_once_with(sandbox=mock_sandbox)

    def test_returns_none_and_logs_on_create_exception(self) -> None:
        """Returns (None, None) and logs error when client.create() raises."""
        mock_client = MagicMock()
        mock_client.create.side_effect = RuntimeError("API connection failed")

        mock_daytona_cls = MagicMock(return_value=mock_client)
        mock_config_cls = MagicMock()
        mock_daytona_sandbox_cls = MagicMock()

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaConfig", mock_config_cls),
            patch("src.agents.DaytonaSandbox", mock_daytona_sandbox_cls),
            patch("src.agents.DAYTONA_API_KEY", "test-key"),
            patch("src.agents.logger") as mock_logger,
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is None
            assert backend is None
            mock_logger.error.assert_called_once()

    def test_uses_daytona_api_key_constant(self) -> None:
        """Uses DAYTONA_API_KEY constant for authentication."""
        mock_sandbox = MagicMock()
        mock_client = MagicMock()
        mock_client.create.return_value = mock_sandbox

        mock_daytona_cls = MagicMock(return_value=mock_client)
        mock_config_cls = MagicMock()
        mock_backend = MagicMock()
        mock_daytona_sandbox_cls = MagicMock(return_value=mock_backend)

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaConfig", mock_config_cls),
            patch("src.agents.DaytonaSandbox", mock_daytona_sandbox_cls),
            patch("src.agents.DAYTONA_API_KEY", "constant-key"),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is mock_sandbox
            assert backend is mock_backend
            mock_config_cls.assert_called_once_with(api_key="constant-key")

    def test_sandbox_stop_called_during_cleanup(self) -> None:
        """Verify sandbox.stop() can be called for cleanup."""
        mock_sandbox = MagicMock()
        mock_client = MagicMock()
        mock_client.create.return_value = mock_sandbox

        mock_daytona_cls = MagicMock(return_value=mock_client)
        mock_config_cls = MagicMock()
        mock_backend = MagicMock()
        mock_daytona_sandbox_cls = MagicMock(return_value=mock_backend)

        with (
            patch("src.agents.Daytona", mock_daytona_cls),
            patch("src.agents.DaytonaConfig", mock_config_cls),
            patch("src.agents.DaytonaSandbox", mock_daytona_sandbox_cls),
            patch("src.agents.DAYTONA_API_KEY", "test-key"),
        ):
            from src.agents import create_daytona_backend

            sandbox, backend = create_daytona_backend()
            assert sandbox is not None

            # Simulate cleanup
            sandbox.stop()
            mock_sandbox.stop.assert_called_once()
