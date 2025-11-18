from langgraph.store.base import BaseStore, SearchItem
from src.schemas.entities.store import Source
from src.services.db import get_store_in_memory
from langchain_core.documents import Document
from uuid import uuid4
from src.utils.logger import logger
from src.repos.base_repo import BaseRepo
from src.loaders import Loader


class DocRepo(BaseRepo):
    def __init__(
        self,
        user_id: str,
        store: BaseStore = get_store_in_memory(fields=["page_content", "metadata"]),
    ):
        super().__init__(user_id=user_id, store=store, entity_type="documents")

    def _format_docs(self, docs: list[SearchItem]) -> list[Document]:
        return [
            Document(
                page_content=doc.value["page_content"],
                metadata={**doc.value["metadata"], "score": doc.score},
            )
            for doc in docs
        ]

    async def _load_source_to_docs(
        self, source: Source, lazy: bool = True
    ) -> list[Document]:
        loader = Loader.create(source.type, source.content)
        doc_ids = []
        if lazy:
            async for doc in loader.alazy_load():
                doc.id = str(uuid4())
                doc.metadata = {
                    "project_id": source.metadata["project_id"],
                }
                await self._set(key=doc.id, value=doc)
                doc_ids.append(doc.id)
        else:
            doc_ids.extend(await loader.aload())
        return doc_ids

    ##################################################################
    ## Document CRUD Methods
    ##################################################################
    async def docs_from_sources(self, source: Source) -> Source:
        try:
            doc_ids = await self._load_source_to_docs(source, lazy=True)
            logger.info(f"Loaded {len(doc_ids)} documents from source {source.id}")
            source.documents = doc_ids
            return source
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            raise e
