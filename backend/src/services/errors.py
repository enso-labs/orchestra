"""Custom exception hierarchy for checkpoint operations.

This module provides:
- Base exception class with message sanitization
- Retryable vs permanent error classification
- Helper function to classify psycopg exceptions

Security note: Error messages are sanitized to prevent exposure of
connection strings, credentials, or internal database details.
"""

import asyncio
import re
from typing import Optional, Type

import psycopg


class CheckpointError(Exception):
    """Base exception for checkpoint operations."""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        self.message = self._sanitize_message(message)
        self.original_error = original_error
        super().__init__(self.message)

    @staticmethod
    def _sanitize_message(message: str) -> str:
        """Remove potential sensitive data from error messages.

        Removes:
        - Full PostgreSQL connection strings
        - Password parameters
        - Host information
        """
        patterns = [
            r"postgresql://[^\s]+",  # Full connection strings
            r"postgres://[^\s]+",  # Alternative prefix
            r"password=[^\s&]+",  # Password parameters
            r"host=[^\s&]+",  # Host information
            r"user=[^\s&]+",  # User information
        ]
        sanitized = message
        for pattern in patterns:
            sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.IGNORECASE)
        return sanitized


class RetryableCheckpointError(CheckpointError):
    """Error that may succeed on retry (connection issues, timeouts).

    These errors indicate transient failures that can potentially
    be resolved by reconnecting and retrying the operation.

    Examples:
    - SSL connection closed unexpectedly
    - Connection reset by peer
    - Network unreachable (transient)
    - Connection timed out
    """

    pass


class PermanentCheckpointError(CheckpointError):
    """Error that will not succeed on retry (auth failures, query errors).

    These errors indicate fundamental issues that require
    configuration changes or code fixes to resolve.

    Examples:
    - Authentication failed
    - Permission denied
    - Database does not exist
    - Syntax errors
    """

    pass


class CheckpointDegradedError(CheckpointError):
    """Checkpoint operation completed but using fallback (in-memory).

    Raised when the primary Postgres checkpointer is unavailable
    and the system has fallen back to in-memory storage.
    """

    pass


class CheckpointConnectionError(CheckpointError):
    """Checkpoint connection cannot be established or recovered.

    Raised when all retry attempts have been exhausted and
    no fallback is available.
    """

    pass


# Error patterns for classification
RETRYABLE_PATTERNS = [
    "ssl connection has been closed",
    "connection closed unexpectedly",
    "connection refused",
    "connection reset",
    "broken pipe",
    "consuming input failed",
    "timeout",
    "connection timed out",
    "server closed the connection",
    "network is unreachable",
    "no route to host",
    "connection aborted",
    "eof detected",
]

PERMANENT_PATTERNS = [
    r"authentication failed",
    r"password authentication failed",
    r"permission denied",
    r"role .* does not exist",
    r"database .* does not exist",
    r"relation .* does not exist",
    r"column .* does not exist",
    r"syntax error",
]


def classify_checkpoint_error(error: Exception) -> Type[CheckpointError]:
    """Classify an exception as retryable or permanent.

    This function examines the exception type and message to determine
    whether the error is likely to succeed on retry or is permanent.

    Args:
        error: The exception to classify

    Returns:
        The appropriate CheckpointError subclass to wrap the error:
        - RetryableCheckpointError for transient failures
        - PermanentCheckpointError for fatal errors

    Examples:
        >>> classify_checkpoint_error(psycopg.OperationalError("SSL connection has been closed"))
        <class 'RetryableCheckpointError'>
        >>> classify_checkpoint_error(psycopg.OperationalError("authentication failed"))
        <class 'PermanentCheckpointError'>
    """
    # Honor already-classified errors: a RetryableCheckpointError /
    # PermanentCheckpointError carries its verdict in its type. Re-deriving it
    # from the (sanitized) message would misclassify it as retryable by default.
    if isinstance(error, RetryableCheckpointError):
        return RetryableCheckpointError
    if isinstance(error, PermanentCheckpointError):
        return PermanentCheckpointError

    # Handle psycopg OperationalError (most connection errors)
    if isinstance(error, psycopg.OperationalError):
        error_msg = str(error).lower()

        # Check for permanent errors first (more specific)
        for pattern in PERMANENT_PATTERNS:
            if re.search(pattern, error_msg):
                return PermanentCheckpointError

        # Check for retryable errors
        for pattern in RETRYABLE_PATTERNS:
            if pattern in error_msg:
                return RetryableCheckpointError

        # Default OperationalErrors to retryable (likely network issues)
        return RetryableCheckpointError

    # Programming errors (syntax, missing columns) are permanent
    if isinstance(error, psycopg.ProgrammingError):
        return PermanentCheckpointError

    # Integrity errors (constraint violations) are permanent
    if isinstance(error, psycopg.IntegrityError):
        return PermanentCheckpointError

    # Interface errors could be either, default to retryable
    if isinstance(error, psycopg.InterfaceError):
        return RetryableCheckpointError

    # Timeout errors are retryable
    if isinstance(error, (asyncio.TimeoutError, TimeoutError)):
        return RetryableCheckpointError

    # Connection and OS errors are typically retryable
    if isinstance(error, (ConnectionError, OSError)):
        return RetryableCheckpointError

    # Unknown errors default to retryable for safety
    # This allows the system to attempt recovery before failing
    return RetryableCheckpointError


def is_retryable_error(error: Exception) -> bool:
    """Check if an error should be retried.

    Convenience function for use with retry decorators.

    Args:
        error: The exception to check

    Returns:
        True if the error is retryable, False otherwise
    """
    return classify_checkpoint_error(error) is RetryableCheckpointError
