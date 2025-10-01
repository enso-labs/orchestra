import ujson
from typing import Annotated, Any
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi import (
    Body,
    HTTPException,
    status,
    Depends,
    APIRouter,
    Request,
    File,
    Form,
    UploadFile,
)
from langchain.chat_models import init_chat_model

from src.constants import APP_LOG_LEVEL
from src.schemas.models import ProtectedUser
from src.schemas.entities import Answer, ChatInput
from src.utils.auth import get_optional_user
from src.utils.logger import logger, log_to_file
from src.constants.mock import MockResponse
from src.constants.examples import Examples
from src.schemas.entities import LLMRequest, LLMStreamRequest
from src.utils.stream import handle_multi_mode
from src.utils.llm import audio_to_text
from src.flows import construct_agent
from src.services.thread import thread_service
from src.services.checkpoint import checkpoint_service
from src.services.db import get_store, get_checkpointer
from src.utils.rate_limit import limiter


llm_router = APIRouter(tags=["Graphs"], prefix="/llm")

# TIME_LIMIT = "1/minute"
TIME_LIMIT = "200/day"


################################################################################
### Invoke Graph
################################################################################
@llm_router.post(
    "/invoke",
    responses={status.HTTP_200_OK: MockResponse.INVOKE_RESPONSE},
    name="Invoke Graph",
)
@limiter.limit(TIME_LIMIT)
async def llm_invoke(
    request: Request,
    params: LLMRequest = Body(openapi_examples=Examples.LLM_INVOKE_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
) -> dict[str, Any] | Any:
    # Construct the agent with the given parameters
    agent = await construct_agent(params)
    # Invoke the agent asynchronously with user context
    response = await agent.ainvoke(
        {"messages": params.to_langchain_messages()},
        context={"user": user} if user else None,
    )
    # Return the agent's response
    return response


################################################################################
### Stream Graph
################################################################################
@llm_router.post(
    "/stream",
    responses={status.HTTP_200_OK: MockResponse.STREAM_RESPONSE},
    name="Stream Graph",
)
@limiter.limit(TIME_LIMIT)
async def llm_stream(
    request: Request,
    params: LLMStreamRequest = Body(openapi_examples=Examples.LLM_STREAM_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
    store=Depends(get_store),
    checkpointer=Depends(get_checkpointer),
) -> StreamingResponse:
    """
    Streams LLM output as server-sent events (SSE).
    """
    try:

        async def event_generator():
            ## Keeps in memory if not auth user
            if user:
                thread_service.store = store
            checkpoint_service.checkpointer = checkpointer
            agent = await construct_agent(params, checkpointer, store)
            checkpoint_service.graph = agent.graph
            try:
                async for chunk in agent.astream(
                    {"messages": params.to_langchain_messages()},
                    stream_mode=["messages", "values"],
                    context={"user_id": user.id} if user else None,
                ):
                    # Serialize and yield each chunk as SSE
                    stream_chunk = handle_multi_mode(chunk)
                    if stream_chunk:
                        data = ujson.dumps(stream_chunk)
                        log_to_file(
                            str(data), params.model
                        ) and APP_LOG_LEVEL == "DEBUG"
                        logger.debug(f"data: {str(data)}")
                        yield f"data: {data}\n\n"

            except Exception as e:
                # Yield error as SSE if streaming fails
                logger.exception("Error in event_generator: %s", e)
                raise HTTPException(status_code=500, detail=str(e))
                # error_msg = ujson.dumps(("error", str(e)))
                # yield f"data: {error_msg}\n\n"
            finally:
                # Update model info in checkpoint after streaming
                await agent.add_model_to_ai_message(params.model)

        # Return streaming response with appropriate headers
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    except Exception as e:
        logger.exception("Error in llm_stream: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Transcribe
################################################################################
@llm_router.post("/transcribe")
@limiter.limit(TIME_LIMIT)
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form("whisper-large-v3"),
    prompt: str = Form(None),
    response_format: str = Form(None),
    temperature: float = Form(None),
    timeout: float = Form(None),
):
    try:
        audio_bytes = await file.read()
        transcript = audio_to_text(
            file.filename,
            audio_bytes,
            model,
            prompt,
            response_format,
            temperature,
            timeout,
        )
        return JSONResponse(
            content={"transcript": transcript.model_dump()},
            media_type="application/json",
            status_code=200,
        )
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=500, detail=str(e))


################################################################################
### Chat Completion
################################################################################
@llm_router.post(
    "/chat",
    name="Chat Completion",
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
@limiter.limit(TIME_LIMIT)
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
