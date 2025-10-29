import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Path, Response

from langgraph.store.postgres import AsyncPostgresStore

from src.contexts.service import ServiceContext
# from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.services.project import (
    Project,
    ProjectSearch,
)


################################################################################
### Create Assistant
################################################################################
router = APIRouter(tags=["Project"], prefix="/projects")


@router.post("/search", name="Query Projects")
async def search_projects(
    project_search: ProjectSearch = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    # If id is provided, return the project
    if "id" in project_search.filter:
        project = await service_context.project_service.get(
            project_search.filter["id"]
        )
        return {"projects": [project.model_dump()]}
    # If id is not provided, return all projects
    projects: list[Project] = await service_context.project_service.search(project_search)
    return {"projects": [project.model_dump() for project in projects]}