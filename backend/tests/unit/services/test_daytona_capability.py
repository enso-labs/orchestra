from src.agents.daytona import (
    DAYTONA_BACKEND_UNAVAILABLE_REASON,
    DAYTONA_EXECUTE_MISSING_REASON,
    daytona_fallback_message,
    validate_daytona_execute_capability,
)


class BackendWithExecute:
    def execute(self, *args, **kwargs):
        return None


def test_validate_daytona_execute_capability_supported() -> None:
    capability = validate_daytona_execute_capability(BackendWithExecute())

    assert capability.supported is True
    assert capability.reason is None


def test_validate_daytona_execute_capability_missing_backend() -> None:
    capability = validate_daytona_execute_capability(None)

    assert capability.supported is False
    assert capability.reason == DAYTONA_BACKEND_UNAVAILABLE_REASON


def test_validate_daytona_execute_capability_missing_execute() -> None:
    capability = validate_daytona_execute_capability(object())

    assert capability.supported is False
    assert capability.reason == DAYTONA_EXECUTE_MISSING_REASON


def test_daytona_fallback_message_includes_reason() -> None:
    msg = daytona_fallback_message(DAYTONA_EXECUTE_MISSING_REASON)

    assert DAYTONA_EXECUTE_MISSING_REASON in msg
    assert "falling back to default sandbox" in msg
