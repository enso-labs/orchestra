from typing import Annotated

from fastapi import Body, HTTPException,status, Depends, APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_mcp_adapters.client import MultiServerMCPClient

from src.services.mcp import McpService
from src.models import User
from src.entities import Answer, NewThread, ExistingThread
from src.utils.auth import get_async_db, get_db, verify_credentials
from src.utils.logger import logger
from src.controllers.agent import AgentController
from langgraph.prebuilt import create_react_agent

from src.utils.llm import LLMWrapper

TAG = "Thread"
router = APIRouter(tags=[TAG])


class AgentSession:
    def __init__(self):
        self.mcp_client = None
        self.agent = None
        
    async def setup(self, model):    
        self.mcp_client = MultiServerMCPClient(
            {
                # "math": {
                #     "command": "python",
                #     "args": ["../server/math/main.py"],
                #     "transport": "stdio",
                # },
                "weather": {
                    "url": "http://localhost:8005/sse",
                    "transport": "sse",
                }
            }
        )
        await self.mcp_client.__aenter__()
        self.agent = create_react_agent(model, self.mcp_client.get_tools())
        return self.agent
    
    async def cleanup(self):
        if self.mcp_client:
            await self.mcp_client.__aexit__(None, None, None)

################################################################################
### Create New Thread
################################################################################
@router.post(
    "/threads",
    name="Create New Thread",
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
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    
    try:
        controller = AgentController(db=db, user_id=user.id)
        return await controller.anew_thread(request=request, new_thread=body)
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
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    controller = AgentController(db=db, user_id=user.id)
    return controller.existing_thread(request=request, thread_id=thread_id, existing_thread=body)