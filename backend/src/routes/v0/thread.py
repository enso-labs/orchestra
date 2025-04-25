# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver

from fastapi import Response, status, Depends, APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.repos.thread_repo import ThreadRepo
from src.constants import DB_URI
from src.repos.user_repo import UserRepo
from src.services.db import get_async_db
from src.entities import Thread, Threads
from src.utils.agent import Agent
from src.utils.auth import get_optional_user, verify_credentials
from src.models import ProtectedUser, User
from src.utils.logger import logger
from src.services.db import get_async_connection_pool, get_connection_pool

TAG = "Thread"
router = APIRouter(tags=[TAG])

################################################################################
### List Checkpoints
################################################################################
@router.get(
    "/threads", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "All existing threads.",
            "content": {
                "application/json": {
                    "example": Threads.model_json_schema()['examples']['threads']
                }
            }
        }
    }
)
async def list_threads(
    user: User = Depends(verify_credentials),
    page: Optional[int] = Query(1, description="Page number", ge=1),
    per_page: Optional[int] = Query(10, description="Items per page", ge=1, le=100),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        user_repo = UserRepo(db, user.id)
        agent = Agent(config={"user_id": user.id}, user_repo=user_repo)
        threads = await agent.list_async_threads(page=page, per_page=per_page)
        return JSONResponse(
                content={
                    'threads': threads,
                    'next_page': page + 1,
                    'total': len(threads),
                    'page': page,
                    'per_page': per_page
                },
                status_code=status.HTTP_200_OK
            )
    except Exception as e:
        logger.error(f"Error listing threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

################################################################################
### Query Thread History
################################################################################
@router.get(
    "/threads/{thread_id}", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "All messages from existing thread.",
            "content": {
                "application/json": {
                    "example": Thread.model_json_schema()['examples']['thread_history']
                }
            }
        }
    }
)
async def find_thread(
    thread_id: str,
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        thread_repo = ThreadRepo(db)
        thread: Thread = await thread_repo.find_by_id(thread_id)
        async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer: 
            config = {"configurable": {"thread_id": thread_id, "user_id": "", "checkpoint_ns": ""}}
            # Allow anonymous users to access threads without a user association
            # Reject if an anonymous user tries to access a thread owned by a user
            if thread and thread.user and not user:
                raise HTTPException(status_code=403, detail="You are not authorized to access this thread.")
            # Reject if an authenticated user tries to access a thread they don't own
            if user and thread and thread.user and str(thread.user) != user.id:
                raise HTTPException(status_code=403, detail="You are not authorized to access this thread.")
            checkpoint = await checkpointer.aget(config)
            response = Thread(
                thread_id=thread_id, 
                messages=checkpoint.get('channel_values').get('messages'),
                ts=checkpoint.get('ts'),
                v=checkpoint.get('v')
            )
            return JSONResponse(
                content=response.model_dump(),
                status_code=status.HTTP_200_OK
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
    tags=[TAG],
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Delete existing thread.",
        }
    }
)
def delete_thread(
    thread_id: str,
    username: str = Depends(verify_credentials)
):
    agent = Agent(config={"thread_id": thread_id})
    agent.delete()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
        
################################################################################
### List Checkpoints
################################################################################
@router.get(
    "/checkpoints", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "All existing checkpoints.",
            "content": {
                "application/json": {
                    "example": Threads.model_json_schema()['examples']['threads']
                }
            }
        }
    }
)
async def list_checkpoints(
    user: ProtectedUser = Depends(verify_credentials),
    thread_id: Optional[str] = Query(None, description="Filter by thread ID"),
    checkpoint_id: Optional[str] = Query(None, description="Filter by checkpoint ID"),
    before: Optional[str] = Query(None, description="List checkpoints created before this configuration."),
    limit: Optional[int] = Query(None, description="Maximum number of threads to return")
):
    async with get_async_connection_pool() as pool:
        checkpointer = AsyncPostgresSaver(pool)
        
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
            filter={"user_id": user.id}
        )
        
        items = []
        async for checkpoint in checkpoints:
            config = checkpoint.config['configurable']
            checkpoint = checkpoint.checkpoint
            messages = checkpoint.get('channel_values', {}).get('messages')
            if isinstance(messages, list):
                thread = Thread(
                    thread_id=config.get('thread_id'),
                    checkpoint_ns=config.get('checkpoint_ns'),
                    checkpoint_id=config.get('checkpoint_id'),
                    messages=messages,
                    ts=checkpoint.get('ts'),
                    v=checkpoint.get('v')
                )
                items.append(thread.model_dump())
                
        return JSONResponse(
            content={'checkpoints': items},
            status_code=status.HTTP_200_OK
        )