from typing import Annotated, AsyncGenerator, Any
from fastapi import Depends
from langgraph.store.base import BaseStore
from langgraph.checkpoint.base import BaseCheckpointSaver

from src.schemas.entities import LLMRequest
from src.schemas.models import ProtectedUser
from src.services.db import get_store, get_checkpointer
from src.services.thread import thread_service
from src.services.checkpoint import checkpoint_service
from src.flows import construct_agent
from src.utils.stream import handle_multi_mode
from src.utils.logger import logger, log_to_file
from src.constants import APP_LOG_LEVEL
from src.services.db import get_store_db, get_checkpoint_db
import ujson
from uuid import uuid4

from src.utils.format import get_time


async def llm_invoke(
    params: LLMRequest,
    user_id: str,
) -> dict[str, Any] | Any:
    params.metadata.user_id = user_id
    thread_service.user_id = user_id
    checkpoint_service.checkpointer = user_id
    params.metadata.thread_id = str(uuid4())
    async with (
        get_store_db() as store,
        get_checkpoint_db() as checkpointer,
    ):
        try:
            thread_service.store = store
            thread_service.assistant_id = params.metadata.assistant_id
            checkpoint_service.checkpointer = checkpointer
            agent = await construct_agent(params, checkpointer, store)
            checkpoint_service.graph = agent.graph
            response = await agent.invoke(
                {"messages": params.to_langchain_messages()},
                context={"user_id": user_id} if user_id else None,
            )
            logger.info(f"LLM response: {response}")
            return response
        except Exception as e:
            logger.exception(f"Error in llm_invoke: {e}")
            raise e
        finally:
            await thread_service.update(
                thread_id=params.metadata.thread_id,
                data={
                    "thread_id": params.metadata.thread_id,
                    "checkpoint_id": params.metadata.checkpoint_id,
                    "messages": [response.get("messages")[-1].model_dump()],
                    "updated_at": get_time(),
                },
            )


async def llm_stream(
    params: LLMRequest,
    user: ProtectedUser,
    store: Annotated[BaseStore, Depends(get_store)],
    checkpointer: Annotated[BaseCheckpointSaver, Depends(get_checkpointer)],
) -> AsyncGenerator[str, None]:
    """
    Streams LLM output as server-sent events (SSE).
    """

    async def event_generator():
        ## Keeps in memory if not auth user
        if user:
            thread_service.store = store
            thread_service.user_id = user.id
            params.metadata.user_id = user.id
        checkpoint_service.checkpointer = checkpointer
        agent = await construct_agent(params, checkpointer, store)
        checkpoint_service.graph = agent.graph
        try:
            async for chunk in agent.astream(
                {"messages": params.to_langchain_messages()},
                stream_mode=["messages", "values"],
                context={"user_id": user.id} if user else None,
            ):
                # Serialize and yield each chunk as SSE
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    data = ujson.dumps(stream_chunk)
                    log_to_file(str(data), params.model) and APP_LOG_LEVEL == "DEBUG"
                    logger.debug(f"data: {str(data)}")
                    yield f"data: {data}\n\n"
        except Exception as e:
            # Yield error as SSE if streaming fails
            logger.exception("Error in event_generator: %s", e)
            # raise HTTPException(status_code=500, detail=str(e))
            error_msg = ujson.dumps(("error", str(e)))
            yield f"data: {error_msg}\n\n"
        finally:
            # Update model info in checkpoint after streaming
            await agent.add_model_to_ai_message(params.model)

    return event_generator
