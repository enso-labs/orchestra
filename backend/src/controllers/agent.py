import uuid
import sys
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.types import Task
from src.repos.agent_repo import AgentRepo
from src.entities import ExistingThread, NewThread
from src.utils.agent import Agent
from src.repos.user_repo import UserRepo
from src.utils.logger import logger
from src.utils.a2a import process_a2a_streaming, process_a2a


class AgentController:
    def __init__(self, db: AsyncSession, user_id: str = None, agent_id: str = None): # type: ignore
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
                "user_id": self.user_repo.user_id or None, 
                "agent_id": self.agent_id or None,
                "system": new_thread.system or None
            }
            
            if new_thread.a2a:
                if "text/event-stream" in request.headers.get("accept", ""):
                    return await process_a2a_streaming(new_thread, thread_id)
                else:
                    return await process_a2a(new_thread, thread_id)
                
            agent = Agent(config=config, user_repo=self.user_repo)
            await agent.abuilder(tools=new_thread.tools, model_name=new_thread.model, mcp=new_thread.mcp, a2a=new_thread.a2a)
            messages = agent.messages(new_thread.query, new_thread.images)
            if "text/event-stream" in request.headers.get("accept", ""):
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
        
    async def aexisting_thread(
        self,
        request: Request,
        thread_id: str,
        existing_thread: ExistingThread,
    ):
        try:
            tools_str = f"and Tools: {', '.join(existing_thread.tools)}" if existing_thread.tools else ""
            logger.info(
                f"Querying existing thread with ID: {thread_id} {tools_str} ",
                f"and Query: {existing_thread.query}"
            )
            config = {
                "thread_id": thread_id, 
                "user_id": self.user_repo.user_id or None, 
                "agent_id": self.agent_id or None,
                "system": existing_thread.system or None
            }
            
            if existing_thread.a2a:
                if "text/event-stream" in request.headers.get("accept", ""):
                    return await process_a2a_streaming(existing_thread, thread_id)
                else:
                    return await process_a2a(existing_thread, thread_id)
            
            agent = Agent(config=config, user_repo=self.user_repo)
            await agent.abuilder(tools=existing_thread.tools, 
                                 model_name=existing_thread.model, 
                                 mcp=existing_thread.mcp, 
                                 a2a=existing_thread.a2a)
            messages = agent.messages(query=existing_thread.query, images=existing_thread.images)
                
            if "text/event-stream" in request.headers.get("accept", ""):
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
        
    async def async_agent_thread(
        self, 
        request: Request, 
        query: str,
        thread_id: str = None,
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
            
            agent = Agent(config=config, user_repo=self.user_repo)
            await agent.abuilder(tools=settings.get("tools", []), model_name=settings.get("model"), mcp=settings.get("mcp", None))
            if thread_id:
                messages = agent.existing_thread(query, settings.get("images"))
            else:
                messages = agent.messages(query, settings.get("images"))

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