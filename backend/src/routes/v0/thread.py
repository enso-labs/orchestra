# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver

from fastapi import (
    Path,
    Request,
    Response,
    status,
    Depends,
    APIRouter,
    Query,
    HTTPException,
    Body,
)
from fastapi.responses import JSONResponse
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.repos.thread_repo import ThreadRepo
from src.services.db import get_async_db, get_checkpoint_db
from src.schemas.entities import Thread, Threads, ThreadSearch
from src.utils.agent import Agent
from src.utils.auth import get_optional_user, verify_credentials
from src.schemas.models import ProtectedUser
from src.utils.logger import logger
from src.services.checkpoint import checkpoint_service
from src.constants.examples import Examples

TAG = "Thread"
router = APIRouter(tags=[TAG])


@router.get(
    "/threads",
    dependencies=[Depends(verify_credentials)],
    responses={
        status.HTTP_200_OK: {
            "description": "All existing threads.",
            "content": {
                "application/json": {
                    "example": Threads.model_json_schema()["examples"]["threads"]
                }
            },
        }
    },
)
async def list_threads(
    request: Request,
    page: Optional[int] = Query(1, description="Page number", ge=1),
    per_page: Optional[int] = Query(10, description="Items per page", ge=1, le=100),
):
    try:
        agent = Agent(
            config={"user_id": request.state.user.id}, user_repo=request.state.user_repo
        )
        threads = await agent.list_async_threads(page=page, per_page=per_page)
        return JSONResponse(
            content={
                "threads": threads,
                "next_page": page + 1,
                "total": len(threads),
                "page": page,
                "per_page": per_page,
            },
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Error listing threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Query Thread History
################################################################################
@router.get(
    "/threads/{thread_id}",
    responses={
        status.HTTP_200_OK: {
            "description": "All messages from existing thread.",
            "content": {
                "application/json": {
                    "example": Thread.model_json_schema()["examples"]["thread_history"]
                }
            },
        }
    },
)
async def find_thread(
    thread_id: str,
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        thread_repo = ThreadRepo(db)
        thread: Thread = await thread_repo.find_by_id(thread_id)
        async with get_checkpoint_db() as checkpointer:
            config = {
                "configurable": {
                    "thread_id": thread_id,
                    "user_id": "",
                    "checkpoint_ns": "",
                }
            }
            # Allow anonymous users to access threads without a user association
            # Reject if an anonymous user tries to access a thread owned by a user
            if thread and thread.user and not user:
                raise HTTPException(
                    status_code=403,
                    detail="You are not authorized to access this thread.",
                )
            # Reject if an authenticated user tries to access a thread they don't own
            if user and thread and thread.user and str(thread.user) != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You are not authorized to access this thread.",
                )
            checkpoint = await checkpointer.aget(config)
            response = Thread(
                thread_id=thread_id,
                messages=checkpoint.get("channel_values").get("messages"),
                ts=checkpoint.get("ts"),
                v=checkpoint.get("v"),
            )
            return JSONResponse(
                content=response.model_dump(), status_code=status.HTTP_200_OK
            )
    except Exception as e:
        logger.exception(f"Error finding thread: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Query Thread History
################################################################################
@router.delete(
    "/threads/{thread_id}",
    dependencies=[Depends(verify_credentials)],
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Delete existing thread.",
        }
    },
)
async def delete_thread(request: Request, thread_id: str):
    try:
        agent = Agent(
            config={"thread_id": thread_id}, user_repo=request.state.user_repo
        )
        await agent.delete_thread()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### List Checkpoints
################################################################################
@router.get(
    "/threads/{thread_id}/checkpoints",
    responses={
        status.HTTP_200_OK: {
            "description": "All existing checkpoints.",
            "content": {
                "application/json": {
                    "example": Threads.model_json_schema()["examples"]["threads"]
                }
            },
        }
    },
)
async def list_checkpoints(
    user: ProtectedUser = Depends(verify_credentials),
    thread_id: Optional[str] = Path(description="Filter by thread ID"),
    checkpoint_id: Optional[str] = Query(None, description="Filter by checkpoint ID"),
    before: Optional[str] = Query(
        None, description="List checkpoints created before this configuration."
    ),
    limit: Optional[int] = Query(
        None, description="Maximum number of threads to return"
    ),
):
    async with get_checkpoint_db() as checkpointer:
        # Build the base config and filter
        config = {}
        if thread_id:
            config = {"configurable": {"thread_id": thread_id}}
        elif checkpoint_id:
            config = {"configurable": {"checkpoint_id": checkpoint_id}}

        # Build the before config if provided
        before_config = {"configurable": {"thread_id": before}} if before else None

        checkpoints = checkpointer.alist(
            config=config,
            before=before_config,
            limit=limit,
            filter={"user_id": user.id},
        )

        items = []
        async for checkpoint in checkpoints:
            config = checkpoint.config["configurable"]
            checkpoint = checkpoint.checkpoint
            messages = checkpoint.get("channel_values", {}).get("messages")
            if isinstance(messages, list):
                thread = Thread(
                    thread_id=config.get("thread_id"),
                    checkpoint_ns=config.get("checkpoint_ns"),
                    checkpoint_id=config.get("checkpoint_id"),
                    messages=messages,
                    ts=checkpoint.get("ts"),
                    v=checkpoint.get("v"),
                )
                items.append(thread.model_dump())

        return JSONResponse(
            content={"checkpoints": items}, status_code=status.HTTP_200_OK
        )


@router.post("/search", name="Query Threads in Checkpointer")
async def search_threads(
    thread_search: ThreadSearch = Body(
        openapi_examples=Examples.THREAD_SEARCH_EXAMPLES
    ),
):
    metadata = thread_search.model_dump().get("metadata", {})

    if "thread_id" in metadata and not "checkpoint_id" in metadata:
        thread_id = metadata["thread_id"]
        checkpoints = await checkpoint_service.list_checkpoints(thread_id)
        if checkpoints is None:
            raise HTTPException(status_code=404, detail="Checkpoints not found")
        return {"checkpoints": checkpoints}
    if "thread_id" in metadata and "checkpoint_id" in metadata:
        thread_id = metadata["thread_id"]
        checkpoint_id = metadata["checkpoint_id"]
        checkpoint = await checkpoint_service.get_checkpoint(thread_id, checkpoint_id)
        if checkpoint is None:
            raise HTTPException(status_code=404, detail="Checkpoint not found")
        return {"checkpoint": checkpoint}
    return {
        "threads": await checkpoint_service.search_threads(thread_search=thread_search)
    }
