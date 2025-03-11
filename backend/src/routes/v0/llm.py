import uuid
from typing import Annotated

from fastapi import Body, HTTPException, status, Depends, APIRouter, Request
from fastapi.responses import JSONResponse
from loguru import logger
from psycopg_pool import ConnectionPool
from sqlalchemy.orm import Session
from src.repos.user_repo import UserRepo
from src.models import ProtectedUser, User
from src.constants import DB_URI, CONNECTION_POOL_KWARGS

from src.entities import Answer, NewThread, ExistingThread
from src.utils.agent import Agent
from src.utils.auth import get_db, verify_credentials
from src.controllers.agent import AgentController

TAG = "Chat"
router = APIRouter(tags=[TAG])

################################################################################
### List Models
################################################################################
from src.constants.llm import get_available_models
@router.get(
    "/models", 
    tags=['Model'],
    responses={
        status.HTTP_200_OK: {
            "description": "All models.",
            "content": {
                "application/json": {
                    "example": {
                        "models": []
                    }
                }
            }
        }
    }
)
def list_models(user: ProtectedUser = Depends(verify_credentials), db: Session = Depends(get_db)):
    return JSONResponse(
        content={"models": get_available_models()},
        status_code=status.HTTP_200_OK
    )

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
    controller = AgentController(db=db, user_id=user.id)
    return controller.new_thread(request=request, new_thread=body)

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
    controller = AgentController(db=db, user_id=user.id)
    return controller.existing_thread(request=request, thread_id=thread_id, existing_thread=body)