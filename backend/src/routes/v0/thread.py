# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver
import uuid
from fastapi import APIRouter, Body, HTTPException, Depends, status
from fastapi.responses import Response, UJSONResponse, StreamingResponse
from fastapi_cache.decorator import cache
from langgraph.graph.state import RunnableConfig
from src.schemas.entities.store import Thread
from src.contexts.service import ServiceContext
from src.schemas.entities import SearchFilter, ThreadSemanticSearchRequest
from src.schemas.entities.hitl import (
    InterruptListResponse,
    ResumeRequest,
    ResumeResponse,
)
from src.utils.logger import logger
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store, get_checkpoint_db
from src.services.checkpoint import CheckpointService
from src.utils.auth import verify_credentials, get_optional_user_from_token
from src.flows import graph_builder
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.checkpoint.base import (
    empty_checkpoint,
    CheckpointMetadata,
    ChannelVersions,
)

from src.utils.stream import stream_from_redis

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
                and "checkpoint_id" not in search_filter.filter
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


################################################################################
### HITL Endpoints
################################################################################
@router.get(
    "/threads/{thread_id}/interrupts",
    response_model=InterruptListResponse,
    name="Get Thread Interrupts",
    operation_id="ruska_get_thread_interrupts",
    tags=["HITL"],
)
async def get_thread_interrupts(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Get pending interrupts for a thread.

    Returns interrupt information including tool name, arguments, and allowed actions
    for human-in-the-loop approval workflows.
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # First, verify the thread exists
            thread = await service_context.thread_service.get(thread_id)
            if not thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Thread {thread_id} not found",
                )

            # Create a minimal graph to query interrupt state
            # The graph needs the checkpointer to access state
            graph = graph_builder(
                tools=[],
                checkpointer=checkpointer,
                store=store,
            )

            # Create checkpoint service with the graph
            checkpoint_service = CheckpointService(
                user_id=user.id,
                checkpointer=checkpointer,
                graph=graph,
            )

            # Get interrupts from the checkpoint state
            interrupts = await checkpoint_service.get_interrupts(thread_id)

            return InterruptListResponse(
                thread_id=thread_id,
                has_interrupts=len(interrupts) > 0,
                interrupts=interrupts,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting interrupts for thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/threads/{thread_id}/resume",
    response_model=ResumeResponse,
    name="Resume Thread with Decision",
    operation_id="ruska_resume_thread",
    tags=["HITL"],
)
async def resume_thread(
    thread_id: str,
    request: ResumeRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Resume an interrupted thread with a human decision.

    Submits a decision (accept, edit, response, or reject) to resume a paused
    thread. The decision must be one of the allowed actions for the current interrupt.
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # First, verify the thread exists
            thread = await service_context.thread_service.get(thread_id)
            if not thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Thread {thread_id} not found",
                )

            # Create a minimal graph to interact with the thread state
            graph = graph_builder(
                tools=[],
                checkpointer=checkpointer,
                store=store,
            )

            # Create checkpoint service with the graph
            checkpoint_service = CheckpointService(
                user_id=user.id,
                checkpointer=checkpointer,
                graph=graph,
            )

            # Get current interrupts to validate decision_type
            interrupts = await checkpoint_service.get_interrupts(thread_id)

            if not interrupts:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"No pending interrupt for thread {thread_id}",
                )

            # Validate each decision against the interrupt's allowed_actions
            for i, decision in enumerate(request.decisions):
                if i < len(interrupts):
                    interrupt = interrupts[i]
                    if decision.decision_type not in interrupt.config.allowed_actions:
                        allowed = [a.value for a in interrupt.config.allowed_actions]
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Decision type '{decision.decision_type.value}' not allowed. Allowed actions: {allowed}",
                        )

            # Resume the thread with the provided decisions
            result = await checkpoint_service.resume_with_decision(
                thread_id=thread_id,
                decisions=request.decisions,
            )

            if not result.success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result.message,
                )

            return result

    except HTTPException:
        raise
    except ValueError as e:
        # Handle case where resume_with_decision raises ValueError
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        logger.exception(f"Error resuming thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
