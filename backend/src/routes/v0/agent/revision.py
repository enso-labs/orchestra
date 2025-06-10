from fastapi import Response, status, Depends, APIRouter, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from src.repos.agent_repo import AgentRepo
from src.repos.revision_repo import RevisionRepo
from src.utils.auth import verify_credentials
from src.services.db import get_db
from src.schemas.models import ProtectedUser

TAG = "Agent"
router = APIRouter(tags=[TAG])

class RevisionCreate(BaseModel):
    settings_id: str
    name: Optional[str] = None
    description: Optional[str] = None

################################################################################
### Revisions
################################################################################
@router.get(
    "/agents/{agent_id}/v", 
    responses={
        status.HTTP_200_OK: {
            "description": "All revisions for an agent.",
            "content": {
                "application/json": {
                    "example": {"revisions": [{"id": "123", "revision_number": 1, "name": "Initial version"}]}
                }
            }
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Agent not found"
        }
    }
)
def list_agent_revisions(
    agent_id: str = Path(..., description="The ID of the agent"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    # First verify agent exists
    agent_repo = AgentRepo(db=db, user_id=user.id)
    agent = agent_repo.get_by_id(agent_id=agent_id)
    
    if not agent:
        return JSONResponse(
            content={"error": "Agent not found"},
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    revision_repo = RevisionRepo(db=db, user_id=user.id)
    revisions = revision_repo.get_all_for_agent(agent_id=agent_id)
    
    return JSONResponse(
        content={"revisions": [revision.to_dict() for revision in revisions]},
        status_code=status.HTTP_200_OK
    )

@router.post(
    "/agents/{agent_id}/v", 
    tags=[TAG],
    responses={
        status.HTTP_201_CREATED: {
            "description": "Revision created successfully.",
            "content": {
                "application/json": {
                    "example": {"revision": {"id": "123", "revision_number": 1, "name": "Initial version"}}
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
def create_agent_revision(
    revision_data: RevisionCreate,
    agent_id: str = Path(..., description="The ID of the agent"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    revision_repo = RevisionRepo(db=db, user_id=user.id)
    
    try:
        revision = revision_repo.create(
            agent_id=agent_id,
            settings_id=revision_data.settings_id,
            name=revision_data.name,
            description=revision_data.description
        )
        
        return JSONResponse(
            content={"revision": revision.to_dict()},
            status_code=status.HTTP_201_CREATED
        )
    except ValueError as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )

@router.get(
    "/agents/{agent_id}/v/{revision_number}", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "Revision retrieved successfully.",
            "content": {
                "application/json": {
                    "example": {"revision": {"id": "123", "revision_number": 1, "name": "Initial version"}}
                }
            }
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Revision not found"
        }
    }
)
def get_agent_revision(
    agent_id: str = Path(..., description="The ID of the agent"),
    revision_number: int = Path(..., description="The revision number to retrieve"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    revision_repo = RevisionRepo(db=db, user_id=user.id)
    
    revision = revision_repo.get_by_revision_number(agent_id=agent_id, revision_number=revision_number)
    
    if not revision:
        return JSONResponse(
            content={"error": "Revision not found"},
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    return JSONResponse(
        content={"revision": revision.to_dict()},
        status_code=status.HTTP_200_OK
    )

@router.put(
    "/agents/{agent_id}/v/{revision_number}", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "Agent updated to use specified revision.",
            "content": {
                "application/json": {
                    "example": {"agent": {"id": "123", "name": "Agent Name", "revision_number": 1}}
                }
            }
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Agent or revision not found"
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Bad request"
        }
    }
)
def set_active_revision(
    agent_id: str = Path(..., description="The ID of the agent"),
    revision_number: int = Path(..., description="The revision number to set as active"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    revision_repo = RevisionRepo(db=db, user_id=user.id)
    
    try:
        agent = revision_repo.set_active_revision(agent_id=agent_id, revision_number=revision_number)
        
        return JSONResponse(
            content={"agent": agent.to_dict()},
            status_code=status.HTTP_200_OK
        )
    except ValueError as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )

@router.delete(
    "/agents/{agent_id}/v/{revision_number}", 
    tags=[TAG],
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Revision deleted successfully."
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Revision not found"
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Cannot delete active revision"
        }
    }
)
def delete_agent_revision(
    agent_id: str = Path(..., description="The ID of the agent"),
    revision_number: int = Path(..., description="The revision number to delete"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    revision_repo = RevisionRepo(db=db, user_id=user.id)
    
    try:
        # First get the revision ID by revision number
        revision = revision_repo.get_by_revision_number(agent_id=agent_id, revision_number=revision_number)
        if not revision:
            return JSONResponse(
                content={"error": "Revision not found"},
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        success = revision_repo.delete(revision_id=revision.id)
        if not success:
            return JSONResponse(
                content={"error": "Revision not found"},
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_400_BAD_REQUEST
        )