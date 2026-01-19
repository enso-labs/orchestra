"""Retry decorator for database operations with exponential backoff.

This module provides a decorator that retries operations on specified exceptions,
with support for:
- Exponential backoff with configurable delay
- Jitter to prevent thundering herd
- Maximum delay cap
- Error classification to skip retry for permanent errors
- Callback hooks for retry and failure events
"""

import asyncio
import functools
import inspect
import random
import time
from typing import Callable, Optional, Tuple, Type

from src.utils.logger import logger


def retry_db_operation(
    tries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    max_delay: float = 30.0,
    jitter: float = 0.1,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
    on_failure: Optional[Callable[[Exception, int], None]] = None,
    classify_error: Optional[Callable[[Exception], bool]] = None,
):
    """
    A decorator to retry a database operation on specified exceptions.
    Supports both sync and async functions.

    Args:
        tries: The maximum number of retry attempts (default: 3)
        delay: The initial delay in seconds between retries (default: 1.0)
        backoff: The multiplier for the delay between subsequent retries (default: 2.0)
        max_delay: Maximum delay cap to prevent excessive waits (default: 30.0)
        jitter: Random factor (0.0-1.0) to add to delay to prevent thundering herd (default: 0.1)
        exceptions: A tuple of exception types to catch and trigger a retry
        on_retry: Optional callback(exception, attempt, delay) called before each retry
        on_failure: Optional callback(exception, attempts) called when all retries exhausted
        classify_error: Optional function that returns True if error is retryable.
                       If provided and returns False, the error will not be retried.

    Example:
        @retry_db_operation(tries=3, delay=1, backoff=2)
        async def fetch_data():
            return await db.query(...)

        # With error classification
        @retry_db_operation(
            tries=3,
            classify_error=lambda e: "connection" in str(e).lower()
        )
        async def fetch_data():
            return await db.query(...)
    """

    def calculate_delay(attempt: int, base_delay: float) -> float:
        """Calculate delay with exponential backoff, cap, and jitter.

        Args:
            attempt: The current attempt number (0-indexed)
            base_delay: The initial delay value

        Returns:
            The calculated delay with backoff, capped at max_delay, plus jitter
        """
        exponential = base_delay * (backoff**attempt)
        capped = min(exponential, max_delay)
        jitter_amount = capped * jitter * random.random()
        return capped + jitter_amount

    def decorator(func):
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                last_exception = None

                for attempt in range(tries):
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        # Check if error should be retried
                        if classify_error is not None and not classify_error(e):
                            logger.warning(
                                f"Non-retryable error in {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, attempt + 1)
                            raise

                        if attempt < tries - 1:
                            current_delay = calculate_delay(attempt, delay)
                            logger.warning(
                                f"Caught exception in {func.__name__}: {e}. "
                                f"Attempt {attempt + 1}/{tries}. "
                                f"Retrying in {current_delay:.2f}s..."
                            )
                            if on_retry:
                                on_retry(e, attempt + 1, current_delay)
                            await asyncio.sleep(current_delay)
                        else:
                            logger.error(
                                f"All {tries} retries exhausted for {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, tries)
                            raise

                # Should not reach here, but raise last exception if we do
                if last_exception:
                    raise last_exception

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                last_exception = None

                for attempt in range(tries):
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        # Check if error should be retried
                        if classify_error is not None and not classify_error(e):
                            logger.warning(
                                f"Non-retryable error in {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, attempt + 1)
                            raise

                        if attempt < tries - 1:
                            current_delay = calculate_delay(attempt, delay)
                            logger.warning(
                                f"Caught exception in {func.__name__}: {e}. "
                                f"Attempt {attempt + 1}/{tries}. "
                                f"Retrying in {current_delay:.2f}s..."
                            )
                            if on_retry:
                                on_retry(e, attempt + 1, current_delay)
                            time.sleep(current_delay)
                        else:
                            logger.error(
                                f"All {tries} retries exhausted for {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, tries)
                            raise

                # Should not reach here, but raise last exception if we do
                if last_exception:
                    raise last_exception

            return sync_wrapper

    return decorator
