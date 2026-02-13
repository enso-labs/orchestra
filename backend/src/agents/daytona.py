from dataclasses import dataclass
from typing import Any

DAYTONA_EXECUTE_MISSING_REASON = (
    "Daytona backend is missing execute() support required by deepagents sandbox protocol."
)
DAYTONA_BACKEND_UNAVAILABLE_REASON = "Daytona backend could not be initialized."


@dataclass(frozen=True)
class DaytonaExecuteCapability:
    supported: bool
    reason: str | None = None


def validate_daytona_execute_capability(backend: Any) -> DaytonaExecuteCapability:
    """Validate Daytona backend exposes execute() expected by deepagents."""
    if backend is None:
        return DaytonaExecuteCapability(
            supported=False,
            reason=DAYTONA_BACKEND_UNAVAILABLE_REASON,
        )

    execute = getattr(backend, "execute", None)
    if not callable(execute):
        return DaytonaExecuteCapability(
            supported=False,
            reason=DAYTONA_EXECUTE_MISSING_REASON,
        )

    return DaytonaExecuteCapability(supported=True)


def daytona_fallback_message(reason: str | None = None) -> str:
    """Build deterministic user-facing fallback text for Daytona routing."""
    if reason:
        return (
            "Daytona sandbox unavailable "
            f"({reason})"
            ", falling back to default sandbox."
        )
    return "Daytona sandbox unavailable, falling back to default sandbox."
