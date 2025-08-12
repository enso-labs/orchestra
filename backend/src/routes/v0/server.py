"""
Server configuration management API routes.

This module provides FastAPI routes for managing server configurations
including CRUD operations, validation, and connection testing.
"""

from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status

from src.utils.auth import verify_credentials
from src.services.db import get_async_db
from src.schemas.models import User
from sqlalchemy.ext.asyncio import AsyncSession

from .server_schemas import (
    Config,
    ServerCreate,
    ServerUpdate,
    ServerResponse,
    ServerListResponse,
    ValidationResponse,
    ConnectionTestResponse
)
from .server_service import ServerService
from .server_validation import validate_server_config

router = APIRouter(
    prefix="/servers",
    tags=["Servers"],
)


@router.get("", response_model=ServerListResponse)
async def get_servers(
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
    type: Optional[str] = Query(None, description="Filter by server type ('mcp' or 'a2a')"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get a list of servers owned by the authenticated user."""
    service = ServerService(db)
    return await service.get_servers_list(
        user=user,
        server_type=type,
        limit=limit,
        offset=offset
    )


@router.get("/public", response_model=ServerListResponse)
async def get_public_servers(
    db: AsyncSession = Depends(get_async_db),
    type: Optional[str] = Query(None, description="Filter by server type ('mcp' or 'a2a')"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get a list of publicly shared servers."""
    # Create a dummy user for public servers (no authentication required)
    class DummyUser:
        id = None
    
    service = ServerService(db)
    return await service.get_servers_list(
        user=DummyUser(),
        server_type=type,
        limit=limit,
        offset=offset,
        public_only=True
    )


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Get details for a specific server by ID."""
    service = ServerService(db)
    return await service.get_server_by_id(server_id, user)


@router.get("/by-slug/{slug}", response_model=ServerResponse)
async def get_server_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Get details for a specific server by slug."""
    service = ServerService(db)
    return await service.get_server_by_slug(slug, user)


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Create a new server configuration."""
    service = ServerService(db)
    return await service.create_server(server_data, user)


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: uuid.UUID,
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Update an existing server configuration."""
    service = ServerService(db)
    return await service.update_server(server_id, server_data, user)


@router.patch("/{server_id}", response_model=ServerResponse)
async def partial_update_server(
    server_id: uuid.UUID,
    server_data: ServerUpdate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Partially update an existing server configuration."""
    service = ServerService(db)
    return await service.partial_update_server(server_id, server_data, user)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Delete a server configuration."""
    service = ServerService(db)
    await service.delete_server(server_id, user)
    return None


@router.post("/validate", response_model=ValidationResponse)
async def validate_server_config_endpoint(
    server_data: Config,
):
    """Validate a server configuration without saving it."""
    return await validate_server_config(server_data)


@router.post("/{server_id}/test-connection", response_model=ConnectionTestResponse, include_in_schema=False)
async def test_connection(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Test the connection to a saved server configuration."""
    service = ServerService(db)
    return await service.test_connection(server_id, user)