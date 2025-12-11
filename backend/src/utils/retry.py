import time
import asyncio
import functools
import inspect

from src.utils.logger import logger


def retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,)):
    """
    A decorator to retry a database operation on specified exceptions.
    Supports both sync and async functions.

    Args:
        tries (int): The maximum number of retry attempts.
        delay (int): The initial delay in seconds between retries.
        backoff (int): The multiplier for the delay between subsequent retries.
        exceptions (tuple): A tuple of exception types to catch and trigger a retry.
    """

    def decorator(func):
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                mtries, mdelay = tries, delay
                while mtries > 1:
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        logger.warning(
                            f"Caught exception: {e}. Retrying in {mdelay} seconds..."
                        )
                        await asyncio.sleep(mdelay)
                        mtries -= 1
                        mdelay *= backoff
                return await func(*args, **kwargs)  # Last attempt without catching

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                mtries, mdelay = tries, delay
                while mtries > 1:
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        logger.warning(
                            f"Caught exception: {e}. Retrying in {mdelay} seconds..."
                        )
                        time.sleep(mdelay)
                        mtries -= 1
                        mdelay *= backoff
                return func(*args, **kwargs)  # Last attempt without catching

            return sync_wrapper

    return decorator
