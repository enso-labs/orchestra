import time
import functools


def retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,)):
    """
    A decorator to retry a database operation on specified exceptions.

    Args:
        tries (int): The maximum number of retry attempts.
        delay (int): The initial delay in seconds between retries.
        backoff (int): The multiplier for the delay between subsequent retries.
        exceptions (tuple): A tuple of exception types to catch and trigger a retry.
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            mtries, mdelay = tries, delay
            while mtries > 1:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    print(f"Caught exception: {e}. Retrying in {mdelay} seconds...")
                    time.sleep(mdelay)
                    mtries -= 1
                    mdelay *= backoff
            return func(*args, **kwargs)  # Last attempt without catching exceptions

        return wrapper

    return decorator
