from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, UUID4, Field
from uuid import UUID

from src.utils.auth import verify_credentials, get_db
from src.utils.logger import logger
from src.controllers.agent_controller import AgentController
from src.models import User

TAG = "Agent"
router = APIRouter(tags=[TAG])

# Pydantic models for request/response

class SettingsData(BaseModel):
    system: Optional[str] = "You are a helpful assistant."
    model: Optional[str] = "openai-gpt-4o-mini"
    tools: Optional[List[str]] = Field(default_factory=lambda: ["search_engine"])
    indexes: Optional[List[str]] = Field(default_factory=list)

class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "private"  # 'public' or 'private'

class AgentCreate(AgentBase):
    settings_id: Optional[str] = None
    settings_data: Optional[SettingsData] = None

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    is_active: Optional[bool] = None

class RevisionBase(BaseModel):
    revision_name: Optional[str] = None
    change_notes: Optional[str] = None

class RevisionCreate(RevisionBase):
    settings_id: Optional[str] = None
    settings_data: Optional[SettingsData] = None

class AgentResponse(AgentBase):
    id: UUID4
    slug: str
    is_active: bool
    user_id: UUID4
    current_revision_id: Optional[UUID4] = None
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

class RevisionResponse(RevisionBase):
    id: UUID4
    agent_id: UUID4
    settings_id: UUID4
    version_number: int
    created_at: str
    
    class Config:
        from_attributes = True

class AgentListResponse(BaseModel):
    agents: List[AgentResponse]

class SingleAgentResponse(BaseModel):
    agent: AgentResponse

class RevisionListResponse(BaseModel):
    revisions: List[RevisionResponse]

class SingleRevisionResponse(BaseModel):
    revision: RevisionResponse

################################################################################
### Agent Management Routes
################################################################################

@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    include_public: bool = Query(False, description="Include public agents from other users"),
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """List all agents accessible to the current user."""
    controller = AgentController(db, str(user.id))
    agents = controller.list_agents(include_public=include_public)
    
    # Convert data to dict for serialization
    agent_dicts = [a.to_dict() for a in agents]
    
    return {"agents": agent_dicts}

@router.get("/agents/{agent_id}", response_model=SingleAgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Get a specific agent by ID."""
    controller = AgentController(db, str(user.id))
    agent = controller.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or you don't have access to it"
        )
    
    return {"agent": agent.to_dict()}

@router.get("/agents/slug/{slug}", response_model=SingleAgentResponse)
async def get_agent_by_slug(
    slug: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Get a specific agent by slug."""
    controller = AgentController(db, str(user.id))
    agent = controller.get_agent_by_slug(slug)
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    return {"agent": agent.to_dict()}

@router.post("/agents", response_model=SingleAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Create a new agent."""
    controller = AgentController(db, str(user.id))
    
    try:
        settings_data_dict = agent_data.settings_data.model_dump() if agent_data.settings_data else None
        
        agent = controller.create_agent(
            name=agent_data.name,
            description=agent_data.description,
            visibility=agent_data.visibility,
            settings_id=agent_data.settings_id,
            settings_data=settings_data_dict
        )
        
        return {"agent": agent.to_dict()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while creating the agent: {str(e)}"
        )

@router.put("/agents/{agent_id}", response_model=SingleAgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Update an existing agent."""
    controller = AgentController(db, str(user.id))
    
    updated_agent = controller.update_agent(
        agent_id=agent_id,
        data=agent_data.model_dump(exclude_unset=True)
    )
    
    if not updated_agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or you don't have permission to update it"
        )
    
    return {"agent": updated_agent.to_dict()}

@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Delete an agent."""
    controller = AgentController(db, str(user.id))
    
    if not controller.delete_agent(agent_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or you don't have permission to delete it"
        )
    
    return None

################################################################################
### Revision Management Routes
################################################################################

@router.get("/agents/{agent_id}/revisions", response_model=RevisionListResponse)
async def list_revisions(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """List all revisions for an agent."""
    controller = AgentController(db, str(user.id))
    
    # First check if the agent exists and user has access
    agent = controller.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found or you don't have access to it"
        )
    
    revisions = controller.list_revisions(agent_id)
    
    # Convert data to dict for serialization
    revision_dicts = [r.to_dict() for r in revisions]
    
    return {"revisions": revision_dicts}

@router.get("/agents/revisions/{revision_id}", response_model=SingleRevisionResponse)
async def get_revision(
    revision_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Get a specific revision."""
    controller = AgentController(db, str(user.id))
    revision = controller.get_revision(revision_id)
    
    if not revision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Revision not found or you don't have access to it"
        )
    
    return {"revision": revision.to_dict()}

@router.post("/agents/{agent_id}/revisions", response_model=SingleRevisionResponse, status_code=status.HTTP_201_CREATED)
async def create_revision(
    agent_id: str,
    revision_data: RevisionCreate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Create a new revision for an agent."""
    controller = AgentController(db, str(user.id))
    
    try:
        settings_data_dict = revision_data.settings_data.model_dump() if revision_data.settings_data else None
        
        revision = controller.create_revision(
            agent_id=agent_id,
            settings_id=revision_data.settings_id,
            settings_data=settings_data_dict,
            revision_name=revision_data.revision_name,
            change_notes=revision_data.change_notes
        )
        
        if not revision:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found or you don't have permission to modify it"
            )
        
        return {"revision": revision.to_dict()}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating revision: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while creating the revision: {str(e)}"
        )

@router.put("/agents/{agent_id}/current-revision/{revision_id}", response_model=SingleAgentResponse)
async def set_current_revision(
    agent_id: str,
    revision_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Set the current revision for an agent."""
    controller = AgentController(db, str(user.id))
    
    updated_agent = controller.set_current_revision(agent_id, revision_id)
    
    if not updated_agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent or revision not found, or you don't have permission to modify it"
        )
    
    return {"agent": updated_agent.to_dict()}