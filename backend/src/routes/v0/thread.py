# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver

from fastapi import Response, status, Depends, APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import Optional

from src.entities import Thread, Threads
from src.utils.agent import Agent
from src.utils.auth import verify_credentials
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
):
    try:
        agent = Agent(config={"user_id": user.id})
        threads = await agent.list_threads(page=page, per_page=per_page)
        return JSONResponse(
            content={'threads': threads},
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
def find_thread(
    thread_id: str,
    username: str = Depends(verify_credentials)
):
    with get_connection_pool() as pool:
        agent = Agent(config={"thread_id": thread_id})
        checkpoint = agent.checkpoint()
        response = Thread(
            thread_id=thread_id, 
            messages=checkpoint.get('channel_values').get('messages')
        )
        return JSONResponse(
            content=response.model_dump(),
            status_code=status.HTTP_200_OK
        )
        
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