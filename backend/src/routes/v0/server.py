from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import json
import uuid

from src.utils.auth import verify_credentials
from src.services.db import get_async_db
from src.models import Server, User

router = APIRouter(
    prefix="/servers",
    tags=["Servers"],
)

class Config(BaseModel):
    type: str = Field(..., description="Server type: 'mcp' or 'a2a'", pattern="^(mcp|a2a)$")
    config: dict

class ServerCreate(Config):
    name: str
    description: Optional[str] = None
    documentation: Optional[str] = Field(None, description="Markdown documentation for the server")
    documentation_url: Optional[str] = Field(None, description="External URL for server documentation")
    public: bool = False

class ServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    config: Optional[dict] = None
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: Optional[bool] = None

class ServerResponse(BaseModel):
    id: str
    user_id: str
    name: str
    slug: str
    description: Optional[str] = None
    type: str
    config: dict
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: bool
    created_at: str
    updated_at: str

class ServerListResponse(BaseModel):
    servers: List[ServerResponse]
    total: int
    limit: int
    offset: int

class ValidationResponse(BaseModel):
    valid: bool
    errors: List[dict] = []

class ConnectionTestResponse(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None
    details: Optional[dict] = None


@router.get("", response_model=ServerListResponse)
async def get_servers(
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
    type: Optional[str] = Query(None, description="Filter by server type ('mcp' or 'a2a')"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get a list of servers owned by the authenticated user."""
    query = select(Server).filter(Server.user_id == user.id)
    
    if type:
        query = query.filter(Server.type == type)
    
    # Count total servers first
    from sqlalchemy import func
    count_query = select(func.count()).select_from(Server).filter(Server.user_id == user.id)
    if type:
        count_query = count_query.filter(Server.type == type)
    total = await db.scalar(count_query)
    
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    servers = result.scalars().all()
    
    return {
        "servers": [ServerResponse(**server.to_dict()) for server in servers],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/public", response_model=ServerListResponse)
async def get_public_servers(
    db: AsyncSession = Depends(get_async_db),
    type: Optional[str] = Query(None, description="Filter by server type ('mcp' or 'a2a')"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get a list of publicly shared servers."""
    # Use direct boolean check rather than `== True`
    query = select(Server).filter(Server.public)
    if type:
        query = query.filter(Server.type == type)
    # Count total servers first without fetching all rows
    from sqlalchemy import func
    count_query = (
        select(func.count())
        .select_from(Server)
        .filter(Server.public)
    )
    if type:
        count_query = count_query.filter(Server.type == type)
    total = await db.scalar(count_query)
    # Now apply paging and fetch the actual rows
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    servers = result.scalars().all()
    return {
        "servers": [ServerResponse(**server.to_dict()) for server in servers],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Get details for a specific server by ID."""
    result = await db.execute(select(Server).filter(Server.id == server_id))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if not server.public and str(server.user_id) != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this server")
    
    return ServerResponse(**server.to_dict())


@router.get("/by-slug/{slug}", response_model=ServerResponse)
async def get_server_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Get details for a specific server by slug."""
    result = await db.execute(select(Server).filter(Server.slug == slug))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if not server.public and str(server.user_id) != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this server")
    
    return ServerResponse(**server.to_dict())


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Create a new server configuration."""
    # Validate server configuration
    validation = await validate_server_config(server_data)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"errors": validation["errors"]})
    
    # Create new server
    server = Server(
        user_id=user.id,
        name=server_data.name,
        type=server_data.type,
        config=server_data.config,
        description=server_data.description,
        documentation=server_data.documentation,
        documentation_url=server_data.documentation_url,
        public=server_data.public
    )
    
    db.add(server)
    await db.commit()
    await db.refresh(server)
    
    return ServerResponse(**server.to_dict())


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: uuid.UUID,
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Update an existing server configuration."""
    result = await db.execute(select(Server).filter(Server.id == server_id))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if str(server.user_id) != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this server")
    
    # Validate server configuration
    validation = await validate_server_config(server_data)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"errors": validation["errors"]})
    
    # Update server
    server.name = server_data.name
    server.type = server_data.type
    server.config = server_data.config
    server.description = server_data.description
    server.documentation = server_data.documentation
    server.documentation_url = server_data.documentation_url
    server.public = server_data.public
    server.slug = Server.generate_slug(server_data.name)
    
    await db.commit()
    await db.refresh(server)
    
    return ServerResponse(**server.to_dict())


@router.patch("/{server_id}", response_model=ServerResponse)
async def partial_update_server(
    server_id: uuid.UUID,
    server_data: ServerUpdate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Partially update an existing server configuration."""
    result = await db.execute(select(Server).filter(Server.id == server_id))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if str(server.user_id) != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this server")
    
    # Update fields if provided
    if server_data.name is not None:
        server.name = server_data.name
        server.slug = Server.generate_slug(server_data.name)
    
    if server_data.description is not None:
        server.description = server_data.description
    
    if server_data.type is not None:
        server.type = server_data.type
    
    if server_data.config is not None:
        server.config = server_data.config
    
    if server_data.documentation is not None:
        server.documentation = server_data.documentation
    
    if server_data.documentation_url is not None:
        server.documentation_url = server_data.documentation_url
    
    if server_data.public is not None:
        server.public = server_data.public
    
    await db.commit()
    await db.refresh(server)
    
    return ServerResponse(**server.to_dict())


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Delete a server configuration."""
    result = await db.execute(select(Server).filter(Server.id == server_id))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if str(server.user_id) != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this server")
    
    await db.delete(server)
    await db.commit()
    
    return None


@router.post("/validate", response_model=ValidationResponse)
async def validate_server_config(
    server_data: Config,
):
    """Validate a server configuration without saving it."""
    errors = []
    
    # Validate server type
    if server_data.type not in ["mcp", "a2a"]:
        errors.append({
            "field": "type",
            "message": "Server type must be either 'mcp' or 'a2a'"
        })
    
    # Validate configuration based on server type
    if server_data.type == "mcp":
        # MCP server validation
        for key, config in server_data.config.items():
            if not isinstance(config, dict):
                errors.append({
                    "field": f"config.{key}",
                    "message": "Configuration must be an object"
                })
                continue
            
            if "transport" not in config:
                errors.append({
                    "field": f"config.{key}.transport",
                    "message": "Transport is required"
                })
            elif config["transport"] not in ["sse", "websocket", "http"]:
                errors.append({
                    "field": f"config.{key}.transport",
                    "message": "Transport must be one of: sse, websocket, http"
                })
            
            if "url" not in config:
                errors.append({
                    "field": f"config.{key}.url",
                    "message": "URL is required"
                })
    
    elif server_data.type == "a2a":
        # A2A server validation
        for key, config in server_data.config.items():
            if not isinstance(config, dict):
                errors.append({
                    "field": f"config.{key}",
                    "message": "Configuration must be an object"
                })
                continue
            
            if "base_url" not in config:
                errors.append({
                    "field": f"config.{key}.base_url",
                    "message": "Base URL is required"
                })
            
            if "agent_card_path" not in config:
                errors.append({
                    "field": f"config.{key}.agent_card_path",
                    "message": "Agent card path is required"
                })
    
    # Documentation validation - no specific requirements yet
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


# TODO: Update with actual connection test
@router.post("/{server_id}/test-connection", response_model=ConnectionTestResponse, include_in_schema=False)
async def test_connection(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Test the connection to a saved server configuration."""
    result = await db.execute(select(Server).filter(Server.id == server_id))
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if str(server.user_id) != user.id and not server.public:
        raise HTTPException(status_code=403, detail="Not authorized to test this server")
    
    # Implementation will depend on the server type and how you want to test connections
    # This is a placeholder implementation
    try:
        # Mock implementation for now
        import time
        import random
        
        time.sleep(0.5)  # Simulate network latency
        success = random.random() > 0.2  # 80% chance of success
        
        if success:
            return {
                "success": True,
                "latency_ms": random.randint(50, 500),
                "message": "Successfully connected to server"
            }
        else:
            error_types = ["TIMEOUT", "CONNECTION_REFUSED", "AUTHENTICATION_FAILED"]
            error_type = random.choice(error_types)
            
            if error_type == "TIMEOUT":
                return {
                    "success": False,
                    "error": "Connection timed out after 30 seconds",
                    "details": {
                        "error_code": error_type,
                        "url": list(server.config.values())[0].get("url", "")
                    }
                }
            elif error_type == "CONNECTION_REFUSED":
                return {
                    "success": False,
                    "error": "Connection refused by remote server",
                    "details": {
                        "error_code": error_type,
                        "url": list(server.config.values())[0].get("url", "")
                    }
                }
            else:
                return {
                    "success": False,
                    "error": "Authentication failed",
                    "details": {
                        "error_code": error_type,
                        "url": list(server.config.values())[0].get("url", "")
                    }
                }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "details": {
                "error_code": "UNKNOWN_ERROR"
            }
        } 