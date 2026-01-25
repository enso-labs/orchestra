"""TaskIQ PostgreSQL broker configuration for distributed workers.

This module configures the TaskIQ broker with PostgreSQL for reliable
task queuing and result storage. Also provides PostgreSQL DSN for
stream pub/sub and abort signal coordination.

Environment Variables:
    POSTGRES_CONNECTION_STRING: PostgreSQL connection URL
"""

from taskiq.serializers.json_serializer import JSONSerializer
from taskiq_pg import AsyncpgBroker, AsyncpgResultBackend

from src.constants import DB_URI

# Export DSN for other modules (stream, abort service)
POSTGRES_DSN = DB_URI

# Result backend with PostgreSQL
result_backend = AsyncpgResultBackend(
    dsn=DB_URI,
    serializer=JSONSerializer(),
    keep_results=False,  # Clean up results after retrieval
    table_name="taskiq_results",
)

# PostgreSQL broker for task distribution
broker = AsyncpgBroker(
    dsn=DB_URI,
    channel_name="orchestra_tasks",
    table_name="taskiq_messages",
).with_result_backend(result_backend)


# Worker lifecycle hooks for resilient checkpointer
@broker.on_event("startup")
async def on_startup():
    """Initialize worker state on startup.

    This hook is called when a TaskIQ worker process starts.
    It initializes the shared checkpointer instance that will be
    reused across all task executions in this worker.
    """
    from src.workers.state import WorkerState
    from src.constants import CHECKPOINT_USE_RESILIENT

    if CHECKPOINT_USE_RESILIENT:
        await WorkerState.initialize()


@broker.on_event("shutdown")
async def on_shutdown():
    """Cleanup worker state on shutdown.

    This hook is called when a TaskIQ worker process is shutting down.
    It properly closes the checkpointer connection and releases resources.
    """
    from src.workers.state import WorkerState
    from src.constants import CHECKPOINT_USE_RESILIENT

    if CHECKPOINT_USE_RESILIENT:
        await WorkerState.shutdown()
