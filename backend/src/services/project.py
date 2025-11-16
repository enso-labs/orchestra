from langgraph.store.base import BaseStore
from src.services.db import get_store_in_memory
from src.repos.project_repo import Project, ProjectRepo
from src.schemas.entities import SearchFilter
from src.repos.source_repo import Source
from src.repos.project_repo import *

class ProjectService:
    def __init__(self, 
        user_id: str, 
        store: BaseStore = get_store_in_memory()
    ):
        self.user_id = user_id
        self.store: BaseStore = store
        self.project_repo = ProjectRepo(user_id=user_id, store=store)
        
        
    ##########################################################################
    # Project Service Methods
    ##########################################################################
    async def search(self, search_filter: SearchFilter) -> list[Project]:
        return await self.project_repo.search(search_filter)

    async def create(self, project: Project) -> Project:
        return await self.project_repo.create(project)
    
    async def get(self, project_id: str) -> Project:
        return await self.project_repo.get(project_id)
    
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
    
    
    ##########################################################################
    # Source Service Methods
    ##########################################################################
    async def add_sources(self, project_id: str, sources: list[Source]) -> bool:
        return await self.project_repo.source_repo.create(project_id, sources)
    
    async def get_sources(self, project_id: str) -> list[Source]:
        return await self.project_repo.source_repo.search(SearchFilter(filter={"project_id": project_id}))
