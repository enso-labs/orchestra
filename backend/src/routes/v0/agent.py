from typing import Annotated
from fastapi import Query, Request, Response, status, Depends, APIRouter, Path, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from src.controllers.agent import AgentController
from src.entities import Answer, AgentThread
from src.repos.agent_repo import AgentRepo
from src.repos.revision_repo import RevisionRepo
from src.utils.auth import verify_credentials, get_db
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

class RevisionCreate(BaseModel):
    settings_id: str
    name: Optional[str] = None
    description: Optional[str] = None

@router.get(
    "/agents", 
    tags=[TAG],
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
def list_agents(
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db),
    public: Optional[bool] = Query(default=True, description="Filter by public agents")
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    agents = agent_repo.get_all_user_agents(public=public)
    return JSONResponse(
        content={"agents": [agent.to_dict() for agent in agents]},
        status_code=status.HTTP_200_OK
    )

@router.post(
    "/agents", 
    tags=[TAG],
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
def create_agent(
    agent_data: AgentCreate,
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    try:
        agent = agent_repo.create(
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
def get_agent(
    agent_id: str = Path(..., description="The ID of the agent to retrieve"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    
    agent = agent_repo.get_by_id(agent_id=agent_id)
    
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
    tags=[TAG],
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
    db: Session = Depends(get_db)
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
def delete_agent(
    agent_id: str = Path(..., description="The ID of the agent to delete"),
    user: ProtectedUser = Depends(verify_credentials), 
    db: Session = Depends(get_db)
):
    agent_repo = AgentRepo(db=db, user_id=user.id)
    
    try:
        success = agent_repo.delete(agent_id=agent_id)
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
### Create New Thread
################################################################################

@router.post(
    "/agents/{agent_id}/thread", 
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from new thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['new_thread']
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n'
                    }
                }
            }
        }
    }
)
def agent_new_thread(
    request: Request,
    agent_id: str,
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return controller.agent_thread(request=request, query=body.query)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@router.post(
    "/agents/{agent_id}/thread/{thread_id}", 
    responses={
        status.HTTP_200_OK: {
            "description": "Latest message from new thread.",
            "content": {
                "application/json": {
                    "example": Answer.model_json_schema()['examples']['new_thread']
                },
                "text/event-stream": {
                    "description": "Server-sent events stream",
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "example": 'data: {"thread_id": "e208fbc9-92cd-4f50-9286-6eab533693c4", "event": "ai_chunk", "content": [{"text": "Hello", "type": "text", "index": 0}]}\n\n'
                    }
                }
            }
        }
    }
)
def agent_existing_thread(
    request: Request,
    agent_id: str,
    thread_id: str, 
    body: Annotated[AgentThread, Body()],
    user: ProtectedUser = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    try:
        controller = AgentController(db=db, user_id=user.id, agent_id=agent_id)
        return controller.agent_thread(request=request, query=body.query, thread_id=thread_id)
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



################################################################################
### Revisions
################################################################################
@router.get(
    "/agents/{agent_id}/v", 
    tags=[TAG],
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