import json
import asyncio
from fastapi import HTTPException
from langgraph.graph import StateGraph
from src.utils.logger import logger
from src.services.db import get_checkpoint_db
from src.entities import StreamContext

# https://langchain-ai.github.io/langgraph/how-tos/streaming/#messages
async def astream_chunks(
    graph: StateGraph, 
    state: dict,
    config: dict = None,
    stream_mode: str = "messages"
):
    try:
        ctx = StreamContext(msg=None, metadata={}, event=stream_mode)
        async with get_checkpoint_db() as checkpointer: 
            graph.checkpointer = checkpointer
            async for msg, metadata in graph.astream(
                state, 
                config,
                stream_mode=stream_mode
            ):  
                ctx.msg = msg
                ctx.metadata = metadata
                logger.debug(f'ctx: {str(ctx.model_dump())}')
                data = ctx.model_dump()
                yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(0)
    except asyncio.CancelledError as e:
        # Handle client disconnection gracefully
        logger.info("Client disconnected, cleaning up stream")
        # Don't re-raise, just exit cleanly
        raise GeneratorExit
    except Exception as e:
        logger.exception("Error in astream_chunks", e)
        raise HTTPException(status_code=500, detail=str(e))