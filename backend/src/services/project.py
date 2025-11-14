from typing import Any, Optional
from uuid import uuid4
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.documents import Document
from src.services.db import get_store_in_memory
from src.utils.logger import logger
from pydantic import BaseModel
from datetime import datetime

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    documents: list[Document]
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class ProjectSearch(BaseModel):
    query: str
    limit: int = 20
    offset: int = 0
    filter: dict = {}

class ProjectService:
    def __init__(self, 
        user_id: str, 
        store: BaseStore = get_store_in_memory()
    ):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self, project_id: str):
        return (self.user_id, "projects", project_id)

    async def _set_doc(self, project_id: str, key: str, value: Document) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(project_id), key=key, value=value.model_dump()
        )
        return True
    
    async def add_docs(self, project_id: str, docs: list[Document]) -> bool:
        for doc in docs:    
            try:
                await self._set_doc(project_id, str(uuid4()), doc)
            except Exception as e:
                logger.error(f"Error adding doc: {e}")
                raise e
        return True
    
    async def get_doc(self, project_id: str, doc_id: str) -> Any:
        return await self.store.aget(self._get_namespace(project_id), doc_id)

    async def delete_doc(self, project_id: str, doc_id: str) -> bool:
        await self.store.adelete(self._get_namespace(project_id), doc_id)
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