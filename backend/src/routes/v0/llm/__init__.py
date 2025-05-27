from typing import Annotated
from fastapi.responses import JSONResponse
import httpx
from fastapi import Body, HTTPException,status, Depends, APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession
from langchain.chat_models import init_chat_model

from src.models import ProtectedUser, User
from src.entities import Answer, ChatInput, NewThread, ExistingThread
from src.services.db import get_async_db
from src.utils.auth import get_optional_user
from src.utils.logger import logger
from src.controllers.agent import AgentController
from src.routes.v0.llm.transcribe import router as transcribe_router

TAG = "Thread"
router = APIRouter()

################################################################################
### Create New Thread
################################################################################
@router.post(
    "/llm/chat",
    name="Chat Completion",
    tags=["LLM"],
    responses={
        status.HTTP_200_OK: {
            "description": "Chat completion response.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['new_thread']
                },
            }
        }
    }
)
async def chat_completion(
    request: Request,
    body: Annotated[ChatInput, Body()],
    user: ProtectedUser = Depends(get_optional_user),
    # db: AsyncSession = Depends(get_async_db)
):
    try:
        model = body.model.split(":")
        provider = model[0]
        model_name = model[1]
        llm = init_chat_model(
            model=model_name,
            model_provider=provider,
            temperature=0.9,
            # max_tokens=1000,
            max_retries=3,
            # timeout=1000
        )
        response = await llm.ainvoke([
            {'role': 'system', 'content': body.system},
            {'role': 'user', 'content': body.query}
        ])
        return JSONResponse(
            content={"answer": response.model_dump()}, 
            media_type="application/json", 
            status_code=200
        )
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail=str(e))

################################################################################
### Create New Thread
################################################################################
@router.post(
    "/threads",
    name="Create New Thread",
    tags=[TAG],
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
async def new_thread(
    request: Request,
    body: Annotated[NewThread, Body()],
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db)
):
    
    try:
        controller = AgentController(db=db, user_id=user.id if user else None)
        output_type = request.headers.get("accept", "application/json")
        return await controller.query_thread(output_type=output_type, thread=body)
    except httpx.HTTPStatusError as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=e.response.status_code , detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

################################################################################
### Query Existing Thread
################################################################################
@router.post(
    "/threads/{thread_id}", 
    name="Query Existing Thread",
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
async def existing_thread(
    request: Request,
    thread_id: str, 
    body: Annotated[ExistingThread, Body()],
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id if user else None)
        output_type = request.headers.get("accept", "application/json")
        return await controller.query_thread(output_type=output_type, thread=body, thread_id=thread_id)
    except httpx.HTTPStatusError as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=e.response.status_code , detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
router.include_router(transcribe_router, prefix="/llm", tags=["LLM"])