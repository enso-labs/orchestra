from typing import Any
from uuid import uuid4
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.documents import Document
from src.services.db import get_in_memory_store
from src.utils.logger import logger

class ProjectService:
    def __init__(self, 
        user_id: str, 
        project_id: str,
        store: BaseStore = get_in_memory_store()
    ):
        self.user_id = user_id
        self.project_id = project_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, "projects", self.project_id)

    async def _set_doc(self, key: str, value: Document) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(), key=key, value=value.model_dump()
        )
        return True
    
    async def add_docs(self, docs: list[Document]) -> bool:
        for doc in docs:    
            try:
                await self._set_doc(str(uuid4()), doc)
            except Exception as e:
                logger.error(f"Error adding doc: {e}")
                raise e
        return True
    
    async def get_doc(self, key: str) -> Any:
        return await self.store.aget(self._get_namespace(), key)

    async def delete_doc(self, key: str) -> bool:
        await self.store.adelete(self._get_namespace(), key)
        return True

    async def search_docs(
        self, 
        query: str = None, 
        filter: dict = {},
        limit: int = 20,
        offset: int = 0,
    ) -> list[SearchItem]:
        results = await self.store.asearch(
            self._get_namespace(), 
            query=query, 
            limit=limit, 
            filter=filter, 
            offset=offset
        )
        return results