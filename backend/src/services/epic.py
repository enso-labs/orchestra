from typing import Optional

from langgraph.store.base import BaseStore

from src.repos.epic_repo import EpicRepo
from src.repos.task_repo import TaskRepo
from src.schemas.entities import SearchFilter
from src.schemas.entities.store import Epic, Task
from src.services.db import get_store_in_memory
from src.utils.logger import logger


class EpicService:
    def __init__(self, user_id: str, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store
        self.epic_repo = EpicRepo(user_id=user_id, store=store)
        self.task_repo = TaskRepo(user_id=user_id, store=store)

    ##########################################################################
    # Epic Methods
    ##########################################################################
    async def create_epic(self, epic: Epic) -> Epic:
        return await self.epic_repo.create(epic)

    async def get_epic(self, epic_id: str) -> Optional[Epic]:
        return await self.epic_repo.get(epic_id)

    async def search_epics(self, search_filter: SearchFilter) -> list[Epic]:
        return await self.epic_repo.search(search_filter)

    async def update_epic(self, epic_id: str, data: dict) -> Epic:
        return await self.epic_repo.update(epic_id, data)

    async def delete_epic(self, epic_id: str) -> bool:
        """Delete an epic and cascade delete all its tasks."""
        try:
            tasks = await self.task_repo.list_by_epic(epic_id)
            for task in tasks:
                await self.task_repo.delete(task.id)
                logger.info(f"Deleted task {task.id} for epic {epic_id}")
            return await self.epic_repo.delete(epic_id)
        except Exception as e:
            logger.error(f"Error deleting epic {epic_id}: {e}")
            raise e

    ##########################################################################
    # Task Methods
    ##########################################################################
    async def create_task(self, task: Task) -> Task:
        return await self.task_repo.create(task)

    async def get_task(self, task_id: str) -> Optional[Task]:
        return await self.task_repo.get(task_id)

    async def list_tasks(self, epic_id: str) -> list[Task]:
        return await self.task_repo.list_by_epic(epic_id)

    async def update_task(self, task_id: str, data: dict) -> Task:
        return await self.task_repo.update(task_id, data)

    async def delete_task(self, task_id: str) -> bool:
        return await self.task_repo.delete(task_id)
