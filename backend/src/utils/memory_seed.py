from langgraph.store.base import BaseStore

from src.constants.default_memories import DEFAULT_MEMORIES
from src.repos.memory_repo import MemoryRepo
from src.utils.logger import logger


async def seed_default_memories(user_id: str, store: BaseStore) -> int:
    """Seed default memories for a user, adding only the ones they're missing.

    Returns the count of memories added.
    """
    repo = MemoryRepo(user_id=user_id, store=store)
    added = 0

    for memory_def in DEFAULT_MEMORIES:
        memory_id = memory_def["id"]
        existing = await repo.get(memory_id)
        if existing is None:
            await repo.create(content=memory_def["content"], path=memory_id)
            added += 1
            logger.info(f"Seeded default memory '{memory_id}' for user {user_id}")

    if added > 0:
        logger.info(f"Seeded {added} default memories for user {user_id}")
    else:
        logger.debug(f"All default memories already exist for user {user_id}")

    return added
