from typing import Annotated
from fastapi import Request, status, Depends, APIRouter,  Body, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from psycopg_pool import ConnectionPool, AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from src.controllers.agent import AgentController
from src.entities import Answer, AgentThread, Threads, Thread
from src.utils.auth import verify_credentials, get_db
from src.utils.agent import Agent
from src.models import ProtectedUser
from src.utils.logger import logger

router = APIRouter()

################################################################################
### List Agent Threads
################################################################################
@router.get(
    "/agents/{agent_id}/threads", 
    name="List Agent Threads",
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
async def list_agent_threads(
    agent_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    page: Optional[int] = Query(1, description="Page number", ge=1),
    per_page: Optional[int] = Query(10, description="Items per page", ge=1, le=100),
):
    try:
        async with AsyncConnectionPool(
            # Example configuration
            conninfo=DB_URI,
            max_size=20,
            kwargs=CONNECTION_POOL_KWARGS,
        ) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()  
            config = {"user_id": user.id, "agent_id": agent_id}
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
### Create New Thread
################################################################################
@router.post(
    "/agents/{agent_id}/threads", 
    name="Query New Agent Thread",
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from new thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['new_thread']
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n'
                    }
                }
            }
        }
    }
)
def agent_new_thread(
    request: Request,
    agent_id: str,
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return controller.agent_thread(request=request, query=body.query)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

################################################################################
### Query Existing Thread
################################################################################
@router.post(
    "/agents/{agent_id}/threads/{thread_id}", 
    name="Query Existing Agent Thread",
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from new thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['new_thread']
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n'
                    }
                }
            }
        }
    }
)
def agent_existing_thread(
    request: Request,
    agent_id: str,
    thread_id: str, 
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return controller.agent_thread(request=request, query=body.query, thread_id=thread_id)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )