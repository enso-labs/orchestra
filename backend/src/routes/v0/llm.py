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
from src.services.llm import llm_service
from src.schemas.entities.a2a import A2AServers
from src.services.presidio import PresidioException, process_presidio
from src.services.prompt.optimize import PromptOptimizer, PromptOptimizerRequest
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
from src.flows import construct_agent, init_config
from src.services.assistant import Assistant
from src.services.db import get_store, get_checkpoint_db
from src.utils.rate_limit import limiter
from src.constants.llm import ChatModels, get_all_models, get_free_models
from src.tools import default_tools

llm_router = APIRouter(tags=["LLM"], prefix="/llm")

# TIME_LIMIT = "1/minute"
TIME_LIMIT = "200/day"


def validate_system_prompt_fields(params: LLMRequest, assistant: Assistant = None) -> None:
    """
    Validate that system_prompt and instructions are not both provided.

    Precedence logic:
    1. LLMRequest.system_prompt (complete override)
    2. Assistant.system_prompt (complete override)
    3. Assistant.instructions (or legacy prompt) (injected into default)
    4. Default system prompt

    Raises HTTPException if both system_prompt and instructions are provided.
    """
    has_request_system_prompt = params.system_prompt is not None
    has_request_instructions = params.instructions is not None
    has_assistant_system_prompt = assistant and assistant.system_prompt is not None
    has_assistant_instructions = assistant and (assistant.instructions is not None or assistant.prompt)

    # Check for conflict at request level
    if has_request_system_prompt and has_request_instructions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot provide both 'system_prompt' and 'instructions'. "
                   "Use 'system_prompt' for complete override or 'instructions' to extend the default template."
        )

    # Check for conflict when mixing request and assistant fields
    if has_request_system_prompt and has_assistant_instructions:
        # This is OK - request system_prompt overrides everything
        pass

    if has_request_instructions and has_assistant_system_prompt:
        # This is OK - request instructions will be ignored in favor of assistant system_prompt
        pass

    # Check for conflict at assistant level
    if assistant and has_assistant_system_prompt and has_assistant_instructions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assistant cannot have both 'system_prompt' and 'instructions'. "
                   "Use 'system_prompt' for complete override or 'instructions' to extend the default template."
        )


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
    params.input.to_langchain_messages()
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    assistant = None
    if user:
        service_context = ServiceContext(user_id=user.id, store=store)
        if params.metadata.assistant_id:
            assistant: Assistant = await service_context.assistant_service.get(
                params.metadata.assistant_id
            )
            # Validate before converting to avoid conflicts
            validate_system_prompt_fields(params, assistant)
            params = assistant.to_llm_request(
                input=params.input,
                model=params.model,
                metadata=params.metadata,
            )
    else:
        # Validate request-level fields even without assistant
        validate_system_prompt_fields(params, assistant)

    async with get_checkpoint_db() as checkpointer:
        agent = await construct_agent(params, checkpointer, service_context.store)
        response = await agent.invoke(params.input)
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
        # Convert API messages to LangChain message objects
        params.input.to_langchain_messages()
        # Initialize thread id
        params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
        # Initialize config
        config = init_config(params, user)
        service_context = ServiceContext(config=config, store=store)
        params = await process_presidio(params, service_context.presidio_service)
        ### Collect all tools
        tool_map = {t.name: t for t in default_tools()}  # O(n) index
        TOOLS = (
            A2AServers(a2a=params.a2a).fetch_agent_cards_as_tools(
                config["configurable"].get("thread_id")
            )
            + await service_context.tool_service.mcp_tools(params.mcp)
            + [tool_map[name] for name in (params.tools or ()) if name in tool_map]
        )

        if user:
            for tool in params.tools:
                items = await service_context.tool_service.tool_repo.search(
                    filter={"name": tool}
                )
                if items:
                    structured_tool = items[0]
                    tool_metadata = {structured_tool.name: structured_tool.metadata}
                    config["metadata"] = {**tool_metadata, **config["metadata"]}
                    TOOLS.append(structured_tool)

        assistant = None
        if config["configurable"].get("assistant_id"):
            assistant: Assistant = await service_context.assistant_service.get(
                config["configurable"].get("assistant_id"),
            )
            # Validate before converting to avoid conflicts
            validate_system_prompt_fields(params, assistant)
            params = assistant.to_llm_request(
                input=params.input,
                model=params.model,
                metadata=config["metadata"],
            )
        else:
            # Validate request-level fields even without assistant
            validate_system_prompt_fields(params, assistant)

        # Determine system_prompt and instructions based on precedence
        # Precedence: LLMRequest.system_prompt > Assistant.system_prompt > Assistant.instructions > default
        final_system_prompt = params.system  # Default (DEFAULT_SYSTEM_PROMPT)
        final_instructions = None

        if params.system_prompt:
            # Request-level system_prompt overrides everything
            final_system_prompt = params.system_prompt
            final_instructions = None
        elif params.instructions:
            # Request-level instructions extend the default
            final_system_prompt = params.system
            final_instructions = params.instructions
        # else: use default system prompt (already set)

        return StreamingResponse(
            stream_generator(
                params.input,
                params.model,
                final_system_prompt,
                TOOLS,
                params.subagents,
                service_context.config,
                service_context,
                final_instructions,
            ),
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
            "default": ChatModels.OPENAI_GPT_5_NANO.value,
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
