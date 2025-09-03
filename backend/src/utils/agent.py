import asyncio
from fastapi import HTTPException, status
from fastapi.responses import Response, JSONResponse, StreamingResponse
from langchain_core.messages import AnyMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import create_react_agent
from sqlalchemy import text
from langgraph.errors import NodeInterrupt
from langgraph.store.postgres import AsyncPostgresStore

from src.repos.thread_repo import ThreadRepo
from src.schemas.entities.a2a import A2AServer
from src.repos.user_repo import UserRepo
from src.constants import APP_LOG_LEVEL
from src.tools import init_tools
from src.tools.memory import search_recall_memories, save_recall_memory, delete_recall_memory
from src.utils.llm import LLMWrapper
from src.constants.llm import ModelName
from src.schemas.entities import Answer, Thread, ArcadeConfig
from src.utils.logger import logger
from src.flows.chatbot import chatbot_builder
from src.services.db import get_checkpoint_db
from src.schemas.models import Thread as ThreadModel
from src.utils.stream import astream_chunks
from src.flows.xml_agent import create_enso_graph

class Agent:
    def __init__(self, config: dict, user_repo: UserRepo = None, store: AsyncPostgresStore = None):
        self.user_id = config.get("user_id", None)
        self.thread_id = config.get("thread_id", None)
        self.agent_id = config.get("agent_id", None)
        self.config = {"configurable": config}
        self.graph = None
        self.user_repo = user_repo
        self.model_name = config.get("model_name", None)
        self.llm: LLMWrapper = None
        self.tools = config.get("tools", [])
        self.checkpointer = None
        self.store = store
    
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
        tools: list[str | dict | ArcadeConfig | dict[str, A2AServer]] = None,
        model_name: str = ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        collection: dict = None,
        checkpointer: AsyncPostgresSaver = None,
        debug: bool = True if APP_LOG_LEVEL == "DEBUG" else False,
        name: str = "Orchestra"
    ):
        # Initialize Graph
        self.checkpointer = checkpointer
        system = self.config.get('configurable').get("system", None)
        self.tools = await init_tools(
            tools=tools, 
            metadata={'user_repo': self.user_repo, 'collection': collection, 'thread_id': self.thread_id}
        )
        # self.llm = LLMWrapper(model_name=model_name, tools=self.tools, user_repo=self.user_repo)
        if self.store:
            self.tools.extend([search_recall_memories, save_recall_memory, delete_recall_memory])
            memories = await self.store.asearch(("memories", self.user_id))
            if memories:
                system += "\n\n"
                for memory in memories:
                    memory_dict = str(memory.dict())
                    system += f"<recall_memory>{memory_dict}</recall_memory>\n"
                
        # if self.tools:
        #     graph = create_react_agent(self.llm, prompt=system, tools=self.tools, checkpointer=self.checkpointer, store=self.store)
        # else:
        #     builder = chatbot_builder(config={"model": self.llm.model, "system": system})
        #     graph = builder.compile(checkpointer=self.checkpointer, store=self.store)
        self.graph = create_enso_graph(
            tools=self.tools, 
            store=self.store, 
            checkpointer=self.checkpointer,
        )
        return self.graph

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
                raise Exception("Authorization required: " + str(exc))
            except Exception as e:
                logger.exception(f"Error in astream_generator: {str(e)}")
            finally:
                pass

        return StreamingResponse(
            astream_generator(),
            media_type="text/event-stream"
        )