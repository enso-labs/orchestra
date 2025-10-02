# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver
from fastapi import APIRouter, Body, HTTPException, Depends, status
from fastapi.responses import Response
from src.schemas.entities import ThreadSearch
from src.utils.logger import logger
from src.services.checkpoint import checkpoint_service
from src.services.thread import thread_service
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store, get_checkpointer
from src.utils.auth import verify_credentials
from langchain_core.runnables import RunnableConfig
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import StateSnapshot
from src.utils.messages import from_message_to_dict

router = APIRouter(tags=["Thread"])


@router.post("/threads/search", name="Query Threads in Checkpointer")
async def search_threads(
    thread_search: ThreadSearch = Body(
        openapi_examples=Examples.THREAD_SEARCH_EXAMPLES
    ),
    user: ProtectedUser = Depends(verify_credentials),
    checkpointer: AsyncPostgresSaver = Depends(get_checkpointer),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        thread_service.store = store
        thread_service.user_id = user.id
        filter = thread_search.model_dump(exclude_none=True).get("filter", {})
        if "thread_id" in filter and not "checkpoint_id" in filter:
            thread_id = filter["thread_id"]
            checkpoints = []
            config = RunnableConfig(configurable={"thread_id": thread_id})
            checkpoint_generator = checkpointer.alist(config)
            async for checkpoint in checkpoint_generator:
                messages = (
                    checkpoint.checkpoint["channel_values"]
                    .get("__start__", {})
                    .get("messages", [])
                    or checkpoint.checkpoint["channel_values"].get("messages", [])
                    or []
                )
                snapshot = StateSnapshot(
                    values={"messages": from_message_to_dict(messages)},
                    config=checkpoint.config,
                    parent_config=checkpoint.parent_config,
                    metadata=checkpoint.metadata,
                    created_at=checkpoint.checkpoint["ts"],
                    interrupts=[],
                    next=[],
                    tasks=[],
                )
                formatted_snapshot = snapshot._asdict()
                del formatted_snapshot["tasks"]
                checkpoints.append(formatted_snapshot)
            if checkpoints is None:
                raise HTTPException(status_code=404, detail="Checkpoints not found")
            return {"checkpoints": checkpoints}

        threads = await thread_service.search(filter=filter)
        return {"threads": threads}
    except Exception as e:
        logger.exception(f"Error searching threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/threads/{thread_id}", name="Delete Thread")
async def delete_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store=Depends(get_store),
    checkpointer=Depends(get_checkpointer),
):
    try:
        thread_service.store = store
        thread_service.user_id = user.id
        checkpoint_service.checkpointer = checkpointer
        checkpoint_service.user_id = user.id
        await checkpoint_service.delete_checkpoints_for_thread(thread_id)
        success = await thread_service.delete(thread_id)
        if not success:
            raise HTTPException(status_code=404, detail="Thread not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))
