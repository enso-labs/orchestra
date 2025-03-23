import asyncio
import os
import base64
from contextlib import asynccontextmanager
import requests
import json
from typing import Optional
from langchain_mcp_adapters.client import MultiServerMCPClient

from fastapi import status
from fastapi.responses import Response, JSONResponse, StreamingResponse
from psycopg_pool import ConnectionPool
from langgraph.graph import StateGraph
from langchain_core.messages import AnyMessage, SystemMessage, HumanMessage, AIMessageChunk
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import create_react_agent
from psycopg_pool import AsyncConnectionPool
from src.services.mcp import McpService
from src.repos.user_repo import UserRepo
from src.constants import APP_LOG_LEVEL
from src.tools import dynamic_tools, get_mcp_tools
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
from src.entities import Answer
from src.utils.logger import logger
from src.utils.stream import stream_chunks
from src.flows.chatbot import chatbot_builder
from src.services.db import keep_pool_alive

# class ConfiguredAgent(BaseModel):
#     user_id: str
#     thread_id: str
#     agent_id: str = None

class Agent:
    def __init__(self, config: dict, pool: AsyncConnectionPool, user_repo: UserRepo = None):
        self.connection_kwargs = {
            "autocommit": True,
            "prepare_threshold": 0,
        }
        self.user_id = config.get("user_id", None)
        self.thread_id = config.get("thread_id", None)
        self.agent_id = config.get("agent_id", None)
        self.config = {"configurable": config}
        self.graph = None
        self.pool = pool
        self.user_repo = user_repo
        self.model_name = config.get("model_name", None)
        self.llm: LLMWrapper = None
        self.tools = config.get("tools", [])
        self.checkpointer = None
        self.agent_session = McpService()
        
    def _checkpointer(self):
        checkpointer = PostgresSaver(self.pool)
        checkpointer.setup()
        return checkpointer
    
    async def _acheckpointer(self):
        checkpointer = AsyncPostgresSaver(self.pool)
        await checkpointer.setup()
        return checkpointer
    
    def checkpoint(self):
        checkpointer = self._checkpointer()
        checkpoint = checkpointer.get(self.config)
        return checkpoint
    
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

            # Acquire an asynchronous connection from the pool.
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
            
            async with self.pool.connection() as conn:  # Acquire a connection from the pool
                async with conn.cursor() as cur:
                    await cur.execute(query, params)
                    logger.info(f"Created {cur.rowcount} rows with thread_id = {self.thread_id}")
                    return cur.rowcount
        except Exception as e:
            logger.exception(f"Failed to create thread: {str(e)}")
            return 0
        
    def delete(self):
        try:
            query_blobs = "DELETE FROM checkpoint_blobs WHERE thread_id = %s"
            query_checkpoints = "DELETE FROM checkpoints WHERE thread_id = %s"
            query_checkpoints_writes = "DELETE FROM checkpoint_writes WHERE thread_id = %s"
            with self.pool.connection() as conn:  # Acquire a connection from the pool
                with conn.cursor() as cur:
                    cur.execute(query_blobs, (self.thread_id,))
                    cur.execute(query_checkpoints, (self.thread_id,))
                    cur.execute(query_checkpoints_writes, (self.thread_id,))
                    logger.info(f"Deleted {cur.rowcount} rows with thread_id = {self.thread_id}")

                    return cur.rowcount
        except Exception as e:
            logger.error(f"Failed to delete checkpoint: {str(e)}")
            return 0
        
    def builder(
        self,
        tools: list[str] = None,
        mcp: dict = None,
        model_name: str = ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        debug: bool = True if APP_LOG_LEVEL == "DEBUG" else False
    ) -> StateGraph:
        self.tools = [] if len(tools) == 0 else dynamic_tools(selected_tools=tools, metadata={'user_repo': self.user_repo})
        self.llm = LLMWrapper(model_name=model_name, tools=self.tools, user_repo=self.user_repo)
        self.checkpointer = self._checkpointer()
        
        if mcp and len(mcp.keys()) > 0:
            self.tools.extend(asyncio.run(get_mcp_tools(mcp)))
            
        if self.tools:
            graph = create_react_agent(self.llm, prompt=self.config.get("system"), tools=self.tools, checkpointer=self.checkpointer)
        else:
            builder = chatbot_builder(config={"model": self.llm.model})
            graph = builder.compile(checkpointer=self.checkpointer)
            
        if debug:
            graph.debug = True
        self.graph = graph
        self.graph.name = "EnsoAgent"
        return graph
        
    def process(
        self,
        messages: list[AnyMessage], 
        content_type: str = "application/json",
    ) -> Response:
        self.create_user_thread()
        if content_type == "application/json":
            invoke = self.graph.invoke({"messages": messages}, {'configurable': self.config})
            content = Answer(
                thread_id=self.thread_id,
                answer=invoke.get('messages')[-1]
            ).model_dump()

            return JSONResponse(
                content=content,
                status_code=status.HTTP_200_OK
            )
            
        # Assume text/event-stream for streaming
        def stream_generator():
            try:
                state = {"messages": messages}
                for chunk in stream_chunks(self.graph, state, self.config):
                    if chunk:
                        print(chunk)
                        yield chunk
            finally:
                # Don't close the pool here, it's handled by the context manager
                pass

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream"
        )
        
    @staticmethod
    def _get_base64_image(image_url: str) -> Optional[str]:
        """Fetch image from URL and convert to base64, or return existing base64 string."""
        # Check if the string is already a base64 data URL
        if image_url.startswith('data:image/'):
            return image_url
        
        # Check if it's a raw base64 string
        try:
            # Try to decode to check if it's valid base64
            base64.b64decode(image_url)
            # If successful, assume it's an image and add data URL prefix
            return f"data:image/png;base64,{image_url}"
        except Exception:
            # Not base64, try to fetch as URL
            try:
                response = requests.get(image_url)
                response.raise_for_status()
                image_data = response.content
                base64_image = base64.b64encode(image_data).decode('utf-8')
                # Detect content type from response headers or default to png
                content_type = response.headers.get('content-type', 'image/png')
                return f"data:{content_type};base64,{base64_image}"
            except Exception as e:
                logger.error(f"Failed to fetch or encode image {image_url}: {str(e)}")
                return None
    
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
                    encoded_image = Agent._get_base64_image(image)
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
                    encoded_image = Agent._get_base64_image(image)
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
    
    async def abuilder(
        self,
        tools: list[str] = None,
        mcp: dict = None,
        model_name: str = ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        debug: bool = True if APP_LOG_LEVEL == "DEBUG" else False
    ):
        self.tools = [] if len(tools) == 0 else dynamic_tools(selected_tools=tools, metadata={'user_repo': self.user_repo})
        self.llm = LLMWrapper(model_name=model_name, tools=self.tools, user_repo=self.user_repo)
        self.checkpointer = await self._acheckpointer()
        system = self.config.get('configurable').get("system", None)
        # Get MCP tools if provided
        if mcp and len(mcp.keys()) > 0:
            await self.agent_session.setup(mcp)
            self.tools.extend(self.agent_session.tools())
        
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

    @keep_pool_alive
    async def aprocess(
        self,
        messages: list[AnyMessage], 
        content_type: str = "application/json",
    ) -> Response:
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
                        print(chunk)
                        yield chunk
            finally:
                pass  # Cleanup happens in the outer aprocess method

        return StreamingResponse(
            astream_generator(),
            media_type="text/event-stream"
        )
    
    async def astream_chunks(
        self,
        graph: StateGraph, 
        state: dict,
        config: dict = None,
        stream_mode: str = "messages"
    ):
        first = True
        try:
            thread_id = config.get("configurable", {}).get("thread_id")
            async for msg, metadata in graph.astream(
                state, 
                config,
                stream_mode=stream_mode
            ):
                if msg.content and not isinstance(msg, HumanMessage):
                    # Convert message content to SSE format
                    content = msg.content
                    if not isinstance(content, str):
                        content = content[0].get('text')
                    data = {
                        "thread_id": thread_id,
                        "event": "ai_chunk" if isinstance(msg, AIMessageChunk) else "tool_chunk",
                        "content": content
                    }
                    yield f"data: {json.dumps(data)}\n\n"

                if isinstance(msg, AIMessageChunk):
                    if first:
                        gathered = msg
                        first = False
                    else:
                        gathered = gathered + msg

                    if msg.tool_call_chunks:
                        tool_data = {
                            "event": "tool_call",
                            "content": str(gathered.tool_calls)
                        }
                        yield f"data: {json.dumps(tool_data)}\n\n"
        
        except GeneratorExit:
            # Handle client disconnection gracefully
            logger.info("Client disconnected, cleaning up stream")
            raise  # Re-raise to properly terminate the generator
        except Exception as e:
            logger.exception("Error in astream_chunks", e)
        finally:
            logger.info("Closing stream")
            # Send end event
            try:
                end_data = {
                    "thread_id": thread_id,
                    "event": "end",
                    "content": []
                }
                yield f"data: {json.dumps(end_data)}\n\n"
            except GeneratorExit:
                # If client already disconnected during finally block
                logger.info("Client disconnected during stream cleanup")
                raise
            except Exception as e:
                logger.exception("Error sending final stream message", e)