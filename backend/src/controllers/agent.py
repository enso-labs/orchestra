import uuid
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.repos.agent_repo import AgentRepo
from src.entities import ExistingThread, NewThread
from src.utils.agent import Agent
from src.repos.user_repo import UserRepo
from src.utils.logger import logger
from src.services.db import create_async_pool, get_async_connection_pool

class AgentController:
    def __init__(self, db: AsyncSession, user_id: str, agent_id: str = None): # type: ignore
        self.user_repo = UserRepo(db=db, user_id=user_id)
        self.agent_repo = AgentRepo(db=db, user_id=user_id)
        self.agent_id = agent_id
        
    async def anew_thread(
        self, 
        request: Request, 
        new_thread: NewThread,
    ):
        try:
            thread_id = str(uuid.uuid4())
            tools_str = f"and Tools: {', '.join(new_thread.tools)}" if new_thread.tools else ""
            logger.info(f"Creating new thread with ID: {thread_id} {tools_str} and Query: {new_thread.query}")
            config = {
                "thread_id": thread_id, 
                "user_id": self.user_repo.user_id, 
                "agent_id": self.agent_id,
                "system": new_thread.system or None
            }
            
            if "text/event-stream" in request.headers.get("accept", ""):
                # For streaming, create a regular pool and let the decorator manage its lifecycle
                pool = create_async_pool()
                agent = Agent(config=config, pool=pool, user_repo=self.user_repo)
                await agent.abuilder(tools=new_thread.tools, model_name=new_thread.model, mcp=new_thread.mcp)
                messages = agent.messages(new_thread.query, new_thread.images)
                return await agent.aprocess(messages, "text/event-stream")
            else:
                # For JSON, use the context manager as before
                async with get_async_connection_pool() as pool:
                    agent = Agent(config=config, pool=pool, user_repo=self.user_repo)
                    await agent.abuilder(tools=new_thread.tools, model_name=new_thread.model, mcp=new_thread.mcp)
                    messages = agent.messages(new_thread.query, new_thread.images)
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
        
    async def aexisting_thread(
        self,
        request: Request,
        thread_id: str,
        existing_thread: ExistingThread,
    ):
        try:
            tools_str = f"and Tools: {', '.join(existing_thread.tools)}" if existing_thread.tools else ""
            logger.info(f"Querying existing thread with ID: {thread_id} {tools_str} and Query: {existing_thread.query}")
            config = {
                "thread_id": thread_id, 
                "user_id": self.user_repo.user_id, 
                "agent_id": self.agent_id,
                "system": existing_thread.system or None
            }
            
            if "text/event-stream" in request.headers.get("accept", ""):
                # For streaming, create a regular pool and let the decorator manage its lifecycle
                pool = create_async_pool()
                agent = Agent(config=config, pool=pool, user_repo=self.user_repo)
                await agent.abuilder(tools=existing_thread.tools, model_name=existing_thread.model, mcp=existing_thread.mcp)
                messages = agent.messages(query=existing_thread.query, images=existing_thread.images)
                return await agent.aprocess(messages, "text/event-stream")
            else:
                # For JSON, use the context manager as before
                async with get_async_connection_pool() as pool:
                    agent = Agent(config=config, pool=pool, user_repo=self.user_repo)
                    await agent.abuilder(tools=existing_thread.tools, model_name=existing_thread.model, mcp=existing_thread.mcp)
                    messages = agent.messages(query=existing_thread.query, images=existing_thread.images)
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
        
    def agent_thread(
        self, 
        request: Request, 
        query: str,
        thread_id: str = None,
    ):
        try:
            config = self.agent_repo.get_by_id(agent_id=self.agent_id)
            settings = config.settings.value
            config = {
                "user_id": self.user_repo.user_id, 
                "agent_id": self.agent_id,
                "thread_id": thread_id or str(uuid.uuid4()),
                "system": settings.get("system") or None
            }
            
            from src.services.db import get_connection_pool
            
            with get_connection_pool() as pool:
                agent = Agent(config=config, pool=pool, user_repo=self.user_repo)
                agent.builder(tools=settings.get("tools", []), model_name=settings.get("model"))
                if thread_id:
                    messages = agent.existing_thread(query, settings.get("images"))
                else:
                    messages = agent.messages(query, settings.get("system"), settings.get("images"))
                    
                if "text/event-stream" in request.headers.get("accept", ""):
                    return agent.process(messages, "text/event-stream")
                else:
                    return agent.process(messages, "application/json")
                
        except ValueError as e:
            logger.warning(f"Bad Request: {str(e)}")
            raise e
        except Exception as e:
            logger.exception(f"Error in agent thread: {str(e)}")
            raise e