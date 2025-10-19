from typing import Any
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
from src.contexts.service import ServiceContext
from src.constants import GROQ_API_KEY
from src.schemas.models import ProtectedUser
from src.utils.auth import get_optional_user
from src.utils.logger import logger
from src.constants.mock import MockResponse
from src.constants.examples import Examples
from src.schemas.entities import LLMRequest
from src.utils.stream import stream_generator
from src.utils.llm import audio_to_text
from src.flows import construct_agent
from src.services.assistant import Assistant
from src.services.db import get_store, get_checkpoint_db
from src.utils.rate_limit import limiter
from src.constants.llm import ChatModels


llm_router = APIRouter(tags=["LLM"], prefix="/llm")

# TIME_LIMIT = "1/minute"
TIME_LIMIT = "200/day"


################################################################################
### Invoke Graph
################################################################################
@llm_router.post(
    "/invoke",
    responses={status.HTTP_200_OK: MockResponse.INVOKE_RESPONSE},
    name="Invoke Graph",
    dependencies=[Depends(get_optional_user)],
)
@limiter.limit(TIME_LIMIT)
async def llm_invoke(
    request: Request,
    params: LLMRequest = Body(openapi_examples=Examples.LLM_INVOKE_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
    store=Depends(get_store),
) -> dict[str, Any] | Any:
    if user:
        service_context = ServiceContext(user_id=user.id, store=store)
        if params.metadata.assistant_id:
            assistant: Assistant = await service_context.assistant_service.get(params.metadata.assistant_id)
            params = assistant.to_llm_request(
                messages=params.messages,
                model=params.model,
                metadata=params.metadata,
            )
    async with get_checkpoint_db() as checkpointer:
        agent = await construct_agent(params, checkpointer, service_context.store)
        response = await agent.invoke(
            {"messages": params.to_langchain_messages()},
            context={"user_id": user.id} if user else None,
        )
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
    params: LLMRequest = Body(openapi_examples=Examples.LLM_STREAM_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
    store=Depends(get_store),
) -> StreamingResponse:
    """
    Streams LLM output as server-sent events (SSE).
    """
    try:
        if user:
            service_context = ServiceContext(user_id=user.id, store=store)
            if params.metadata.assistant_id:
                assistant: Assistant = await service_context.assistant_service.get(params.metadata.assistant_id)
                params = assistant.to_llm_request(
                    messages=params.messages,
                    model=params.model,
                    metadata=params.metadata,
                )
        stream_gen = stream_generator(params, service_context)
        return StreamingResponse(
            stream_gen,
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
    if not GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="GROQ API key not found")
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
# @llm_router.post(
#     "/chat",
#     name="Chat Completion",
#     responses={
#         status.HTTP_200_OK: {
#             "description": "Chat completion response.",
#             "content": {
#                 "application/json": {
#                     "example": Answer.model_json_schema()["examples"]["new_thread"]
#                 },
#             },
#         }
#     },
# )
# @limiter.limit(TIME_LIMIT)
# async def chat_completion(
#     request: Request,
#     body: Annotated[ChatInput, Body()],
#     user: ProtectedUser = Depends(get_optional_user),
#     # db: AsyncSession = Depends(get_async_db)
# ):
#     try:
#         model = body.model.split(":")
#         provider = model[0]
#         model_name = model[1]
#         llm = init_chat_model(
#             model=model_name,
#             model_provider=provider,
#             temperature=0.9,
#             # max_tokens=1000,
#             max_retries=3,
#             # timeout=1000
#         )
#         response = await llm.ainvoke(
#             [
#                 {"role": "system", "content": body.system},
#                 {"role": "user", "content": body.query},
#             ]
#         )
#         return JSONResponse(
#             content={"answer": response.model_dump()},
#             media_type="application/json",
#             status_code=200,
#         )
#     except Exception as e:
#         logger.exception(str(e))
#         raise HTTPException(status_code=500, detail=str(e))


@llm_router.get(
    "/models",
    name="List Models",
)
async def list_models():
    chat_models = sorted({model.value for model in ChatModels})
    return JSONResponse(content={"models": chat_models}, status_code=200)
