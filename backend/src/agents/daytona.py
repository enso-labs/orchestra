"""Daytona sandbox helpers for the agents module."""

from typing import Any


def validate_daytona_execute_capability(backend: Any) -> tuple[bool, str | None]:
    """Check whether a Daytona backend supports the execute() method.

    Returns ``(True, None)`` when the backend is capable, or
    ``(False, reason)`` explaining why it is not.
    """
    if backend is None:
        return False, "backend is None"

    if not callable(getattr(backend, "execute", None)):
        return False, "backend does not support execute()"

    return True, None
