from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response
from fastapi import status
from langgraph.store.postgres import AsyncPostgresStore

from src.schemas.entities import SearchFilter
from src.contexts.service import ServiceContext
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.utils.auth import verify_credentials
from src.schemas.entities.store import Epic, EpicUpdate, Task, TaskUpdate


router = APIRouter(tags=["Epic"], prefix="/epics")
task_router = APIRouter(tags=["Task"], prefix="/tasks")


################################################################################
### Search Epics
################################################################################
@router.post("/search", name="Search Epics", operation_id="ruska_search_epics")
async def search_epics(
    search_filter: SearchFilter = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    epics = await service_context.epic_service.search_epics(search_filter)
    return {"epics": [epic.model_dump(exclude_none=True) for epic in epics]}


################################################################################
### Create Epic
################################################################################
@router.post("", name="Create Epic", operation_id="ruska_create_epic")
async def create_epic(
    epic: Epic = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    created = await service_context.epic_service.create_epic(epic)
    return {"epic_id": created.id}


################################################################################
### Get Epic
################################################################################
@router.get(
    "/{epic_id}",
    name="Get Epic",
    operation_id="ruska_get_epic",
)
async def get_epic(
    epic_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    epic = await service_context.epic_service.get_epic(epic_id)
    if not epic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Epic not found")
    return {"epic": epic.model_dump(exclude_none=True)}


################################################################################
### Update Epic
################################################################################
@router.put(
    "/{epic_id}",
    name="Update Epic",
    operation_id="ruska_update_epic",
)
async def update_epic(
    epic_id: str,
    epic: EpicUpdate = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    try:
        update_data = {k: v for k, v in epic.model_dump(exclude_unset=True).items()}
        updated = await service_context.epic_service.update_epic(epic_id, update_data)
        return {"epic": updated.model_dump(exclude_none=True)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


################################################################################
### Delete Epic
################################################################################
@router.delete(
    "/{epic_id}",
    name="Delete Epic",
    operation_id="ruska_delete_epic",
)
async def delete_epic(
    epic_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    await service_context.epic_service.delete_epic(epic_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


################################################################################
### Create Task
################################################################################
@router.post(
    "/{epic_id}/tasks",
    name="Create Task",
    operation_id="ruska_create_task",
)
async def create_task(
    epic_id: str,
    task: Task = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    epic = await service_context.epic_service.get_epic(epic_id)
    if not epic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Epic not found")
    task.epic_id = epic_id
    created = await service_context.epic_service.create_task(task)
    return {"task_id": created.id}


################################################################################
### List Tasks
################################################################################
@router.get(
    "/{epic_id}/tasks",
    name="List Tasks",
    operation_id="ruska_list_tasks",
)
async def list_tasks(
    epic_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    tasks = await service_context.epic_service.list_tasks(epic_id)
    return {"tasks": [task.model_dump(exclude_none=True) for task in tasks]}


################################################################################
### Update Task
################################################################################
@router.put(
    "/{epic_id}/tasks/{task_id}",
    name="Update Task",
    operation_id="ruska_update_task",
)
async def update_task(
    epic_id: str,
    task_id: str,
    task: TaskUpdate = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    try:
        update_data = {k: v for k, v in task.model_dump(exclude_unset=True).items()}
        updated = await service_context.epic_service.update_task(task_id, update_data)
        return {"task": updated.model_dump(exclude_none=True)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


################################################################################
### Delete Task
################################################################################
@router.delete(
    "/{epic_id}/tasks/{task_id}",
    name="Delete Task",
    operation_id="ruska_delete_task",
)
async def delete_task(
    epic_id: str,
    task_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    await service_context.epic_service.delete_task(task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


################################################################################
### Search Tasks (global)
################################################################################
@task_router.post(
    "/search",
    name="Search Tasks",
    operation_id="ruska_search_tasks",
)
async def search_tasks(
    search_filter: SearchFilter = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    service_context = ServiceContext(user_id=user.id, store=store)
    items = await service_context.epic_service.search_tasks(search_filter)
    results = []
    for item in items:
        results.append(
            {
                "task_id": item.key,
                "title": item.value.get("title", ""),
                "status": item.value.get("status", ""),
                "epic_id": item.value.get("epic_id", ""),
                "score": item.score,
            }
        )
    return {"tasks": results}
