"""TaskIQ task for heartbeat tick execution.

This module defines the background task that the TaskIQ scheduler invokes
periodically to run a heartbeat tick for a given user.
"""

from src.workers.broker import broker
from src.utils.logger import logger


@broker.task(task_name="run_heartbeat_tick")
async def run_heartbeat_tick(user_id: str) -> dict:
    """Execute a single heartbeat tick for the given user.

    Called periodically by the TaskIQ scheduler. Creates a HeartbeatService
    with a fresh store connection and runs tick().

    Args:
        user_id: The user whose heartbeat config to evaluate.

    Returns:
        dict: The HeartbeatTickResult serialized as JSON-compatible dict.
    """
    from src.services.heartbeat import HeartbeatService
    from src.services.db import get_store_db

    async with get_store_db() as store:
        service = HeartbeatService(user_id=user_id, store=store)
        result = await service.tick()
        logger.info(f"Heartbeat tick completed for user {user_id}: action={result.action}")
        return result.model_dump(mode="json")
