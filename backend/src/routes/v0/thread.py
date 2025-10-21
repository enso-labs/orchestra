# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver
from fastapi import APIRouter, Body, HTTPException, Depends, status
from fastapi.responses import Response
from src.contexts.service import ServiceContext
from src.schemas.entities import ThreadSearch
from src.utils.logger import logger
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.services.db import get_store, get_checkpoint_db
from src.utils.auth import verify_credentials
from langgraph.store.postgres import AsyncPostgresStore

router = APIRouter(tags=["Thread"])


@router.post("/threads/search", name="Query Threads in Checkpointer")
async def search_threads(
    thread_search: ThreadSearch = Body(
        openapi_examples=Examples.THREAD_SEARCH_EXAMPLES
    ),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    try:
        filter = thread_search.model_dump(exclude_none=True).get("filter", {})
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, 
                store=store, 
                checkpointer=checkpointer
            )
            if "thread_id" in filter and not "checkpoint_id" in filter:
                checkpoints = await service_context.checkpoint_service.list_checkpoints(
                    thread_id=filter["thread_id"]
                )
                if not checkpoints:
                    raise HTTPException(status_code=404, detail="Checkpoints not found")
                return {"checkpoints": checkpoints}

            threads = await service_context.thread_service.search(filter=filter)
            return {"threads": threads}
    except Exception as e:
        logger.exception(f"Error searching threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/threads/{thread_id}", name="Delete Thread")
async def delete_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store=Depends(get_store),
):
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(user_id=user.id, store=store, checkpointer=checkpointer)
            await service_context.checkpoint_service.delete_checkpoints_for_thread(thread_id)
            success = await service_context.thread_service.delete(thread_id)
            if not success:
                raise HTTPException(status_code=404, detail="Thread not found")
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/assistants/{assistant_id}/threads/{thread_id}", name="Delete Assistant Thread"
)
async def delete_thread(
    assistant_id: str,
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store=Depends(get_store),
):
    try:
      
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(user_id=user.id, store=store, checkpointer=checkpointer)
            await service_context.checkpoint_service.delete_checkpoints_for_thread(thread_id)
            success = await service_context.thread_service.delete(thread_id)
            if not success:
                raise HTTPException(status_code=404, detail="Thread not found")
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.exception(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))
