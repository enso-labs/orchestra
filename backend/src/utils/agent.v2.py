import asyncio
from fastapi import HTTPException, status
from fastapi.responses import Response, JSONResponse, StreamingResponse
from langchain_core.messages import AnyMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import StructuredTool
from langchain_arcade import ArcadeToolManager
from psycopg.connection_async import AsyncConnection
from sqlalchemy import text
from langgraph.errors import NodeInterrupt

from src.repos.thread_repo import ThreadRepo
from src.entities.a2a import A2AServer
from src.services.mcp import McpService
from src.repos.user_repo import UserRepo
from src.constants import APP_LOG_LEVEL, ARCADE_API_KEY, UserTokenKey
from src.tools import dynamic_tools
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
from src.entities import Answer, Thread, ArcadeConfig
from src.utils.logger import logger
from src.flows.chatbot import chatbot_builder
from src.services.db import get_checkpoint_db
from src.models import Thread as ThreadModel
from src.utils.a2a import A2ACardResolver, a2a_builder
from src.utils.stream import astream_chunks
from src.flows.authorize import authorize_builder

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
        self.tool_manager = None
    
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
            query_blobs = text("DELETE FROM checkpoint_blobs WHERE thread_id = :thread_id")
            query_checkpoints = text("DELETE FROM checkpoints WHERE thread_id = :thread_id")
            query_checkpoints_writes = text("DELETE FROM checkpoint_writes WHERE thread_id = :thread_id")
            await self.user_repo.db.execute(query_blobs, {"thread_id": self.thread_id})
            await self.user_repo.db.execute(query_checkpoints, {"thread_id": self.thread_id})
            await self.user_repo.db.execute(query_checkpoints_writes, {"thread_id": self.thread_id})
            await self.user_repo.db.commit()
            logger.info(f"Deleted rows with thread_id = {self.thread_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete checkpoint: {str(e)}")
            return 0
    
    async def delete_thread(self, wipe: bool = True):
        try:
            thread_repo = ThreadRepo(self.user_repo.db, self.user_repo.user_id)
            await thread_repo.delete(self.thread_id)
            if wipe:
                await self._wipe()
            return True
        except Exception as e:
            logger.error(f"Failed to delete thread: {str(e)}")
            return False
        finally:
            logger.info("Thread deleted")
            pass
    
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
            mcp_service = McpService(mcp)
            self.tools.extend(await mcp_service.get_tools())
            
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
                    
        if arcade and (len(arcade.tools) > 0 or len(arcade.toolkits) > 0):
            # token = await self.user_repo.get_token(key=UserTokenKey.ARCADE_API_KEY.name)
            # if not token:
            #     raise HTTPException(status_code=400, detail="No ARCADE_API_KEY found")
            self.tool_manager = ArcadeToolManager(api_key=ARCADE_API_KEY)
            # self.tool_manager.to_langchain(use_interrupts=True)
            tools = self.tool_manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
            self.tools.extend(tools)
            
        if self.tools:
            graph = authorize_builder(tools=self.tools).compile(checkpointer=self.checkpointer)
            # graph = create_react_agent(self.llm, prompt=system, tools=self.tools, checkpointer=self.checkpointer)
        else:
            builder = chatbot_builder(config={"model": self.llm.model, "system": system})
            graph = builder.compile(checkpointer=self.checkpointer)
            
        if debug:
            graph.debug = True
        self.graph = graph
        self.graph.name = "Orchestra"
        return graph

    async def aprocess(
        self,
        messages: list[AnyMessage], 
        content_type: str = "application/json",
    ) -> Response:
        if self.user_id:
            await self.create_user_thread()
            
        self.config["configurable"]["tools"] = self.tools
        self.config["configurable"]["model"] = self.llm.model
        self.config["configurable"]["tool_manager"] = self.tool_manager
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
            except Exception as e:
                logger.exception(f"Error in aprocess: {str(e)}")
                raise HTTPException(status_code=500, detail=str(e))
            
        # Assume text/event-stream for streaming
        async def astream_generator():
            try:
                state = {"messages": messages}
                async for chunk in astream_chunks(self.graph, state, self.config):
                    if chunk:
                        logger.info(f'chunk: {str(chunk)}')
                        yield chunk
            except asyncio.CancelledError as e:
                logger.info("Stream cancelled")
                raise GeneratorExit
            except NodeInterrupt as exc:
                logger.info(f"Authorization required: {str(exc)}")
                raise Exception("Authorization required: " + str(exc))
            except Exception as e:
                logger.exception(f"Error in astream_generator: {str(e)}")
            finally:
                pass

        return StreamingResponse(
            astream_generator(),
            media_type="text/event-stream"
        )