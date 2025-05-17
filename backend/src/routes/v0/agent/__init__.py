from fastapi import Query, Response, status, Depends, APIRouter, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from src.repos.agent_repo import AgentRepo
from src.utils.auth import verify_credentials
from src.services.db import get_async_db
from src.models import ProtectedUser


TAG = "Agent"
router = APIRouter(tags=[TAG])

class AgentCreate(BaseModel):
    name: str
    description: str
    settings_id: str
    public: Optional[bool] = False

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    settings_id: Optional[str] = None
    public: Optional[bool] = None

@router.get(
    "/agents", 
    responses={
        status.HTTP_200_OK: {
            "description": "All agents.",
            "content": {
                "application/json": {
                    "example": {"agents": [{"id": "123", "name": "Agent 1", "description": "Agent 1 description", "public": True}]}
                }
            }
        }
    }
)
async def list_agents(
    user: ProtectedUser = Depends(verify_credentials), 
    db: AsyncSession = Depends(get_async_db),
    public: Optional[bool] = Query(default=None, description="Filter by public agents")
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    agents = await agent_repo.get_all_user_agents(public=public)
    agents = [agent.to_async_dict() for agent in agents]
    return JSONResponse(
        content={"agents": agents},
        status_code=status.HTTP_200_OK
    )

@router.post(
    "/agents", 
    responses={
        status.HTTP_201_CREATED: {
            "description": "Agent created successfully.",
            "content": {
                "application/json": {
                    "example": {"agent": {"id": "123", "name": "New Agent", "description": "Agent description", "public": False}}
                }
            }
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Bad request"
        }
    }
)
async def create_agent(
    agent_data: AgentCreate,
    user: ProtectedUser = Depends(verify_credentials), 
    db: AsyncSession = Depends(get_async_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    try:
        agent = await agent_repo.create(
            name=agent_data.name,
            description=agent_data.description,
            settings_id=agent_data.settings_id,
            public=agent_data.public
        )
        return JSONResponse(
            content={"agent": agent.to_dict()},
            status_code=status.HTTP_201_CREATED
        )
        
    except ValueError as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_409_CONFLICT
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )

@router.get(
    "/agents/{agent_id}", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "Agent retrieved successfully.",
            "content": {
                "application/json": {
                    "example": {"agent": {"id": "123", "name": "Agent Name", "description": "Agent description", "public": True}}
                }
            }
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Agent not found"
        }
    }
)
async def get_agent(
    agent_id: str = Path(..., description="The ID of the agent to retrieve"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: AsyncSession = Depends(get_async_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    
    agent = await agent_repo.get_by_id(agent_id=agent_id)
    
    if not agent:
        return JSONResponse(
            content={"error": "Agent not found"},
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    return JSONResponse(
        content={"agent": agent.to_dict()},
        status_code=status.HTTP_200_OK
    )

@router.put(
    "/agents/{agent_id}", 
    responses={
        status.HTTP_200_OK: {
            "description": "Agent updated successfully.",
            "content": {
                "application/json": {
                    "example": {"agent": {"id": "123", "name": "Updated Agent", "description": "Updated description", "public": True}}
                }
            }
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Agent not found"
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Bad request"
        }
    }
)
def update_agent(
    agent_id: str = Path(..., description="The ID of the agent to update"),
    agent_data: AgentUpdate = None,
    user: ProtectedUser = Depends(verify_credentials), 
    db: AsyncSession = Depends(get_async_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    
    # Convert Pydantic model to dict and remove None values
    update_data = agent_data.model_dump(exclude_unset=True) if agent_data else {}
    
    try:
        agent = agent_repo.update(agent_id=agent_id, data=update_data)
        if not agent:
            return JSONResponse(
                content={"error": "Agent not found"},
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        return JSONResponse(
            content={"agent": agent.to_dict()},
            status_code=status.HTTP_200_OK
        )
    except ValueError as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_409_CONFLICT
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )

@router.delete(
    "/agents/{agent_id}", 
    tags=[TAG],
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Agent deleted successfully."
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Agent not found"
        }
    }
)
async def delete_agent(
    agent_id: str = Path(..., description="The ID of the agent to delete"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: AsyncSession = Depends(get_async_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    
    try:
        success = await agent_repo.delete(agent_id=agent_id)
        if not success:
            return JSONResponse(
                content={"error": "Agent not found"},
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )
 
 
################################################################################
### Threads and Revisions
################################################################################
from .thread import router as thread_router
from .revision import router as revision_router

router.include_router(revision_router)
router.include_router(thread_router)
