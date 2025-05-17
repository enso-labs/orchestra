import asyncio
import json
from fastapi import HTTPException, status
from fastapi.responses import Response, JSONResponse, StreamingResponse
from langgraph.graph import StateGraph
from langchain_core.messages import AnyMessage,  HumanMessage
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import StructuredTool
from langchain_arcade import ArcadeToolManager
from psycopg.connection_async import AsyncConnection

from src.repos.thread_repo import ThreadRepo
from src.entities.a2a import A2AServer
from src.services.mcp import McpService
from src.repos.user_repo import UserRepo
from src.constants import APP_LOG_LEVEL, UserTokenKey
from src.tools import dynamic_tools
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
from src.entities import Answer, Thread, ArcadeConfig
from src.utils.logger import logger
from src.flows.chatbot import chatbot_builder
from src.services.db import create_async_pool, get_checkpoint_db
from pydantic import BaseModel
from src.utils.format import get_base64_image
from src.models import Thread as ThreadModel

from src.utils.a2a import A2ACardResolver, a2a_builder


class StreamContext(BaseModel):
    msg: AnyMessage | None = None
    metadata: dict = {}
    event: str = ''

class Agent:
    def __init__(self, config: dict, user_repo: UserRepo = None):
        self.connection_kwargs = {
            "autocommit": True,
            "prepare_threshold": 0,
        }
        self.user_id = config.get("user_id", None)
        self.thread_id = config.get("thread_id", None)
        self.agent_id = config.get("agent_id", None)
        self.config = {"configurable": config}
        self.graph = None
        self.pool: AsyncConnection = None  # Don't create pool in constructor
        self.user_repo = user_repo
        self.model_name = config.get("model_name", None)
        self.llm: LLMWrapper = None
        self.tools = config.get("tools", [])
        self.checkpointer = None
        self.agent_session = McpService()
        
    def existing_thread(
        self,
        query: str, 
        images: list[str] = None,
        base64_encode: bool = False
    ) -> list[AnyMessage]:
        # Create message content based on whether images are present
        if images:
            content = [
                {"type": "text", "text": query}
            ]
            
            for image in images:
                if base64_encode:
                    encoded_image = get_base64_image(image)
                    if encoded_image:  # Only add if encoding was successful
                        content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": encoded_image,
                                "detail": "auto"
                            }
                        })
                else:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image,
                            "detail": "auto"
                        }
                    })
        else:
            content = query

        messages = [HumanMessage(content=content)]
        return messages

    def messages(
        self,
        query: str, 
        images: list[str] = None,
        base64_encode: bool = False
    ) -> list[AnyMessage]:
        # Create message content based on whether images are present
        if images:
            content = [
                {"type": "text", "text": query}
            ]
            
            for image in images:
                if base64_encode:
                    encoded_image = get_base64_image(image)
                    if encoded_image:  # Only add if encoding was successful
                        content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": encoded_image,
                                "detail": "auto"
                            }
                        })
                else:
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": image,
                            "detail": "auto"
                        }
                    })
        else:
            content = query

        messages = [HumanMessage(content=content)]
        return messages
    
    async def create_pool(self):
        try:
            if not self.pool:
                # Use create_async_pool instead of the context manager
                # This way the pool stays alive outside this function
                self.pool = create_async_pool()
                await self.pool.open()
        except Exception as e:
            logger.exception(f"Failed to create pool: {str(e)}")
            raise e
        
    async def _acheckpointer(self):
        async with get_checkpoint_db() as checkpointer:
            await checkpointer.setup()
            self.checkpointer = checkpointer
            return checkpointer
    
        
    async def list_async_threads(self, page=1, per_page=20):
        try:
            user_threads = await self.user_repo.threads(page=page, per_page=per_page, sort_order='desc', agent=self.agent_id)
            threads = []
            if user_threads:
                async with get_checkpoint_db() as checkpointer:
                    for thread in user_threads:
                        latest_checkpoint = await checkpointer.aget_tuple({"configurable": {"thread_id": str(thread.thread)}})
                        if latest_checkpoint:
                            messages = latest_checkpoint.checkpoint.get('channel_values', {}).get('messages')
                            if isinstance(messages, list):
                                thread = Thread(
                                    thread_id=latest_checkpoint.config.get('configurable', {}).get('thread_id'),
                                    checkpoint_ns=latest_checkpoint.config.get('configurable', {}).get('checkpoint_ns'),
                                    checkpoint_id=latest_checkpoint.config.get('configurable', {}).get('checkpoint_id'),
                                    messages=messages,
                                    ts=latest_checkpoint.checkpoint.get('ts'),
                                    v=latest_checkpoint.checkpoint.get('v')
                                )
                                threads.append(thread.model_dump())
            return threads
        except Exception as e:
            logger.exception(f"Failed to list threads: {str(e)}")
            return []
    
    async def acheckpoint(self, checkpointer):
        checkpoint = await checkpointer.aget(self.config)
        return checkpoint
    
    async def create_user_thread(self):
        try:
            # Quote "user" since it is a reserved keyword in PostgreSQL.
            agent_id = self.config["configurable"].get("agent_id")
            thread_repo = ThreadRepo(self.user_repo.db, self.user_repo.user_id)
            thread = ThreadModel(
                user=self.user_id,
                thread=self.thread_id,
                agent=agent_id
            )
            await thread_repo.create(thread)
                
        except Exception as e:
            logger.exception(f"Failed to create thread: {str(e)}")
            return 0
        
    async def _wipe(self):
        try:
            query_blobs = "DELETE FROM checkpoint_blobs WHERE thread_id = %s"
            query_checkpoints = "DELETE FROM checkpoints WHERE thread_id = %s"
            query_checkpoints_writes = "DELETE FROM checkpoint_writes WHERE thread_id = %s"
            async with self.pool.connection() as conn:  # Acquire a connection from the pool
                async with conn.cursor() as cur:
                    await cur.execute(query_blobs, (self.thread_id,))
                    await cur.execute(query_checkpoints, (self.thread_id,))
                    await cur.execute(query_checkpoints_writes, (self.thread_id,))
                    logger.info(f"Deleted {cur.rowcount} rows with thread_id = {self.thread_id}")

                    return cur.rowcount
        except Exception as e:
            logger.error(f"Failed to delete checkpoint: {str(e)}")
            return 0
    
    async def delete_thread(self, wipe: bool = True):
        try:
            await self.create_pool()
            thread_repo = ThreadRepo(self.user_repo.db, self.user_repo.user_id)
            await thread_repo.delete(self.thread_id)
            if wipe:
                await self._wipe()
            return True
        except Exception as e:
            logger.error(f"Failed to delete thread: {str(e)}")
            return False
        finally:
            await self.cleanup()
    
    async def abuilder(
        self,
        tools: list[str] = None,
        mcp: dict = None,
        a2a: dict[str, A2AServer] = None,
        arcade: ArcadeConfig = None,
        model_name: str = ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        checkpointer: AsyncPostgresSaver = None,
        debug: bool = True if APP_LOG_LEVEL == "DEBUG" else False
    ):
        self.tools = [] if len(tools) == 0 else dynamic_tools(selected_tools=tools, metadata={'user_repo': self.user_repo})
        self.llm = LLMWrapper(model_name=model_name, tools=self.tools, user_repo=self.user_repo)
        self.checkpointer = checkpointer
        system = self.config.get('configurable').get("system", None)
        # Get MCP tools if provided
        if mcp and len(mcp.keys()) > 0:
            await self.agent_session.setup(mcp)
            self.tools.extend(self.agent_session.tools())
            
        if a2a and len(a2a.keys()) > 0:
            # Check if a2a is a dictionary with multiple entries
            if isinstance(a2a, dict):
                # Loop through each entry in the a2a dictionary
                for key, config in a2a.items():
                    
                    card = A2ACardResolver(
                        base_url=config.base_url, 
                        agent_card_path=config.agent_card_path
                    ).get_agent_card()
                    
                    async def send_task(query: str):    
                        return await a2a_builder(
                            base_url=config.base_url, 
                            query=query, 
                            thread_id=self.thread_id
                        )
                    send_task.__doc__ = (
                        f"Send query to remote agent: {card.name}. "
                        f"Agent Card: {card.model_dump_json()}"
                    )
                    tool = StructuredTool.from_function(coroutine=send_task)
                    tool.name = card.name.lower().replace(" ", "_")
                    # tool.name = key + "_" + card.name.lower().replace(" ", "_")
                    # tool.description = card.description
                    self.tools.append(tool)
                    
        if len(arcade.tools) > 0 or len(arcade.toolkits) > 0:
            token = await self.user_repo.get_token(key=UserTokenKey.ARCADE_API_KEY.name)
            if not token:
                raise HTTPException(status_code=400, detail="No ARCADE_API_KEY found")
            manager = ArcadeToolManager(api_key=token)
            tools = manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
            self.tools.extend(tools)
            
        if self.tools:
            graph = create_react_agent(self.llm, prompt=system, tools=self.tools, checkpointer=self.checkpointer)
        else:
            builder = chatbot_builder(config={"model": self.llm.model, "system": system})
            graph = builder.compile(checkpointer=self.checkpointer)
            
        if debug:
            graph.debug = True
        self.graph = graph
        self.graph.name = "EnsoAgent"
        return graph

    async def aprocess(
        self,
        messages: list[AnyMessage], 
        content_type: str = "application/json",
    ) -> Response:
        if self.user_id:
            await self.create_user_thread()
        if content_type == "application/json":
            try:
                invoke = await self.graph.ainvoke({"messages": messages}, self.config)
                content = Answer(
                    thread_id=self.thread_id,
                    answer=invoke.get('messages')[-1]
                ).model_dump()
                return JSONResponse(
                    content=content,
                    status_code=status.HTTP_200_OK
                )
            finally:
                await self.agent_session.cleanup()
            
        # Assume text/event-stream for streaming
        async def astream_generator():
            try:
                state = {"messages": messages}
                async for chunk in self.astream_chunks(self.graph, state, self.config):
                    if chunk:
                        logger.info(f'chunk: {str(chunk)}')
                        yield chunk
            except asyncio.CancelledError as e:
                logger.info("Stream cancelled")
                raise GeneratorExit
            except Exception as e:
                logger.exception(f"Error in astream_generator: {str(e)}")
            finally:
                pass

        return StreamingResponse(
            astream_generator(),
            media_type="text/event-stream"
        )
    
    # https://langchain-ai.github.io/langgraph/how-tos/streaming/#messages
    async def astream_chunks(
        self,
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
            raise e
        except Exception as e:
            logger.exception("Error in astream_chunks", e)
            raise HTTPException(status_code=500, detail=str(e))
        # finally:
        #     logger.info("Closing stream")
        #     raise GeneratorExit
            


    # Add cleanup method
    async def cleanup(self):
        """Cleanup resources when done."""
        if self.pool and not self.pool.closed:
            await self.pool.close(timeout=5.0)
            self.pool = None