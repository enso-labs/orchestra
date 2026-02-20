from typing import Optional

from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime

from src.schemas.entities.store import Epic, Task
from src.services.epic import EpicService
from src.utils.logger import logger


def _get_epic_service(runtime: ToolRuntime) -> EpicService:
    user_id = runtime.config["metadata"].get("user_id", None)
    if not user_id:
        raise ValueError("User ID is required for epic/task operations.")
    return EpicService(user_id=user_id, store=runtime.store)


##########################################################################
# Epic Tools
##########################################################################


@tool
async def create_epic(name: str, runtime: ToolRuntime, description: Optional[str] = None) -> dict:
    """
    Toolkit: Epic Management
    Description: Create a new epic to organize related tasks.
    Args:
        name: The name of the epic.
        description: Optional description of the epic.
    Returns:
        The created epic as a dictionary.
    """
    try:
        service = _get_epic_service(runtime)
        epic = Epic(name=name, description=description)
        result = await service.create_epic(epic)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error creating epic: {e}")
        return {"error": str(e)}


@tool
async def list_epics(runtime: ToolRuntime, query: Optional[str] = None, limit: int = 20) -> list[dict]:
    """
    Toolkit: Epic Management
    Description: List or search epics. Optionally filter by a search query.
    Args:
        query: Optional search query to filter epics by semantic similarity.
        limit: Maximum number of results to return (default 20).
    Returns:
        A list of epics as dictionaries.
    """
    try:
        service = _get_epic_service(runtime)
        from src.schemas.entities import SearchFilter

        search_filter = SearchFilter(query=query or "", limit=limit)
        results = await service.search_epics(search_filter)
        return [r.model_dump() for r in results]
    except Exception as e:
        logger.error(f"Error listing epics: {e}")
        return []


@tool
async def update_epic(
    epic_id: str,
    runtime: ToolRuntime,
    name: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    """
    Toolkit: Epic Management
    Description: Update an existing epic's fields.
    Args:
        epic_id: The ID of the epic to update.
        name: New name for the epic.
        description: New description for the epic.
        status: New status for the epic (e.g. "active", "completed", "archived").
    Returns:
        The updated epic as a dictionary.
    """
    try:
        service = _get_epic_service(runtime)
        data = {}
        if name is not None:
            data["name"] = name
        if description is not None:
            data["description"] = description
        if status is not None:
            data["status"] = status
        result = await service.update_epic(epic_id, data)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error updating epic {epic_id}: {e}")
        return {"error": str(e)}


@tool
async def delete_epic(epic_id: str, runtime: ToolRuntime) -> dict:
    """
    Toolkit: Epic Management
    Description: Delete an epic and all its tasks.
    Args:
        epic_id: The ID of the epic to delete.
    Returns:
        Confirmation of deletion.
    """
    try:
        service = _get_epic_service(runtime)
        await service.delete_epic(epic_id)
        return {"deleted": True, "epic_id": epic_id}
    except Exception as e:
        logger.error(f"Error deleting epic {epic_id}: {e}")
        return {"error": str(e)}


##########################################################################
# Task Tools
##########################################################################


@tool
async def create_task(
    epic_id: str,
    title: str,
    runtime: ToolRuntime,
    description: Optional[str] = None,
) -> dict:
    """
    Toolkit: Epic Management
    Description: Create a new task within an epic.
    Args:
        epic_id: The ID of the epic this task belongs to.
        title: The title of the task.
        description: Optional description of the task.
    Returns:
        The created task as a dictionary.
    """
    try:
        service = _get_epic_service(runtime)
        task = Task(epic_id=epic_id, title=title, description=description)
        result = await service.create_task(task)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return {"error": str(e)}


@tool
async def list_tasks(epic_id: str, runtime: ToolRuntime) -> list[dict]:
    """
    Toolkit: Epic Management
    Description: List all tasks for a given epic.
    Args:
        epic_id: The ID of the epic to list tasks for.
    Returns:
        A list of tasks as dictionaries.
    """
    try:
        service = _get_epic_service(runtime)
        results = await service.list_tasks(epic_id)
        return [r.model_dump() for r in results]
    except Exception as e:
        logger.error(f"Error listing tasks for epic {epic_id}: {e}")
        return []


@tool
async def update_task(
    task_id: str,
    runtime: ToolRuntime,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    blockers: Optional[list[str]] = None,
) -> dict:
    """
    Toolkit: Epic Management
    Description: Update a task's fields.
    Args:
        task_id: The ID of the task to update.
        title: New title for the task.
        description: New description for the task.
        status: New status (todo, in_progress, done, blocked).
        assignee: Assign the task to a user or subagent ID.
        blockers: List of blocking task IDs or descriptions.
    Returns:
        The updated task as a dictionary.
    """
    try:
        service = _get_epic_service(runtime)
        data = {}
        if title is not None:
            data["title"] = title
        if description is not None:
            data["description"] = description
        if status is not None:
            data["status"] = status
        if assignee is not None:
            data["assignee"] = assignee
        if blockers is not None:
            data["blockers"] = blockers
        result = await service.update_task(task_id, data)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {e}")
        return {"error": str(e)}


@tool
async def delete_task(task_id: str, runtime: ToolRuntime) -> dict:
    """
    Toolkit: Epic Management
    Description: Delete a task.
    Args:
        task_id: The ID of the task to delete.
    Returns:
        Confirmation of deletion.
    """
    try:
        service = _get_epic_service(runtime)
        await service.delete_task(task_id)
        return {"deleted": True, "task_id": task_id}
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        return {"error": str(e)}


@tool
async def assign_task(task_id: str, assignee: str, runtime: ToolRuntime) -> dict:
    """
    Toolkit: Epic Management
    Description: Assign a task to a user or subagent.
    Args:
        task_id: The ID of the task to assign.
        assignee: The user or subagent ID to assign the task to.
    Returns:
        The updated task as a dictionary.
    """
    try:
        service = _get_epic_service(runtime)
        result = await service.update_task(task_id, {"assignee": assignee})
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error assigning task {task_id}: {e}")
        return {"error": str(e)}


EPIC_TOOLS = [
    create_epic,
    list_epics,
    update_epic,
    delete_epic,
    create_task,
    list_tasks,
    update_task,
    delete_task,
    assign_task,
]
