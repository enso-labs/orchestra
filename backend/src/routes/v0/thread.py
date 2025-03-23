# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver

from fastapi import Response, status, Depends, APIRouter, Query
from fastapi.responses import JSONResponse
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import Optional

from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from src.entities import Thread, Threads
from src.utils.agent import Agent
from src.utils.auth import verify_credentials
from src.models import User
from src.utils.logger import logger
from src.services.db import ASYNC_DB_URI, get_async_connection_pool, get_connection_pool

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
        async with get_async_connection_pool() as pool:
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()  
            config = {"user_id": user.id}
            agent = Agent(config=config, pool=pool)
            user_threads = await agent.user_threads(page=page, per_page=per_page, sort_order='desc')
            # First collect all unique threads without the per_page limit
            seen_thread_ids = set()
            threads = []
            for thread_id in user_threads:
                if thread_id not in seen_thread_ids:
                    seen_thread_ids.add(thread_id)
                    agent = Agent(config={"thread_id": thread_id, "user_id": user.id}, pool=pool)
                    checkpoint = await agent.acheckpoint(checkpointer)
                    if checkpoint:
                        messages = checkpoint.get('channel_values', {}).get('messages')
                        if isinstance(messages, list):
                                thread = Thread(
                                    thread_id=thread_id,
                                    checkpoint_ns='',
                                    checkpoint_id=checkpoint.get('id'),
                                    messages=messages,
                                    ts=checkpoint.get('ts'),
                                    v=checkpoint.get('v')
                                )
                                threads.append(thread.model_dump())
                        
            # # Calculate pagination after collecting all threads
            # start_idx = (page - 1) * per_page
            # end_idx = start_idx + per_page
            # paginated_threads = threads[start_idx:end_idx]
            
            # # Get the timestamp of the last thread for pagination
            # last_ts = paginated_threads[-1]['ts'] if paginated_threads else None
            
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
        raise e

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
        agent = Agent(config={"thread_id": thread_id}, pool=pool)
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
    with get_connection_pool() as pool:
        agent = Agent(config={"thread_id": thread_id}, pool=pool)
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
def list_checkpoints(
    username: str = Depends(verify_credentials),
    thread_id: Optional[str] = Query(None, description="Filter by thread ID"),
    checkpoint_id: Optional[str] = Query(None, description="Filter by checkpoint ID"),
    before: Optional[str] = Query(None, description="List checkpoints created before this configuration."),
    limit: Optional[int] = Query(None, description="Maximum number of threads to return")
):
    with get_connection_pool() as pool:
        checkpointer = PostgresSaver(pool)
        
        # Build the base config and filter
        config = {}
        if thread_id:
            config = {"configurable": {"thread_id": thread_id}}
        elif checkpoint_id:
            config = {"configurable": {"checkpoint_id": checkpoint_id}}
            
        # Build the before config if provided
        before_config = {"configurable": {"thread_id": before}} if before else None
        
        checkpoints = checkpointer.list(
            config=config,
            before=before_config,
            limit=limit
        )
        
        items = []
        for checkpoint in checkpoints:
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