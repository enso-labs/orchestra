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
from langchain_core.runnables import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langmem.prompts.types import (
    OptimizerInput,
)
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
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    if user:
        service_context = ServiceContext(user_id=user.id, store=store)
        if params.metadata.assistant_id:
            assistant: Assistant = await service_context.assistant_service.get(
                params.metadata.assistant_id
            )
            params = assistant.to_llm_request(
                messages=params.messages,
                model=params.model,
                metadata=params.metadata,
            )
    async with get_checkpoint_db() as checkpointer:
        agent = await construct_agent(params, checkpointer, service_context.store)
        response = await agent.invoke(
            {"messages": params.to_langchain_messages()},
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
        params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
        config = RunnableConfig(
            configurable={
                "user_id": user.id if user else None,
                "thread_id": params.metadata.thread_id or str(uuid4()),
                "assistant_id": params.metadata.assistant_id or None,
            },
            max_concurrency=4,
            recursion_limit=100,
        )
        service_context = ServiceContext(config=config, store=store)
        params = await process_presidio(params, service_context.presidio_service)
        ### Collect all tools
        tools = []
        for tool in params.tools:
            struct_tools = await service_context.tool_service.tool_repo.search(filter={"name": tool})
            tools.append(struct_tools[0])
        a2a = A2AServers(a2a=params.a2a).fetch_agent_cards_as_tools(params.metadata.thread_id)
        mcp = await service_context.tool_service.mcp_tools(params.mcp)
        tools = tools + a2a + mcp
        
        if params.metadata.assistant_id:
            assistant: Assistant = await service_context.assistant_service.get(
                params.metadata.assistant_id,
            )
            params = assistant.to_llm_request(
                messages=params.messages,
                model=params.model,
                metadata=params.metadata,
            )
        return StreamingResponse(
            stream_generator(
                params.to_langchain_messages(),
                params.model,
                params.system,
                tools,
                params.subagents,
                {
                    'configurable': {
                        'user_id': user.id if user else None,
                        'thread_id': params.metadata.thread_id or str(uuid4()),
                        'assistant_id': params.metadata.assistant_id or None,
                    }
                },
                service_context,
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
    chat_models = sorted({model.value for model in ChatModels})
    return JSONResponse(content={"models": chat_models}, status_code=200)
