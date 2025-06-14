import uuid
from typing import Literal
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from langgraph.store.postgres import AsyncPostgresStore

from src.repos.agent_repo import AgentRepo
from src.schemas.entities import ExistingThread, NewThread
from src.utils.agent import Agent
from src.repos.user_repo import UserRepo
from src.utils.logger import logger
from src.utils.messages import construct_messages

class AgentController:
    def __init__(self, db: AsyncSession, user_id: str = None, agent_id: str = None): # type: ignore
        self.user_repo = UserRepo(db=db, user_id=user_id)
        self.agent_repo = AgentRepo(db=db, user_id=user_id)
        self.agent_id = agent_id
        
    async def query_thread(
        self, 
        thread: NewThread | ExistingThread,
        thread_id: str = None,
        output_type: Literal['text/event-stream', "application/json"] = "application/json", 
        store: AsyncPostgresStore = None,
    ):
        try:
            thread_id = thread_id or str(uuid.uuid4())
            logger.info(f"Creating new thread with ID: {thread_id} and Query: {thread.query}")
            config = {
                "thread_id": thread_id, 
                "user_id": self.user_repo.user_id or None, 
                "agent_id": self.agent_id or None,
                "system": thread.system or None,
                "store": True if thread.memory else None
            }
                
            agent = Agent(config=config, user_repo=self.user_repo, store=store)
            await agent.abuilder(tools=[*thread.tools, thread.mcp, thread.a2a, thread.arcade], 
                                 model_name=thread.model,
                                 collection=thread.collection)  
            messages = construct_messages(thread.query, thread.images)
            if output_type == 'text/event-stream':
                return await agent.aprocess(messages, "text/event-stream")
            else:
                return await agent.aprocess(messages, "application/json")
            
        except ValueError as e:
            logger.warning(f"Bad Request: {str(e)}")
            if "Model" in str(e) and "not supported" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
            raise e
        except Exception as e:
            logger.exception(f"Error creating new thread: {str(e)}")
            raise e
        
    async def query_thread_agent(
        self, 
        request: Request, 
        query: str,
        thread_id: str = None,
        store: AsyncPostgresStore = None,
    ):
        try:
            config = await self.agent_repo.get_by_id(agent_id=self.agent_id)
            settings = config.settings.value
            config = {
                "user_id": self.user_repo.user_id, 
                "agent_id": self.agent_id,
                "thread_id": thread_id or str(uuid.uuid4()),
                "system": settings.get("system") or None
            }
            
            agent = Agent(config=config, user_repo=self.user_repo, store=store)
            await agent.abuilder(
                tools=[*settings.get("tools", []), settings.get("mcp", None), settings.get("a2a", None), settings.get("arcade", None)], 
                model_name=settings.get("model"), 
                collection=settings.get("collection")
            )
            messages = construct_messages(query, settings.get("images"))
            if "text/event-stream" in request.headers.get("accept", ""):
                return await agent.aprocess(messages, "text/event-stream")
            else:
                return await agent.aprocess(messages, "application/json")
                
        except ValueError as e:
            logger.warning(f"Bad Request: {str(e)}")
            raise e
        except Exception as e:
            logger.exception(f"Error in agent thread: {str(e)}")
            raise e