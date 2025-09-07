import ujson
from typing import Annotated, Any
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
from fastapi import Body, HTTPException, status, Depends, APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession
from langchain.chat_models import init_chat_model
from langchain_core.runnables.config import RunnableConfig
from langchain_core.messages import AIMessage

from src.schemas.models import ProtectedUser
from src.schemas.entities import Answer, ChatInput, NewThread, ExistingThread
from src.services.db import get_async_db, get_store_db
from src.utils.auth import get_optional_user
from src.utils.logger import logger
from src.controllers.agent import AgentController
from src.routes.v0.llm.transcribe import router as transcribe_router
from src.constants.mock import MockResponse
from src.constants.examples import Examples
from src.schemas.entities import LLMRequest, LLMStreamRequest
from src.flows import graph_builder, add_memories_to_system
from src.services.checkpoint import in_memory_checkpointer
from src.tools.memory import MEMORY_TOOLS
from src.utils.stream import convert_messages
from src.services.thread import thread_service
from src.services.checkpoint import checkpoint_service

TAG = "Thread"
router = APIRouter()

def get_stock_price(symbol: str) -> str:
    """Get the stock price of a given symbol"""
    import random
    return f"The stock price of {symbol} is {random.randint(100, 200)}"

def get_weather(location: str) -> str:
    """Get the weather in a given location"""
    import random
    return f"The weather in {location} is sunny and {random.randint(60, 80)} degrees"

async def construct_agent(params: LLMRequest | LLMStreamRequest):
    # Add config if it exists
    config = (
        RunnableConfig(configurable=params.metadata.model_dump(), metadata={'model': params.model})
        if params.metadata
        else None
    )

    if config:
        ## Construct the prompt
        memory_prompt = await add_memories_to_system()
        prompt = (
            params.system + "\n" + memory_prompt if memory_prompt else params.system
        )
        tools = [get_weather, get_stock_price] + MEMORY_TOOLS

    # Asynchronous LLM call
    agent = graph_builder(
        graph_id=(
            params.metadata.graph_id
            if params.metadata and params.metadata.graph_id
            else "react"
        ),
        model=params.model,
        tools=tools,
        prompt=prompt,
        checkpointer=in_memory_checkpointer if config else None,
        # store=in_memory_store if config else None,
    )
    return agent, config


@router.post(
    "/llm/invoke",
    responses={status.HTTP_200_OK: MockResponse.INVOKE_RESPONSE},
    name="Invoke Graph",
    tags=["LLM"],
)
async def llm_invoke(
    params: LLMRequest = Body(openapi_examples=Examples.LLM_INVOKE_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
) -> dict[str, Any] | Any:
    agent, config = await construct_agent(params)

    # Invoke the agent
    response = await agent.ainvoke(
        {"messages": params.to_langchain_messages()},
        config=config,
    )
    return response


@router.post(
    "/llm/stream",
    responses={status.HTTP_200_OK: MockResponse.STREAM_RESPONSE},
    name="Stream Graph",
)
async def llm_stream(
    params: LLMStreamRequest = Body(openapi_examples=Examples.LLM_STREAM_EXAMPLES),
) -> StreamingResponse:
    agent, config = await construct_agent(params)

    # Event generator
    async def event_generator():
        try:
            # Stream LLM output chunks as server-sent events
            async for chunk in agent.astream(
                {"messages": params.to_langchain_messages()},
                config=config,
                stream_mode=params.stream_mode,
            ):
                # Convert the chunk to a JSON string
                data = ujson.dumps(
                    convert_messages(chunk, stream_mode=params.stream_mode)
                )
                yield f"data: {data}\n\n"
        except Exception as e:
            # Log and stream error if occurs
            logger.exception("Error in event_generator: %s", e)
            error_msg = ujson.dumps({"error": str(e)})
            yield f"data: {error_msg}\n\n"
        finally:
            final_state = await agent.aget_state(config)
            last_message = final_state.values.get("messages")[-1]
            if isinstance(last_message, AIMessage):
               final_state.values['messages'][-1].model = params.model
               updated = await checkpoint_service.update_checkpoint_state(config, values={'messages': final_state.values['messages']})
               await thread_service.update(params.metadata.thread_id, {
                   "thread_id": updated.get('configurable').get('thread_id'),
				   "checkpoint_id": updated.get('configurable').get('checkpoint_id'),
				   "messages": [last_message],
			   })
               logger.info(f"final_state Updated: {str(updated)}")
           
           
    # Return the streaming response
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


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
                    "example": Answer.model_json_schema()["examples"]["new_thread"]
                },
            },
        }
    },
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
        response = await llm.ainvoke(
            [
                {"role": "system", "content": body.system},
                {"role": "user", "content": body.query},
            ]
        )
        return JSONResponse(
            content={"answer": response.model_dump()},
            media_type="application/json",
            status_code=200,
        )
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Create New Thread
################################################################################
@router.post(
    "/llm/thread",
    name="Create New Thread",
    tags=["LLM"],
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from new thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()["examples"]["new_thread"]
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n',
                    },
                },
            },
        }
    },
)
async def new_thread(
    request: Request,
    body: Annotated[NewThread, Body()],
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        async with get_store_db() as store:
            args = {
                "output_type": request.headers.get("accept", "application/json"),
                "thread": body,
            }
            if hasattr(body, "memory") and body.memory:
                await store.setup()
                args["store"] = store

            controller = AgentController(db=db, user_id=user.id if user else None)
            return await controller.query_thread(**args)
    except httpx.HTTPStatusError as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Query Existing Thread
################################################################################
@router.post(
    "/llm/thread/{thread_id}",
    name="Query Existing Thread",
    tags=["LLM"],
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from existing thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()["examples"]["existing_thread"]
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n',
                    },
                },
            },
        }
    },
)
async def existing_thread(
    request: Request,
    thread_id: str,
    body: Annotated[ExistingThread, Body()],
    user: ProtectedUser = Depends(get_optional_user),
    db: AsyncSession = Depends(get_async_db),
):
    try:
        async with get_store_db() as store:
            args = {
                "output_type": request.headers.get("accept", "application/json"),
                "thread": body,
                "thread_id": thread_id,
            }
            if hasattr(body, "memory") and body.memory:
                await store.setup()
                args["store"] = store

            controller = AgentController(db=db, user_id=user.id if user else None)
            return await controller.query_thread(**args)
    except httpx.HTTPStatusError as e:
        logger.error(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating new thread: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


router.include_router(transcribe_router, prefix="/llm", tags=["LLM"])
