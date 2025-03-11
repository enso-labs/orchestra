import uuid
from typing import Annotated
from fastapi import Request, Depends, Body, HTTPException, status
from sqlalchemy.orm import Session
from psycopg_pool import ConnectionPool

from src.entities import ExistingThread, NewThread
from src.models import User
from src.utils.agent import Agent
from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from src.repos.user_repo import UserRepo
from src.utils.logger import logger
from src.utils.auth import verify_credentials, get_db

class AgentController:
    def __init__(self, db: Session, user_id: str):
        self.user_repo = UserRepo(db=db, user_id=user_id)

    def new_thread(
        self, 
        request: Request, 
        new_thread: NewThread,
    ):
        try:
            thread_id = str(uuid.uuid4())
            tools_str = f"and Tools: {', '.join(new_thread.tools)}" if new_thread.tools else ""
            logger.info(f"Creating new thread with ID: {thread_id} {tools_str} and Query: {new_thread.query}")
            if "text/event-stream" in request.headers.get("accept", ""):
                pool = ConnectionPool(
                    conninfo=DB_URI,
                    max_size=20,
                    kwargs=CONNECTION_POOL_KWARGS,
                )
                agent = Agent(config={"thread_id": thread_id, "user_id": self.user_repo.user_id}, pool=pool, user_repo=self.user_repo)
                agent.builder(tools=new_thread.tools, model_name=new_thread.model)
                messages = agent.messages(new_thread.query, new_thread.system, new_thread.images)
                return agent.process(messages, "text/event-stream")
            
            with ConnectionPool(
                conninfo=DB_URI,
                max_size=20,
                kwargs=CONNECTION_POOL_KWARGS,
            ) as pool:
                agent = Agent(config={"thread_id": thread_id, "user_id": self.user_repo.user_id}, pool=pool, user_repo=self.user_repo)
                agent.builder(tools=new_thread.tools, model_name=new_thread.model)
                messages = agent.messages(new_thread.query, new_thread.system, new_thread.images)
                return agent.process(messages, "application/json")
        except ValueError as e:
            logger.warning(f"Bad Request: {str(e)}")
            if "Model" in str(e) and "not supported" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
            raise e
        except Exception as e:
            logger.error(f"Error creating new thread: {str(e)}")
            raise e
        
    def existing_thread(
        self,
        request: Request,
        thread_id: str,
        existing_thread: ExistingThread,
    ):
        try:
            tools_str = f"and Tools: {', '.join(existing_thread.tools)}" if existing_thread.tools else ""
            logger.info(f"Querying existing thread with ID: {thread_id} {tools_str} and Query: {existing_thread.query}")
            if "text/event-stream" in request.headers.get("accept", ""):
                pool = ConnectionPool(
                    conninfo=DB_URI,
                    max_size=20,
                    kwargs=CONNECTION_POOL_KWARGS,
                )
                agent = Agent(config={"thread_id": thread_id, "user_id": self.user_repo.user_id}, pool=pool, user_repo=self.user_repo)
                agent.builder(tools=existing_thread.tools, model_name=existing_thread.model)
                messages = agent.messages(query=existing_thread.query, images=existing_thread.images)
                return agent.process(messages, "text/event-stream")
            
            with ConnectionPool(
                conninfo=DB_URI,
                max_size=20,
                kwargs=CONNECTION_POOL_KWARGS,
            ) as pool:  
                agent = Agent(config={"thread_id": thread_id, "user_id": self.user_repo.user_id}, pool=pool, user_repo=self.user_repo)
                agent.builder(tools=existing_thread.tools, model_name=existing_thread.model)
                messages = agent.messages(query=existing_thread.query, images=existing_thread.images)
                return agent.process(messages, "application/json")
        except ValueError as e:
            logger.warning(f"Bad Request: {str(e)}")
            if "Model" in str(e) and "not supported" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e)
                )
            raise e
        except Exception as e:
            logger.error(f"Error creating new thread: {str(e)}")
            raise e