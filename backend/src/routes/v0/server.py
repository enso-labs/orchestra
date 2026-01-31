import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.entities.server import ServerCreate, ServerResponse, ServerUpdate
from src.services.db import get_async_db
from src.services.server import ServerService
from src.utils.auth import verify_credentials
from src.schemas.models import User

router = APIRouter(
    prefix="/servers",
    tags=["Servers"],
)


def _to_response(server: object) -> dict:
    """Convert a Server ORM instance to a ServerResponse-compatible dict."""
    # Use the decrypted config if available, otherwise the raw config
    config = getattr(server, "_decrypted_config", None)
    return {
        "id": server.id,  # type: ignore[attr-defined]
        "name": server.name,  # type: ignore[attr-defined]
        "slug": server.slug,  # type: ignore[attr-defined]
        "url": server.url,  # type: ignore[attr-defined]
        "transport": server.transport,  # type: ignore[attr-defined]
        "config": config,
        "user_id": server.user_id,  # type: ignore[attr-defined]
        "created_at": server.created_at,  # type: ignore[attr-defined]
        "updated_at": server.updated_at,  # type: ignore[attr-defined]
    }


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    data: ServerCreate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Create a new server configuration."""
    service = ServerService(db, user.id)
    try:
        server = await service.create(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return ServerResponse(**_to_response(server))


@router.get("", response_model=list[ServerResponse])
async def list_servers(
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """List all servers for the authenticated user."""
    service = ServerService(db, user.id)
    servers = await service.list_by_user()
    return [ServerResponse(**_to_response(s)) for s in servers]


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Get a single server by ID."""
    service = ServerService(db, user.id)
    server = await service.get_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return ServerResponse(**_to_response(server))


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: uuid.UUID,
    data: ServerUpdate,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Update a server configuration."""
    service = ServerService(db, user.id)
    try:
        server = await service.update(server_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return ServerResponse(**_to_response(server))


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Delete a server configuration."""
    service = ServerService(db, user.id)
    deleted = await service.delete(server_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Server not found")
    return None
