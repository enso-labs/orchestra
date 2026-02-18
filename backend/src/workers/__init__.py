"""TaskIQ distributed workers package for Orchestra.

This package provides distributed task processing capabilities using TaskIQ
with Redis Streams as the message broker.

When DISTRIBUTED_WORKERS=false (default), TaskIQ is not imported and the
workers package exposes no symbols. This allows running Orchestra locally
without taskiq or taskiq-redis installed.

Usage (distributed mode only):
    # Start worker(s):
    taskiq worker src.workers.tasks:broker

    # From API code, enqueue tasks:
    from src.workers.tasks import run_agent_stream
    await run_agent_stream.kiq(task_dict, user_id, thread_id, config_dict)
"""

from src.constants import DISTRIBUTED_WORKERS

if DISTRIBUTED_WORKERS:
    from src.workers.broker import broker
    from src.workers.tasks import run_agent_stream

    __all__ = ["broker", "run_agent_stream"]
else:
    __all__ = []
