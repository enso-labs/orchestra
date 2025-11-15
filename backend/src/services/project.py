from typing import Any, Optional
from uuid import uuid4
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.documents import Document
from src.services.db import get_store_in_memory
from src.utils.logger import logger
from pydantic import BaseModel
from datetime import datetime
from src.services.source import SourceService, Source

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
        store: BaseStore = get_store_in_memory(fields=["page_content", "metadata"])
    ):
        self.user_id = user_id
        self.store: BaseStore = store
        self.source_service = SourceService(user_id=user_id, store=store)

    def _get_namespace(self):
        return (self.user_id, "projects")

    async def _set_doc(self, doc_id: str, doc: Document) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(), key=doc_id, value=doc.model_dump()
        )
        return True
    
    async def add_docs(self, project_id: str, docs: list[Document]) -> bool:
        for doc in docs:    
            try:
                doc.id = str(uuid4())
                await self._set_doc(project_id, doc.id, doc)
            except Exception as e:
                logger.error(f"Error adding doc: {e}")
                raise e
        return True
    
    async def get_doc(self, project_id: str, doc_id: str) -> Any:
        return await self.store.aget(self._get_namespace(project_id), doc_id)

    async def delete_doc(self, project_id: str, doc_id: str) -> bool:
        await self.store.adelete(self._get_namespace(project_id), doc_id)
        return True
    
    async def add_sources(self, project_id: str, sources: list[Source]) -> list[Document]:
        added_sources: list[Source] = []
        for source in sources:
            source: Source = await self.source_service.create(
                project_id=project_id, source=source
            )
            if source.docs:
                added = await self.add_docs(project_id, source.docs)
                if added:
                    added_sources.append(source)
            return added_sources
    
    async def delete_source(self, project_id: str, source_id: str) -> bool:
        docs: list[Document] = await self.search_docs(project_id=project_id, filter={
            "metadata": {
                "source_id": source_id,
            },
        })
        for doc in docs:
            await self.delete_doc(project_id, doc.id)
        return await self.source_service.delete(source_id)
    
    async def get_sources(self, project_id: str) -> list[Source]:
        sources: list[SearchItem] = await self.source_service.search(filter={
            "metadata": {
                "project_id": project_id,
            },
        })
        return sources
    
    
    def _format_docs(self, docs: list[SearchItem]) -> list[Document]:
        return [
            Document(
                page_content=doc.value["page_content"],
                metadata={**doc.value["metadata"], "score": doc.score}
            ) for doc in docs
        ]


    async def search(
        self,
        query: str = None,
        filter: dict = {},
        limit: int = 20,
        offset: int = 0,
    ) -> list[Project]:
        results = await self.store.asearch(
            self._get_namespace(),
            query=query,
            filter=filter,
            limit=limit,
            offset=offset
        )
        return results

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
        return self._format_docs(results)