from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from src.models import User
from src.utils.auth import verify_credentials, get_db
from src.services.agent import AgentService
from src.entities import BaseSetting
from src.utils.logger import logger

router = APIRouter(tags=["Agent"])

class AgentCreate(BaseModel):
    name: str
    settings: BaseSetting
    is_public: Optional[bool] = False

@router.post(
    "/agents",
    status_code=status.HTTP_201_CREATED,
    description="Create a new agent with settings",
)
def create_agent(
    body: AgentCreate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    return service.create_agent(
        name=body.name,
        settings=body.settings,
        is_public=body.is_public
    )

@router.get(
    "/agents",
    description="List all agents accessible by the user",
)
def list_agents(
    include_public: bool = Query(False, description="Include public agents"),
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    agents = service.agent_repo.get_user_agents(include_public=include_public)
    return {
        "agents": [
            {
                "id": str(agent.id),
                "name": agent.name,
                "is_public": agent.is_public,
                "current_setting_key": agent.current_setting_key
            }
            for agent in agents
        ]
    }

@router.get(
    "/agents/{agent_id}",
    description="Get agent details with current settings",
)
def get_agent(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    return service.get_agent_settings(agent_id)

@router.delete(
    "/agents/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Delete an agent and all its settings",
)
def delete_agent(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    if service.delete_agent(agent_id):
        return None
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found") 