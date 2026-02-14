"""Unit tests for validate_daytona_execute_capability()."""

from unittest.mock import MagicMock

from src.agents.daytona import validate_daytona_execute_capability


class TestValidateDaytonaExecuteCapability:
    """Tests for validate_daytona_execute_capability()."""

    def test_returns_true_when_execute_is_callable(self):
        """Backend with a callable execute() method is supported."""
        backend = MagicMock()
        backend.execute = MagicMock()

        supported, reason = validate_daytona_execute_capability(backend)

        assert supported is True
        assert reason is None

    def test_returns_false_when_backend_is_none(self):
        """None backend is not supported."""
        supported, reason = validate_daytona_execute_capability(None)

        assert supported is False
        assert reason == "backend is None"

    def test_returns_false_when_execute_not_present(self):
        """Backend without execute attribute is not supported."""
        backend = MagicMock(spec=[])  # no attributes

        supported, reason = validate_daytona_execute_capability(backend)

        assert supported is False
        assert reason == "backend does not support execute()"

    def test_returns_false_when_execute_is_not_callable(self):
        """Backend where execute is not callable is not supported."""
        backend = MagicMock()
        backend.execute = "not-a-callable"

        supported, reason = validate_daytona_execute_capability(backend)

        assert supported is False
        assert reason == "backend does not support execute()"
