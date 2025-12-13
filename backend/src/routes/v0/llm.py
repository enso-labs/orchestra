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
from src.services.presidio import PresidioException
from src.services.prompt.optimize import PromptOptimizer, PromptOptimizerRequest
from src.constants import GROQ_API_KEY
from src.schemas.models import ProtectedUser
from src.utils.auth import get_optional_user
from src.utils.logger import logger
from src.constants.mock import MockResponse
from src.constants.examples import Examples
from src.schemas.entities import LLMRequest
from src.utils.llm import audio_to_text
from src.flows import init_config
from src.services.db import get_store
from src.utils.rate_limit import limiter
from src.constants.llm import ChatModels, get_all_models, get_free_models

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
    config = init_config(params, user.id)
    llm_controller = LLMController(user=user, store=store, config=config)
    response = await llm_controller.llm_invoke(params)
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
    store: BaseStore = Depends(get_store),
) -> StreamingResponse:
    """
    Streams LLM output as server-sent events (SSE).
    """
    try:
        config = init_config(params, user.id)
        llm_controller = LLMController(user=user, store=store, config=config)
        assistant = await llm_controller.llm_stream(params)
        return StreamingResponse(
            assistant,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    except PresidioException as e:
        logger.warning(f"Sensitive data detected in the query: {e.results}")
        return JSONResponse(
            content={"error": e.message, "results": e.results},
            media_type="application/json",
            status_code=status.HTTP_400_BAD_REQUEST,
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
@llm_router.post("/optimize")
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
)
async def list_models():
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "default": ChatModels.DEFAULT.value,
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
)
async def reset_models():
    llm_service._reset_cache()
    return JSONResponse(
        status_code=status.HTTP_200_OK, content={"message": "Models reset successfully"}
    )
