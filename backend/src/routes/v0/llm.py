import uuid
from typing import Annotated

from fastapi import Body, HTTPException, status, Depends, APIRouter, Request
from loguru import logger
from psycopg_pool import ConnectionPool
from sqlalchemy.orm import Session
from src.repos.user_repo import UserRepo
from src.models import User
from src.constants import DB_URI, CONNECTION_POOL_KWARGS

from src.entities import Answer, NewThread, ExistingThread
from src.utils.agent import Agent
from src.utils.auth import get_db, verify_credentials

TAG = "Agent"
router = APIRouter(tags=[TAG])

################################################################################
### Create New Thread
################################################################################
@router.post(
    "/llm", 
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
def new_thread(
    request: Request,
    body: Annotated[NewThread, Body()],
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        thread_id = str(uuid.uuid4())
        tools_str = f"and Tools: {', '.join(body.tools)}" if body.tools else ""
        logger.info(f"Creating new thread with ID: {thread_id} {tools_str} and Query: {body.query}")
        user_repo = UserRepo(db=db)
        if "text/event-stream" in request.headers.get("accept", ""):
            pool = ConnectionPool(
                conninfo=DB_URI,
                max_size=20,
                kwargs=CONNECTION_POOL_KWARGS,
            )
            agent = Agent(config={"thread_id": thread_id, "user_id": user.id}, pool=pool, user_repo=user_repo)
            agent.builder(tools=body.tools, model_name=body.model)
            messages = agent.messages(body.query, body.system, body.images)
            return agent.process(messages, "text/event-stream")
        
        with ConnectionPool(
            conninfo=DB_URI,
            max_size=20,
            kwargs=CONNECTION_POOL_KWARGS,
        ) as pool:
            agent = Agent(config={"thread_id": thread_id, "user_id": user.id}, pool=pool, user_repo=user_repo)
            agent.builder(tools=body.tools, model_name=body.model)
            messages = agent.messages(body.query, body.system, body.images)
            return agent.process(messages, "application/json")
    except ValueError as e:
        logger.warning(f"Bad Request: {str(e)}")
        if "Model" in str(e) and "not supported" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        raise e
    except Exception as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise e
    
################################################################################
### Query Existing Thread
################################################################################
@router.post(
    "/llm/{thread_id}", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from existing thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['existing_thread']
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
def existing_thread(
    request: Request,
    thread_id: str, 
    body: Annotated[ExistingThread, Body()],
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        tools_str = f"and Tools: {', '.join(body.tools)}" if body.tools else ""
        logger.info(f"Querying existing thread with ID: {thread_id} {tools_str} and Query: {body.query}")
        user_repo = UserRepo(db=db)
        if "text/event-stream" in request.headers.get("accept", ""):
            pool = ConnectionPool(
                conninfo=DB_URI,
                max_size=20,
                kwargs=CONNECTION_POOL_KWARGS,
            )
            agent = Agent(config={"thread_id": thread_id, "user_id": user.id}, pool=pool, user_repo=user_repo)
            agent.builder(tools=body.tools, model_name=body.model)
            messages = agent.messages(query=body.query, images=body.images)
            return agent.process(messages, "text/event-stream")
        
        with ConnectionPool(
            conninfo=DB_URI,
            max_size=20,
            kwargs=CONNECTION_POOL_KWARGS,
        ) as pool:  
            agent = Agent(config={"thread_id": thread_id, "user_id": user.id}, pool=pool, user_repo=user_repo)
            agent.builder(tools=body.tools, model_name=body.model)
            messages = agent.messages(query=body.query, images=body.images)
            return agent.process(messages, "application/json")
    except ValueError as e:
        logger.warning(f"Bad Request: {str(e)}")
        if "Model" in str(e) and "not supported" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        raise e
    except Exception as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise e