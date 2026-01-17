# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver
import uuid
from fastapi import APIRouter, Body, HTTPException, Depends, status
from fastapi.responses import Response, UJSONResponse, StreamingResponse
from fastapi_cache.decorator import cache
from langgraph.graph.state import RunnableConfig
from src.schemas.entities.store import Thread
from src.contexts.service import ServiceContext
from src.schemas.entities import SearchFilter, ThreadSemanticSearchRequest
from src.schemas.entities.interrupt import (
    InterruptRequest,
    InterruptResponse,
    InterruptList,
    Interrupt,
)
from src.services.interrupt import (
    InterruptService,
    InterruptNotFoundError,
    InterruptExpiredError,
    InterruptAuthorizationError,
    InterruptValidationError,
)
from src.utils.logger import logger
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store, get_checkpoint_db
from src.utils.auth import verify_credentials, get_optional_user_from_token
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.checkpoint.base import (
    empty_checkpoint,
    CheckpointMetadata,
    ChannelVersions,
)

from src.utils.stream import stream_from_redis

# Imports for graph reconstruction in resume_thread
from deepagents.backends import StoreBackend
from langchain.tools import ToolRuntime
from src.schemas.entities import LLMRequest
from src.schemas.entities.llm import LLMInput, Config as LLMConfig
from src.schemas.contexts import ContextSchema
from src.flows import construct_agent, init_config, init_backend

router = APIRouter(tags=["Thread"])


@router.post(
    "/threads/search",
    name="Query Threads in Checkpointer",
    operation_id="ruska_search_threads",
    tags=["mcp"],
)
@cache(expire=15)
async def search_threads(
    search_filter: SearchFilter = Body(
        openapi_examples=Examples.THREAD_SEARCH_EXAMPLES
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            if (
                "thread_id" in search_filter.filter
                and not "checkpoint_id" in search_filter.filter
            ):
                checkpoints = await service_context.checkpoint_service.list_checkpoints(
                    thread_id=search_filter.filter["thread_id"]
                )
                thread: Thread = await service_context.thread_service.get(
                    search_filter.filter["thread_id"]
                )
                if thread and len(checkpoints) > 0:
                    checkpoints[0]["metadata"]["files"] = thread.files
                    checkpoints[0]["metadata"]["todos"] = thread.todos
                return {"checkpoints": checkpoints}

            threads = await service_context.thread_service.search(search_filter)
            return {"threads": threads}
    except Exception as e:
        logger.exception(f"Error searching threads: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/threads/search/semantic",
    name="Semantic Search Over Threads",
    operation_id="ruska_semantic_search_threads",
    tags=["mcp"],
)
async def semantic_search_threads(
    request: ThreadSemanticSearchRequest = Body(
        openapi_examples=Examples.THREAD_SEMANTIC_SEARCH_EXAMPLES
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        # Validate query is not empty
        if not request.query or request.query.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="query field is required and must not be empty",
            )

        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Perform semantic search
            search_results = (
                await service_context.thread_service.thread_snapshot_repo.search(
                    query=request.query,
                    limit=request.limit,
                    assistant_id=request.assistant_id,
                )
            )

            # Enrich results with thread titles
            enriched_results = []
            for result in search_results:
                thread_id = result.get("thread_id")
                if thread_id:
                    # Fetch thread data to get title
                    thread_data = await service_context.thread_service.get(thread_id)
                    title = "Untitled Thread"
                    if thread_data and thread_data.value:
                        # Try to get title from thread data, fallback to first message
                        title = thread_data.value.get("title", title)

                    enriched_results.append(
                        {
                            "thread_id": thread_id,
                            "title": title,
                            "excerpt": result.get("excerpt", ""),
                            "score": result.get("score", 0.0),
                            "updated_at": result.get("updated_at"),
                        }
                    )

            return {"results": enriched_results}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error performing semantic search: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/threads",
    name="Create Thread",
    operation_id="ruska_create_thread",
    tags=["mcp"],
)
async def create_thread(
    thread: Thread = Body(openapi_examples=Examples.THREAD_CREATE_EXAMPLES),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            assistant_id = thread.metadata.get("assistant_id", None)
            if assistant_id:
                assistant = await service_context.assistant_service.get(assistant_id)
                if not assistant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Assistant not found",
                    )

            thread.id = str(uuid.uuid4())
            checkpoint = empty_checkpoint()
            await service_context.thread_service.update(
                thread.id, thread.model_dump(exclude_none=True)
            )
            saved = await checkpointer.aput(
                config=RunnableConfig(
                    configurable={
                        "thread_id": thread.id,
                        "checkpoint_id": checkpoint.get("id"),
                        "checkpoint_ns": checkpoint.get("ns", ""),
                        "assistant_id": assistant_id,
                    }
                ),
                checkpoint=checkpoint,
                metadata=CheckpointMetadata(
                    source="input",
                    step=-1,
                    files=thread.files,
                    todos=thread.todos,
                    assistant_id=thread.metadata.get("assistant_id", None),
                ),
                new_versions=ChannelVersions(),
            )
            return saved["configurable"]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get(
    "/threads/{thread_id}",
    name="Get Thread",
    operation_id="ruska_get_thread",
    tags=["mcp"],
)
async def get_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            thread = await service_context.thread_service.get(thread_id)
            return {"thread": thread.model_dump(exclude_none=True)}
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
        )
    except Exception as e:
        logger.exception(f"Error getting thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        ) from e


@router.get(
    "/threads/{thread_id}/stream",
    name="Stream Thread Results",
    operation_id="ruska_stream_thread",
    tags=["Thread"],
)
async def stream_thread(
    thread_id: str,
    user: ProtectedUser = Depends(get_optional_user_from_token),
):
    """
    Stream results from a distributed worker via SSE.

    Use this endpoint after POST /llm/stream returns {"distributed": true}.
    The client should connect to this endpoint to receive the streaming
    response from the background worker.

    Args:
        thread_id: The thread ID returned from the distributed /llm/stream call.

    Returns:
        StreamingResponse with SSE events containing the agent output.
    """
    try:
        return StreamingResponse(
            stream_from_redis(thread_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )
    except Exception as e:
        logger.exception(f"Error streaming thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


@router.patch(
    "/threads/{thread_id}",
    name="Update Thread",
    operation_id="ruska_update_thread",
    tags=["mcp"],
)
async def update_thread(
    thread_id: str,
    thread: Thread = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            # Get existing thread data
            existing = await service_context.thread_service.get(thread_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found"
                )

            # Merge updates with existing data
            updated_data = {**existing.value, **thread.model_dump(exclude_none=True)}
            update_message = f"Thread {thread_id} updated with fields: {', '.join(thread.model_dump(exclude_none=True).keys())}"
            logger.info(update_message)
            await service_context.thread_service.update(thread_id, updated_data)
            return UJSONResponse(
                status_code=status.HTTP_200_OK,
                content={"thread_id": thread_id, "message": update_message},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.delete(
    "/threads/{thread_id}",
    name="Delete Thread",
    operation_id="ruska_delete_thread",
    tags=["mcp"],
)
async def delete_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store=Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            await service_context.delete_thread(thread_id)
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.delete(
    "/a/{assistant_id}/threads/{thread_id}",
    name="Delete Assistant Thread",
    operation_id="ruska_delete_assistant_thread",
    tags=["mcp"],
)
async def delete_thread(
    assistant_id: str,
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store=Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )
            await service_context.delete_thread(thread_id)
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------------------------------------------
# Human-In-The-Loop (HITL) Endpoints
# -----------------------------------------------------------------------------


@router.post(
    "/threads/{thread_id}/resume",
    name="Resume Thread After HITL Interrupt",
    operation_id="ruska_resume_thread",
    tags=["HITL"],
    response_model=InterruptResponse,
)
async def resume_thread(
    thread_id: str,
    request: InterruptRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Resume a paused thread after a human-in-the-loop interrupt decision.

    This endpoint is called when a user approves, edits, or rejects a pending
    tool call that required human approval. The agent graph is reconstructed
    to handle the interrupt decision and resume execution.

    Args:
        thread_id: The thread ID to resume
        request: The interrupt decision (approve, edit, reject, or respond)

    Returns:
        InterruptResponse with the resolution status

    Raises:
        404: Interrupt not found or thread/assistant not found
        403: User doesn't own this thread
        400: Invalid request (expired, already resolved, validation failed)
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Step 1: Get thread data to find assistant_id
            thread_data = await service_context.thread_service.get(thread_id)
            if not thread_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Thread {thread_id} not found",
                )

            # Extract assistant_id from thread metadata or checkpoint
            assistant_id = None
            if thread_data.metadata:
                assistant_id = thread_data.metadata.get("assistant_id")

            # If not in thread metadata, check checkpoint metadata
            if not assistant_id:
                checkpoints = await service_context.checkpoint_service.list_checkpoints(
                    thread_id=thread_id, limit=1
                )
                if checkpoints and checkpoints[0].get("metadata"):
                    assistant_id = checkpoints[0]["metadata"].get("assistant_id")

            if not assistant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot resume thread: no assistant_id found in thread or checkpoint data",
                )

            # Step 2: Load assistant configuration
            assistant = await service_context.assistant_service.get(assistant_id)
            if not assistant:
                # Try public namespace
                assistant = await service_context.assistant_service.get_public(
                    assistant_id
                )
            if not assistant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Assistant {assistant_id} not found",
                )

            # Step 3: Build LLMRequest from assistant config
            llm_input = LLMInput(messages=[])
            llm_config = LLMConfig(
                thread_id=thread_id,
                assistant_id=assistant_id,
                user_id=user.id,
            )
            params = LLMRequest(
                input=llm_input,
                metadata=llm_config,
                model=assistant.model,
                system_prompt=assistant.system_prompt,
                instructions=assistant.instructions,
                tools=assistant.tools or [],
                subagents=assistant.subagents or [],
            )

            # Step 4: Initialize config
            config = init_config(params, user.id)

            # Step 5: Create a new ServiceContext WITH the config for LLM operations
            service_context_with_config = ServiceContext(
                user_id=user.id,
                store=store,
                checkpointer=checkpointer,
                config=config,
            )

            # Step 6: Process assistant to get initialized tools
            params = await service_context_with_config.llm_service.assistant(params)

            # Step 7: Initialize runtime and backend (following tasks.py pattern)
            files_map = config["configurable"].get("files", {})
            ctx_schema = ContextSchema(model=params.model or "", user_id=user.id)
            runtime = ToolRuntime(
                state={"messages": [], "files": files_map},
                context=ctx_schema,
                tool_call_id="tc_resume",
                store=service_context_with_config.store,
                stream_writer=lambda _: None,
                config=config,
            )
            store_backend = StoreBackend(runtime)
            routes = {
                f"/users/{user.id}/memories/": store_backend,
                f"/users/{user.id}/config/": store_backend,
            }
            backend = init_backend(runtime, routes=routes)

            # Step 8: Construct the agent graph
            agent = await construct_agent(
                instructions=params.instructions,
                system_prompt=params.system_prompt,
                tools=params.tools,
                model=params.model,
                subagents=params.subagents,
                checkpointer=checkpointer,
                service_context=service_context_with_config,
                backend=backend,
            )

            # Step 9: Create interrupt service WITH the graph
            interrupt_service = InterruptService(
                user_id=user.id,
                graph=agent.graph,
            )

            # Step 10: Handle the decision (pass thread_id for fallback lookup)
            await interrupt_service.handle_decision(request, thread_id=thread_id)

            logger.info(
                f"Thread {thread_id} resumed with action: {request.action.value}"
            )

            return InterruptResponse(
                status="resumed",
                interrupt_id=request.interrupt_id,
                thread_id=thread_id,
                message=f"Thread resumed with action: {request.action.value}",
            )

    except InterruptNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except InterruptExpiredError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except InterruptAuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InterruptValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error resuming thread {thread_id}: {e}")
        # Include error details for debugging (TODO: remove in production)
        import traceback

        error_details = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_details,
        )


@router.get(
    "/threads/{thread_id}/interrupts",
    name="Get Pending Interrupts for Thread",
    operation_id="ruska_get_thread_interrupts",
    tags=["HITL"],
    response_model=InterruptList,
)
async def get_thread_interrupts(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """Get all pending interrupts for a thread.

    Use this endpoint to check for pending approval requests when reconnecting
    to a thread after a connection drop, or to poll for interrupt status.

    Args:
        thread_id: The thread ID to get interrupts for

    Returns:
        InterruptList containing all pending interrupts for the thread
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Get pending interrupts for this thread
            interrupt_service = InterruptService(user_id=user.id)
            pending = interrupt_service.get_pending_interrupts(thread_id)

            return InterruptList(interrupts=pending)

    except Exception as e:
        logger.exception(f"Error getting interrupts for thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
