"""Non-graph LLM utilities retained under Orchestra's custom API.

Interactive invocation and streaming belong to Aegra's root Agent Protocol
routes.  This module deliberately has no import of ``LLMController``, workers,
or the legacy SSE transport.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache

from src.constants import GROQ_API_KEY
from src.constants.llm import DEFAULT_CHAT_MODEL, DEFAULT_REASONING_EFFORT, get_all_models, get_free_models
from src.repos.user_settings_repo import UserSettingsRepo
from src.services.db import get_store
from src.utils.llm import audio_to_text
from src.utils.reasoning import get_reasoning_options
from src.utils.rate_limit import limiter
from src.utils.auth import get_optional_user_from_token
from src.utils.logger import logger

try:
    from aegra_auth import get_optional_custom_user
except ImportError:  # pragma: no cover - standalone legacy import fallback
    get_optional_custom_user = get_optional_user_from_token


router = APIRouter(tags=["LLM"], prefix="/llm")
TIME_LIMIT = "200/day"


@router.post("/transcribe")
@limiter.limit(TIME_LIMIT)
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form("whisper-large-v3"),
    prompt: str | None = Form(None),
    response_format: str | None = Form(None),
    temperature: float | None = Form(None),
    timeout: float | None = Form(None),
):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="GROQ API key not found")
    try:
        transcript = audio_to_text(
            file.filename,
            await file.read(),
            model,
            prompt,
            response_format,
            temperature,
            timeout,
        )
        return JSONResponse(content={"transcript": transcript.model_dump()}, status_code=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception("transcription_failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/models", name="List Models", operation_id="ruska_list_models")
@cache(expire=30)
async def list_models(
    request: Request,
    user: Any = Depends(get_optional_custom_user),
    store=Depends(get_store),
):
    default_model = DEFAULT_CHAT_MODEL
    default_reasoning_effort = DEFAULT_REASONING_EFFORT
    if user:
        try:
            settings_repo = UserSettingsRepo(user.id, store)
            settings, _ = await settings_repo.get_settings()
            if settings.default_model:
                default_model = settings.default_model
            if settings.default_reasoning_effort is not None:
                default_reasoning_effort = settings.default_reasoning_effort
        except Exception:
            logger.warning("failed_to_load_user_model_settings")

    models = get_all_models()
    reasoning = {model: options for model in models if (options := get_reasoning_options(model))}
    return {
        "default": default_model,
        "default_reasoning_effort": default_reasoning_effort,
        "free": get_free_models(),
        "models": models,
        "reasoning": reasoning,
    }


@router.get("/models/reset", name="Reset Models", operation_id="ruska_reset_models")
async def reset_models() -> dict[str, str]:
    from src.services.llm import llm_service

    llm_service._reset_cache()
    return {"message": "Models reset successfully"}


__all__ = ["router"]
