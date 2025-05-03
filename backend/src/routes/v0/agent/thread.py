from typing import Annotated
from fastapi import Request, status, Depends, APIRouter,  Body, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.repos.user_repo import UserRepo
from src.controllers.agent import AgentController
from src.entities import Answer, AgentThread, Threads
from src.utils.auth import verify_credentials
from src.services.db import get_async_db, get_db
from src.utils.agent import Agent
from src.models import ProtectedUser
from src.utils.logger import logger

TAG = "Agent"
router = APIRouter(tags=[TAG])

################################################################################
### List Agent Threads
################################################################################
@router.get(
    "/agents/{agent_id}/threads", 
    name="List Agent Threads",
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
async def list_agent_threads(
    agent_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    page: Optional[int] = Query(1, description="Page number", ge=1),
    per_page: Optional[int] = Query(10, description="Items per page", ge=1, le=100),
    db: AsyncSession = Depends(get_async_db)
):
    try:        
        user_repo = UserRepo(db, user.id)
        agent = Agent(config={"user_id": user.id, "agent_id": agent_id}, user_repo=user_repo)
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
async def agent_new_thread(
    request: Request,
    agent_id: str,
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return await controller.async_agent_thread(request=request, query=body.query)
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
async def agent_existing_thread(
    request: Request,
    agent_id: str,
    thread_id: str, 
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return await controller.async_agent_thread(request=request, query=body.query, thread_id=thread_id)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )