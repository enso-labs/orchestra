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


##########################################################################
# Task Search Tools
##########################################################################


@tool
async def search_tasks(query: str, runtime: ToolRuntime, limit: int = 5) -> list[dict]:
    """
    Toolkit: Epic Management
    Description: Search tasks across all epics by semantic similarity on title and description.
    Use this to find relevant tasks based on a natural language query.
    Args:
        query: The search query to find relevant tasks.
        limit: Maximum number of results to return (default 5).
    Returns:
        A list of matching tasks with task_id, title, status, epic_id, and score.
    """
    user_id = runtime.config["metadata"].get("user_id", None)
    if not user_id:
        raise ValueError("User ID is required to search tasks.")

    try:
        service = _get_epic_service(runtime)

        from src.schemas.entities import SearchFilter

        search_filter = SearchFilter(query=query, limit=limit)
        results = await service.search_tasks(search_filter)

        return [
            {
                "task_id": item.key,
                "title": item.value.get("title", ""),
                "status": item.value.get("status", ""),
                "epic_id": item.value.get("epic_id", ""),
                "score": item.score,
            }
            for item in results
        ]
    except Exception as e:
        logger.error(f"Error searching tasks: {e}")
        return []


##########################################################################
# Epic Execution Tools
##########################################################################


@tool
async def start_epic_execution(epic_id: str, runtime: ToolRuntime) -> dict:
    """
    Toolkit: Epic Management
    Description: Start execution of tasks in an epic. Assigned tasks are dispatched to their
    designated subagents. Unassigned tasks are executed directly by the supervisor agent.
    Args:
        epic_id: The ID of the epic to execute.
    Returns:
        Execution summary with dispatched and supervisor-handled tasks.
    """
    from collections import defaultdict
    from uuid import uuid4

    from deepagents import SubAgent, create_deep_agent
    from langchain.chat_models import init_chat_model
    from langchain_core.messages import HumanMessage
    from langchain_core.runnables.config import RunnableConfig

    from src.constants.llm import DEFAULT_CHAT_MODEL

    try:
        service = _get_epic_service(runtime)

        # Fetch all tasks for the epic
        tasks = await service.list_tasks(epic_id)
        if not tasks:
            return {"error": "No tasks found for this epic."}

        # Split todo tasks into assigned (subagent) and unassigned (supervisor)
        todo_tasks = [t for t in tasks if t.status == "todo"]
        if not todo_tasks:
            return {"error": "No todo tasks found for this epic."}

        assigned_tasks = [t for t in todo_tasks if t.assignee]
        unassigned_tasks = [t for t in todo_tasks if not t.assignee]

        # Group assigned tasks by assignee
        tasks_by_assignee: dict[str, list] = defaultdict(list)
        for task in assigned_tasks:
            tasks_by_assignee[task.assignee].append(task)

        # Validate max 3 tasks per subagent
        for assignee, agent_tasks in tasks_by_assignee.items():
            if len(agent_tasks) > 3:
                return {
                    "error": (
                        f"Subagent '{assignee}' has {len(agent_tasks)} tasks assigned. Maximum is 3 per subagent."
                    )
                }

        # Set all todo tasks to in_progress (both assigned and unassigned)
        for task in todo_tasks:
            await service.update_task(task.id, {"status": "in_progress"})

        # Build SubAgent specs for each assignee
        subagents: list[SubAgent] = []
        for assignee, agent_tasks in tasks_by_assignee.items():
            task_context = "\n".join(
                f"- Task ID: {t.id}, Title: {t.title}, Description: {t.description or 'N/A'}" for t in agent_tasks
            )
            subagents.append(
                {
                    "name": assignee,
                    "description": f"Subagent for handling {len(agent_tasks)} assigned tasks",
                    "system_prompt": (
                        f"You are subagent '{assignee}'. You have been assigned the following tasks:\n\n"
                        f"{task_context}\n\n"
                        "For each task, call the update_task tool with the task_id and status='done' "
                        "to mark it as complete. Process all your assigned tasks."
                    ),
                    "tools": [update_task],
                }
            )

        # Build system prompt based on execution mode
        if subagents and unassigned_tasks:
            system_prompt = (
                "You are a task execution coordinator. "
                "You have subagents available to delegate assigned tasks — "
                "use the task tool to dispatch work to each subagent by name. "
                "You also have unassigned tasks to handle directly — "
                "use update_task to mark each as done."
            )
        elif subagents:
            system_prompt = (
                "You are a task execution coordinator. You have subagents available to process tasks. "
                "Use the task tool to dispatch work to each subagent by name. "
                "Each subagent knows their assigned tasks and will mark them as done."
            )
        else:
            system_prompt = (
                "You are a task execution supervisor. "
                "You have tasks to complete directly. For each task, "
                "call update_task with the task_id and status='done' to mark it as complete."
            )

        # Create coordinator agent — has update_task for direct execution + subagents for delegation
        coordinator = create_deep_agent(
            model=init_chat_model(model=DEFAULT_CHAT_MODEL),
            tools=[update_task],
            subagents=subagents,
            system_prompt=system_prompt,
            store=runtime.store,
        )

        # Build dispatch instructions
        dispatch_parts = []
        if tasks_by_assignee:
            dispatch_parts.append("Dispatch the following to subagents:")
            for assignee, agent_tasks in tasks_by_assignee.items():
                task_names = ", ".join(t.title for t in agent_tasks)
                dispatch_parts.append(f"- Subagent '{assignee}': Process tasks: {task_names}")

        if unassigned_tasks:
            dispatch_parts.append("\nHandle these tasks directly (no subagent assigned):")
            for t in unassigned_tasks:
                dispatch_parts.append(f"- Task ID: {t.id}, Title: {t.title}, Description: {t.description or 'N/A'}")
            dispatch_parts.append("For each, call update_task with the task_id and status='done'.")

        dispatch_msg = "\n".join(dispatch_parts)

        # Execute coordinator with proper config for user context
        config = RunnableConfig(
            configurable={
                "user_id": service.user_id,
                "thread_id": str(uuid4()),
            },
            metadata={"user_id": service.user_id},
        )
        await coordinator.ainvoke(
            {"messages": [HumanMessage(content=dispatch_msg)]},
            config=config,
        )

        # Fetch updated task statuses
        updated_tasks = await service.list_tasks(epic_id)
        return {
            "epic_id": epic_id,
            "total_tasks": len(tasks),
            "dispatched": len(assigned_tasks),
            "supervisor_tasks": len(unassigned_tasks),
            "subagents_used": list(tasks_by_assignee.keys()),
            "results": [
                {"task_id": t.id, "title": t.title, "status": t.status, "assignee": t.assignee} for t in updated_tasks
            ],
        }
    except Exception as e:
        logger.error(f"Error executing epic {epic_id}: {e}")
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
    search_tasks,
    start_epic_execution,
]
