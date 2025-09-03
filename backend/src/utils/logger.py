from loguru import logger
import sys
from datetime import datetime

from src.constants import APP_LOG_LEVEL

# Define a log format that is readable and user-friendly
LOG_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
    "<level>{exception}</level>"  # Add exception/stacktrace to format
)

# Add a console handler for terminal logging
logger.remove()  # Remove the default handler
logger.add(
    sys.stdout,
    format=LOG_FORMAT,
    level=APP_LOG_LEVEL,  # Change to DEBUG for verbose output
    colorize=True,
    backtrace=True,  # Show error backtraces for easier debugging
    # diagnose=True,   # Show variable values in tracebacks
    # catch=True,      # Catch exceptions and show full traceback
)

# Add a file handler for logging to a file with rotation
# logger.add(
#     f"logs/log_{datetime.now().strftime('%Y%m%d')}.log",
#     format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}\n{exception}",
#     rotation="10 MB",  # Rotate log files when they reach 10 MB
#     retention="7 days",  # Keep logs for 7 days
#     compression="zip",  # Compress old logs
#     level="DEBUG",  # Capture all levels in the log file
#     backtrace=True,  # Show error backtraces in file logs too
#     diagnose=True,   # Show variable values in file logs
#     catch=True       # Catch exceptions in file logs
# )

# Expose the logger for use in other files
__all__ = ["logger"]