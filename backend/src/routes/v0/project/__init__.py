from fastapi import APIRouter, Body, Depends
from fastapi.responses import Response
from fastapi import status
from langgraph.store.postgres import AsyncPostgresStore

from src.schemas.examples import Examples
from src.schemas.entities import SearchFilter
from src.services.source import Source
from src.contexts.service import ServiceContext
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.repos.project_repo import Project



router = APIRouter(tags=["Project"], prefix="/projects")

################################################################################
### Search Projects
################################################################################
@router.post("/search", name="Query Projects")
async def search_projects(
	project_search: SearchFilter = Body(...),
	user: ProtectedUser = Depends(verify_credentials),
	store: AsyncPostgresStore = Depends(get_store),
):
	service_context = ServiceContext(user_id=user.id, store=store)
	# If id is provided, return the project
	if "id" in project_search.filter and project_search.filter:
		project = await service_context.project_service.get(
			project_search.filter["id"]
		)
		return {"projects": [project.model_dump()]}
	# If id is not provided, return all projects
	projects: list[Project] = await service_context.project_service.search(project_search)
	return {"projects": [project.model_dump() for project in projects]}


################################################################################
### Create Project
################################################################################
@router.post("", name="Create Project")
async def create_project(
	project: Project = Body(openapi_examples=Examples.PROJECT_EXAMPLES),
	user: ProtectedUser = Depends(verify_credentials),
	store: AsyncPostgresStore = Depends(get_store),
):
	service_context = ServiceContext(user_id=user.id, store=store)
	project: Project = await service_context.project_service.create(project)
	return {"project_id": project.id}


################################################################################
### Get Project
################################################################################
@router.get("/{project_id}", name="Get Project")
async def get_project(
	project_id: str,
	user: ProtectedUser = Depends(verify_credentials),
	store: AsyncPostgresStore = Depends(get_store),
):
	service_context = ServiceContext(user_id=user.id, store=store)
	project: Project = await service_context.project_service.get(project_id)
	return {"project": project.model_dump()}

################################################################################
### Delete Project
################################################################################
@router.delete("/{project_id}", name="Delete Project")
async def delete_project(
	project_id: str,
	user: ProtectedUser = Depends(verify_credentials),
	store: AsyncPostgresStore = Depends(get_store),
):
	service_context = ServiceContext(user_id=user.id, store=store)
	await service_context.project_service.delete(project_id)
	return Response(status_code=status.HTTP_204_NO_CONTENT)


################################################################################
### Add Project Sources
################################################################################
@router.post("/{project_id}/sources", name="Add Project Sources")
async def add_project_sources(
	project_id: str,
	sources: list[Source] = Body(openapi_examples=Examples.SOURCE_EXAMPLES),
	user: ProtectedUser = Depends(verify_credentials),
	store: AsyncPostgresStore = Depends(get_store),
):
	service_context = ServiceContext(user_id=user.id, store=store)
	sources: list[Source] = await service_context.project_service.add_sources(project_id, sources)
	return {"sources": [source.model_dump() for source in sources]}