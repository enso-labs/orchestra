"""TaskIQ distributed workers package for Orchestra.

This package provides distributed task processing capabilities using TaskIQ
with PostgreSQL as the message broker.

Usage:
    # Start worker(s):
    taskiq worker src.workers.tasks:broker

    # From API code, enqueue tasks:
    from src.workers.tasks import run_agent_stream
    await run_agent_stream.kiq(task_dict, user_id, thread_id, config_dict)
"""

from src.workers.broker import broker, POSTGRES_DSN
from src.workers.tasks import run_agent_stream

__all__ = ["broker", "run_agent_stream", "POSTGRES_DSN"]
