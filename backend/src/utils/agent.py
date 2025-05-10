import json
from fastapi import HTTPException, status
from fastapi.responses import Response, JSONResponse, StreamingResponse
from langgraph.graph import StateGraph
from langchain_core.messages import AnyMessage,  HumanMessage
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import create_react_agent
from psycopg.connection_async import AsyncConnection
from pydantic import BaseModel

from src.repos.tool_repo import ToolRepo
from src.tools.a2a import create_a2a_tools
from src.repos.thread_repo import ThreadRepo
from src.entities.a2a import A2AServer
from src.services.mcp import McpService
from src.repos.user_repo import UserRepo
from src.constants import APP_LOG_LEVEL, DB_URI
from src.tools import dynamic_tools
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
from src.entities import Answer, Thread
from src.utils.logger import logger
from src.flows.chatbot import chatbot_builder
from src.services.db import create_async_pool, get_checkpoint_db
from src.utils.format import get_base64_image
from src.tools.api import generate_tools_from_openapi_spec


class StreamContext(BaseModel):
    msg: AnyMessage | None = None
    metadata: dict = {}
    event: str = ''

class Agent:
    def __init__(self, config: dict, user_repo: UserRepo = None, tool_repo: ToolRepo = None):
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
        self.tool_repo = tool_repo
        self.model_name = config.get("model_name", None)
        self.llm: LLMWrapper = None
        self.tools = config.get("tools", [])
        self.checkpointer = None
        self.agent_session = McpService()
        
    def _checkpointer(self):
        checkpointer = PostgresSaver(self.pool)
        checkpointer.setup()
        return checkpointer

    def checkpoint(self):
        checkpointer = self._checkpointer()
        checkpoint = checkpointer.get(self.config)
        return checkpoint
    
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
        
    async def list_threads(self, page=1, per_page=20, sort_order='desc'):
        try:
            user_threads = await self.user_repo.threads(page=page, per_page=per_page, sort_order=sort_order)
            threads = []
            if user_threads:
                await self._acheckpointer()
                for thread in user_threads:
                    latest_checkpoint = await self.checkpointer.aget_tuple({"configurable": {"thread_id": str(thread.thread)}})
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
        finally:
            await self.cleanup()
        
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
    
    async def user_threads(self, page=1, per_page=20, sort_order='desc'):
        """
        Retrieve a paginated list of threads records for the configured user, ordered by created_at.
        
        :param page: The page number (1-indexed).
        :param page_size: Number of records per page.
        :param sort_order: 'asc' for ascending or 'desc' for descending order based on created_at.
        :return: A list of thread IDs.
        """
        try:
            user_id = self.config["configurable"]["user_id"]
            agent_id = self.config["configurable"].get("agent_id")
            # Calculate the offset for pagination.
            offset = (page - 1) * per_page

            # Validate sort_order.
            order = sort_order.upper()
            if order not in ('ASC', 'DESC'):
                order = 'DESC'

            # Build the query. "user" is quoted because it's a reserved keyword.
            query = f"""
                SELECT thread
                FROM threads
                WHERE "user" = %s
            """
            
            params = [user_id]
            
            # Add agent condition if agent_id is specified
            if agent_id:
                query += " AND agent = %s"
                params.append(agent_id)
                
            query += f"""
                ORDER BY created_at {order}
                LIMIT %s OFFSET %s
            """
            
            params.extend([per_page, offset])

            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, params)
                    rows = await cur.fetchall()
                    logger.info(f"Retrieved {len(rows)} threads for user {user_id} (page {page})")
                    # Convert the list of rows (tuples) into a set of thread UUIDs.
                thread_ids = {str(row[0]) for row in rows}
                return thread_ids

        except Exception as e:
            logger.error(f"Failed to retrieve paginated threads for user {user_id}: {str(e)}")
            return []
    
    async def create_user_thread(self):
        try:
            # Quote "user" since it is a reserved keyword in PostgreSQL.
            agent_id = self.config["configurable"].get("agent_id")
            
            if agent_id:
                query = (
                    'INSERT INTO threads ("user", thread, agent) '
                    'VALUES (%s, %s, %s) '
                    'ON CONFLICT ("user", thread) DO NOTHING'
                )
                params = (self.config["configurable"]["user_id"], self.thread_id, agent_id)
            else:
                query = (
                    'INSERT INTO threads ("user", thread) '
                    'VALUES (%s, %s) '
                    'ON CONFLICT ("user", thread) DO NOTHING'
                )
                params = (self.config["configurable"]["user_id"], self.thread_id)
            
            await self.create_pool()
            async with self.pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, params)
                    logger.info(f"Created {cur.rowcount} rows with thread_id = {self.thread_id}")
                    return cur.rowcount
                
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
        model_name: str = ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        checkpointer: AsyncPostgresSaver = None,
        debug: bool = True if APP_LOG_LEVEL == "DEBUG" else False,
        name: str = "EnsoAgent"
    ):
        tool_selection = await self.tool_repo.list_tools()
        self.tools = [] if len(tools) == 0 else dynamic_tools(selected_tools=tools, metadata={'user_repo': self.user_repo}, tool_selection=tool_selection)
        self.llm = LLMWrapper(model_name=model_name, tools=self.tools, user_repo=self.user_repo)
        self.checkpointer = checkpointer
        system = self.config.get('configurable').get("system", None)
        # Get MCP tools if provided
        if mcp and len(mcp.keys()) > 0:
            await self.agent_session.setup(mcp)
            self.tools.extend(self.agent_session.tools())
        
        # Get A2A tools if provided
        if a2a and len(a2a.keys()) > 0:
            a2a_tools = create_a2a_tools(thread_id=self.thread_id, a2a=a2a)
            self.tools.extend(a2a_tools)
            
        # tools_from_spec = generate_tools_from_openapi_spec(
        #     "http://localhost:8050/openapi.json"
        # )
        # self.tools.extend(tools_from_spec)
        
        if self.tools:
            graph = create_react_agent(self.llm, prompt=system, tools=self.tools, checkpointer=self.checkpointer)
        else:
            builder = chatbot_builder(config={"model": self.llm.model, "system": system})
            graph = builder.compile(checkpointer=self.checkpointer)
            
        if debug:
            graph.debug = debug
        self.graph = graph
        self.graph.name = name
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
            async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer: 
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
            
        except GeneratorExit:
            # Handle client disconnection gracefully
            logger.info("Client disconnected, cleaning up stream")
            # Don't re-raise, just exit cleanly
            return
        except Exception as e:
            logger.exception("Error in astream_chunks", e)
            raise HTTPException(status_code=500, detail=str(e))
        # finally:
        #     logger.info("Closing stream")
        #     try:
        #         # Only send end message if we haven't encountered GeneratorExit
        #         if sys.exc_info()[0] is not GeneratorExit:
        #             ctx.event = "end"
        #             end_data = ctx.model_dump()
        #             yield f"data: {json.dumps(end_data)}\n\n"
        #     except Exception as e:
        #         logger.exception("Error sending final stream message", e)


    # Add cleanup method
    async def cleanup(self):
        """Cleanup resources when done."""
        if self.pool and not self.pool.closed:
            await self.pool.close(timeout=5.0)
            self.pool = None