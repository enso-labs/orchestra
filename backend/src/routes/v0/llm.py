import os
from typing import Any, List
from uuid import uuid4
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
from langgraph.store.base import BaseStore
from langmem.prompts.types import (
    OptimizerInput,
)
from src.controllers.llm import LLMController
from src.services.llm import llm_service
from src.services.prompt.optimize import PromptOptimizer, PromptOptimizerRequest
from src.constants import GROQ_API_KEY
from src.schemas.models import ProtectedUser
from src.utils.auth import get_optional_user, get_optional_user_from_token
from src.utils.logger import logger
from src.constants.mock import MockResponse
from src.constants.examples import Examples
from src.schemas.entities import LLMRequest
from src.utils.llm import audio_to_text
from src.agents import init_config
from src.services.db import get_store
from src.utils.rate_limit import limiter
from src.constants.llm import DEFAULT_CHAT_MODEL, get_all_models, get_free_models
from src.repos.user_settings_repo import UserSettingsRepo

# Distributed workers mode - when true, tasks are enqueued to TaskIQ workers
DISTRIBUTED_WORKERS = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"

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
    operation_id="ruska_invoke_llm",
    tags=["mcp"],
    dependencies=[Depends(get_optional_user)],
)
@limiter.limit(TIME_LIMIT)
async def llm_invoke(
    request: Request,
    params: LLMRequest = Body(openapi_examples=Examples.LLM_INVOKE_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
    store=Depends(get_store),
) -> dict[str, Any] | Any:
    user_id = user.id if user else None
    config = init_config(params, user_id=user_id)
    llm_controller = LLMController(user_id=user_id, store=store, config=config)
    response = await llm_controller.llm_invoke(params)
    return response


################################################################################
### Stream Graph
################################################################################
@llm_router.post(
    "/stream",
    responses={status.HTTP_200_OK: MockResponse.STREAM_RESPONSE},
    name="Stream Graph",
    response_model=None,  # Allow multiple response types (SSE or JSON)
)
@limiter.limit(TIME_LIMIT)
async def llm_stream(
    request: Request,
    params: LLMRequest = Body(openapi_examples=Examples.LLM_STREAM_EXAMPLES),
    user: ProtectedUser = Depends(get_optional_user),
    store: BaseStore = Depends(get_store),
):
    """
    Streams LLM output as server-sent events (SSE).

    When DISTRIBUTED_WORKERS=true, the task is enqueued to a worker and
    returns {thread_id, distributed: true}. The client should then poll
    GET /threads/{thread_id}/stream to receive the SSE stream.
    """
    try:
        user_id = user.id if user else None
        thread_id = (
            params.metadata.thread_id
            if params.metadata and params.metadata.thread_id
            else str(uuid4())
        )
        config = init_config(params, user_id=user_id)

        # Distributed mode: enqueue task and return thread_id for polling
        if DISTRIBUTED_WORKERS:
            from src.workers.tasks import run_agent_stream

            # Ensure thread_id is set in metadata
            if params.metadata:
                params.metadata.thread_id = thread_id

            await run_agent_stream.kiq(
                task_dict=params.model_dump(),
                user_id=str(user_id) if user_id else "",
                thread_id=thread_id,
            )

            logger.info(f"Enqueued distributed task for thread: {thread_id}")

            return JSONResponse(
                content={"thread_id": thread_id, "distributed": True},
                status_code=status.HTTP_202_ACCEPTED,
                headers={"Cache-Control": "no-cache"},
            )

        # Sync mode: direct streaming (existing behavior)
        llm_controller = LLMController(user_id=user_id, store=store, config=config)
        assistant = await llm_controller.llm_stream(params)
        return StreamingResponse(
            assistant,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    except Exception as e:
        logger.exception(f"Error in llm_stream: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


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
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


################################################################################
### Optimize Prompt
################################################################################
@llm_router.post("/optimize", operation_id="ruska_optimize_prompt")
@limiter.limit(TIME_LIMIT)
async def optimize_prompt(
    request: Request,
    body: PromptOptimizerRequest = Body(...),
    user: ProtectedUser = Depends(get_optional_user),
):
    optimizer = PromptOptimizer(body.model)
    optimizer_input = OptimizerInput(
        trajectories=body.trajectories,
        prompt=body.prompt,
    )
    result = await optimizer.optimize(optimizer_input, body.kind, body.config)
    return JSONResponse(content={"result": result}, status_code=200)


################################################################################
### List Models
################################################################################
@llm_router.get(
    "/models",
    name="List Models",
    operation_id="ruska_list_models",
    tags=["mcp"],
)
async def list_models(
    user: ProtectedUser = Depends(get_optional_user_from_token),
    store: BaseStore = Depends(get_store),
):
    # Default to system-wide default
    default_model = DEFAULT_CHAT_MODEL

    # If user is authenticated, check for their preferred default model
    if user:
        try:
            settings_repo = UserSettingsRepo(user.id, store)
            settings, _ = await settings_repo.get_settings()
            if settings.default_model:
                default_model = settings.default_model
        except Exception:
            # Fall back to system default on any error
            pass

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "default": default_model,
            "free": get_free_models(),
            "models": get_all_models(),
        },
    )


################################################################################
### Reset Models
################################################################################
@llm_router.get(
    "/models/reset",
    name="Reset Models",
    operation_id="ruska_reset_models",
    tags=["mcp"],
)
async def reset_models():
    llm_service._reset_cache()
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": "Models reset successfully"}
    )
