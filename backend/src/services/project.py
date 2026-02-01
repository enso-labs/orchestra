from langgraph.store.base import BaseStore
from src.services.db import get_store_in_memory
from src.repos.project_repo import Project, ProjectRepo
from src.schemas.entities import SearchFilter
from src.repos.source_repo import Source
from src.repos.project_repo import *


class ProjectService:
    def __init__(self, user_id: str, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store
        self.project_repo = ProjectRepo(user_id=user_id, store=store)

    ##########################################################################
    # Project Service Methods
    ##########################################################################
    async def search(self, search_filter: SearchFilter) -> list[Project]:
        return [
            Project.model_validate(project.value)
            for project in await self.project_repo._search(search_filter)
        ]

    async def create(self, project: Project) -> Project:
        return await self.project_repo.create(project)

    async def get(self, project_id: str) -> Project:
        sources: list[Source] = await self.get_sources(project_id)
        item = await self.project_repo._get(project_id)
        if not item:
            raise ValueError(f"Project {project_id} not found")
        project = self.project_repo._format_project(item)
        project.sources = sources
        return project

    async def delete(self, project_id: str) -> bool:
        try:
            sources: list[Source] = await self.get_sources(project_id)
            for source in sources:
                logger.info(f"Deleting source {source.id} for project {project_id}")
                await self.project_repo.source_repo._delete(source.id)
            return await self.project_repo._delete(project_id)
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            raise e
        finally:
            logger.info(f"Project {project_id} deleted successfully")

    async def update(self, project_id: str, data: dict) -> Project:
        """Update project name and/or description."""
        return await self.project_repo.update(project_id, data)

    ##########################################################################
    # Source Service Methods
    ##########################################################################
    async def add_sources(self, project_id: str, sources: list[Source]) -> bool:
        return await self.project_repo.source_repo.create(project_id, sources)

    async def get_sources(self, project_id: str) -> list[Source]:
        all_sources = await self.project_repo.source_repo.search(
            SearchFilter(
                filter={"metadata": {"$eq": {"project_id": project_id}}},
                limit=200,
                offset=0,
            )
        )
        return all_sources

    async def delete_source(self, source_id: str) -> bool:
        result: SearchItem = await self.project_repo.source_repo._get(source_id)
        if not result:
            raise ValueError(f"Source {source_id} not found")
        source: Source = Source.model_validate(result.value)

        if source.documents:
            for doc in source.documents:
                await self.project_repo.source_repo.doc_repo._delete(doc)
                logger.info(f"Deleted document {doc} for source {source_id}")
        return await self.project_repo.source_repo._delete(source_id)
