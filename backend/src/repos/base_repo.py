from typing import Any
from langgraph.store.base import BaseStore, SearchItem, SearchOp

from src.schemas.entities import SearchFilter
from src.services.db import get_store_in_memory
from src.schemas.entities.store import Source, Project, Document
from src.schemas.entities.auth import ApiToken
from src.schemas.entities.settings import UserSettings
from src.schemas.entities.memory import Memory
from src.schemas.entities.schedule_execution import ScheduleExecution
from src.utils.logger import logger


class BaseRepo:
    def __init__(
        self,
        user_id: str,
        store: BaseStore,
        entity_type: str,
    ):
        # Ensure user_id is always a string (convert UUID if needed)
        self.user_id = str(user_id)
        self.entity_type = entity_type
        self.store: BaseStore = store or get_store_in_memory()

    def _get_namespace(self):
        return (self.user_id, self.entity_type)

    async def _set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(),
            key=key,
            value=value.model_dump(exclude_none=True, mode="json"),
            ttl=ttl,
        )
        logger.info(f"Set {self.entity_type} {key} successfully")
        return True

    def _format(self, item: SearchItem) -> Any:
        if self.entity_type == "documents":
            return Document.model_validate(item.value)
        elif self.entity_type == "sources":
            return Source.model_validate(item.value)
        elif self.entity_type == "projects":
            return Project.model_validate(item.value)
        elif self.entity_type == "api_tokens":
            return ApiToken.model_validate(item.value)
        elif self.entity_type == "user_settings":
            return UserSettings.model_validate(item.value)
        elif self.entity_type == "memories":
            return Memory.model_validate(item.value)
        elif self.entity_type == "schedule_executions":
            return ScheduleExecution.model_validate(item.value)
        else:
            raise ValueError(f"Invalid entity type: {self.entity_type}")

    async def _delete(self, key: str) -> bool:
        await self.store.adelete(self._get_namespace(), key)
        return True

    async def _get(self, key: str) -> Any:
        return await self.store.aget(self._get_namespace(), key)

    async def _search(
        self,
        search_filter: SearchOp | SearchFilter,
    ) -> list[SearchItem]:
        return await self.store.asearch(
            self._get_namespace(),
            query=search_filter.query,
            filter=search_filter.filter,
            limit=search_filter.limit,
            offset=search_filter.offset,
        )
