from typing import Any, Optional
from uuid import uuid4
from langchain_core.documents import Document
from pydantic import BaseModel
from datetime import datetime
from langgraph.store.base import BaseStore, SearchItem
from src.loaders import Loader
from src.services.db import get_store_in_memory
from src.utils.logger import logger


class Source(BaseModel):
    id: Optional[str] = None
    type: str
    docs: Optional[list[Document]] = None
    metadata: dict = {}
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class SourceSearch(BaseModel):
    query: str
    limit: int = 100
    offset: int = 0
    filter: dict = {}

class SourceService:
    def __init__(self, 
        user_id: str, 
        store: BaseStore = get_store_in_memory(fields=["page_content", "metadata"])
    ):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, "sources")

    async def _set(self, source_id: str, source: Source) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(), key=source_id, value=source.model_dump()
        )
        return True
    
    async def create(self, project_id: str, source: Source) -> bool:
        try:
            source.id = str(uuid4())
            source.metadata["project_id"] = project_id
            source.docs = await self._load_source_to_docs(source, lazy=True)
            source.created_at = datetime.now()
            source.updated_at = datetime.now()
            created = await self._set(source_id=source.id, source=source)
            if created:
                return source
            else:
                raise Exception("Failed to create source")
        except Exception as e:
            logger.error(f"Error adding source: {e}")
            raise e

    async def get(self, source_id: str) -> Any:
        return await self.store.asearch(self._get_namespace(), filter={"id": source_id})

    async def delete(self, source_id: str) -> bool:
        await self.store.adelete(self._get_namespace(), source_id)
        return True

    async def search(
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
        return self._format_sources(results)
    
    def _format_sources(self, sources: list[SearchItem]) -> list[Source]:
        return [self._format_source(source) for source in sources]
    
    def _format_source(self, item: SearchItem) -> Source:
        return Source.model_validate(item.value)
    
    async def _load_source_to_docs(self, source: Source, lazy: bool = False) -> list[Document]:
        loader = Loader.create(source.type, source.metadata)
        docs = []
        if lazy:
            async for doc in loader.alazy_load():
                doc.metadata['source_id'] = source.id
                doc.metadata['project_id'] = source.metadata['project_id']
                docs.append(doc)
        else:
            docs.extend(await loader.aload())
        return docs