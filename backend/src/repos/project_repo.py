from datetime import datetime
from uuid import uuid4
from langgraph.store.base import BaseStore, SearchItem
from src.repos.base_repo import BaseRepo
from src.schemas.entities import Document, SearchFilter
from src.repos.source_repo import Source, SourceRepo
from src.repos.doc_repo import DocRepo
from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.schemas.entities.store import Project


class ProjectRepo(BaseRepo):
    def __init__(self, user_id: str, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store
        self.source_repo = SourceRepo(user_id=user_id, store=store)
        super().__init__(user_id=user_id, store=store, entity_type="projects")

    def _format_project(self, project: SearchItem) -> Project:
        return Project.model_validate(dict(project.value))

    ##################################################################
    ## Project Repo Methods
    ##################################################################
    async def search(self, search_filter: SearchFilter) -> list[Project]:
        projects: list[SearchItem] = await self._search(search_filter)
        return [Project.model_validate(project.value) for project in projects]

    async def create(self, project: Project) -> Project:
        try:
            project.id = str(uuid4())
            project.created_at = datetime.now()
            project.updated_at = datetime.now()
            created = await self._set(key=project.id, value=project)
            if created:
                return project
            else:
                raise Exception("Failed to create source")
        except Exception as e:
            logger.error(f"Error adding source: {e}")
            raise e

    ##################################################################
    ## Source Repo Methods
    ##################################################################
    async def add_source(self, project_id: str, source: Source) -> bool:
        return await self.source_repo.create(project_id, source)

    async def list_sources(self, project_id: str) -> list[Source]:
        return await self.source_repo.list(project_id)

    async def delete_source(self, project_id: str, source_id: str) -> bool:
        return await self.source_repo.delete(project_id, source_id)

    ##################################################################
    ## Document Repo Methods
    ##################################################################
    async def query_documents(self, project_id: str, query: str) -> list[Document]:
        doc_repo = self.source_repo.doc_repo
        return await doc_repo._search(
            SearchFilter(
                query=query,
                filter={"metadata": {"$eq": {"project_id": project_id}}},
                limit=10,
                offset=0,
            )
        )

    async def list_documents(self, source_id: str) -> list[Document]:
        item: SearchItem = await self.source_repo._get(source_id)
        source: Source = Source.model_validate(item.value)
        documents: list[Document] = []
        for doc_id in source.documents:
            doc: SearchItem = await self.source_repo.doc_repo._get(doc_id)
            doc: Document = Document.model_validate(doc.value)
            documents.append(doc)
        return documents
