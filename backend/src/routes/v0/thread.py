# https://langchain-ai.github.io/langgraph/reference/checkpoints/#langgraph.checkpoint.postgres.BasePostgresSaver
from fastapi import APIRouter, Body, HTTPException, Depends

from src.schemas.entities import ThreadSearch
from src.utils.logger import logger
from src.services.checkpoint import checkpoint_service
from src.services.thread import thread_service
from src.constants.examples import Examples
from src.schemas.models import ProtectedUser
from src.utils.auth import get_optional_user

router = APIRouter(tags=["Thread"])


@router.post("/threads/search", name="Query Threads in Checkpointer")
async def search_threads(
    thread_search: ThreadSearch = Body(
        openapi_examples=Examples.THREAD_SEARCH_EXAMPLES
    ),
    user: ProtectedUser = Depends(get_optional_user),
):
    try:
        thread_service.user_id = user.id if user else None
        checkpoint_service.user_id = user.id if user else None
        metadata = thread_search.model_dump().get("metadata", {})

        if "thread_id" in metadata and not "checkpoint_id" in metadata:
            thread_id = metadata["thread_id"]
            checkpoints = await checkpoint_service.list_checkpoints(thread_id)
            if checkpoints is None:
                raise HTTPException(status_code=404, detail="Checkpoints not found")
            return {"checkpoints": checkpoints}
        if "thread_id" in metadata and "checkpoint_id" in metadata:
            thread_id = metadata["thread_id"]
            checkpoint_id = metadata["checkpoint_id"]
            checkpoint = await checkpoint_service.get_checkpoint_state(
                thread_id, checkpoint_id
            )
            if checkpoint is None:
                raise HTTPException(status_code=404, detail="Checkpoint not found")
            return {"checkpoint": checkpoint}

        threads = await thread_service.search()
        return {"threads": threads}
    except Exception as e:
        logger.exception(f"Error searching threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))
