"""Correlation-ID propagation for distributed agent runs.

A correlation ID (the run's ``run_id``) is bound into a ContextVar at the start
of a worker task and read back when structured log lines are emitted, so every
log entry for a run can be traced back to the originating request.

Tiny and dependency-free on purpose: only the standard-library ``contextvars``.
"""

from contextvars import ContextVar, Token

# Per-context store for the active correlation ID. Defaults to None outside any
# bound run. ContextVar isolation means concurrent worker tasks (each in its own
# context) never see each other's correlation ID.
correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def get_correlation_id() -> str | None:
    """Return the correlation ID bound in the current context, or None."""
    return correlation_id.get()


def set_correlation_id(value: str | None) -> Token:
    """Bind ``value`` as the current correlation ID.

    Returns the ContextVar ``Token`` so the caller can reset the binding in a
    ``finally`` (via :func:`reset_correlation_id`) and avoid leaking the value
    across worker tasks that reuse the same context.
    """
    return correlation_id.set(value)


# Alias for callers that prefer the verb "bind".
bind_correlation_id = set_correlation_id


def reset_correlation_id(token: Token) -> None:
    """Restore the correlation ID to its prior value using ``token``."""
    correlation_id.reset(token)
