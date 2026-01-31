import ipaddress
import socket
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from langchain_mcp_adapters.client import MultiServerMCPClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.entities.server import (
    ServerCreate,
    ServerResponse,
    ServerTestConnectionRequest,
    ServerTestConnectionResponse,
    ServerToolResponse,
    ServerUpdate,
)
from src.schemas.models.server import ServerTransport
from src.services.db import get_async_db
from src.services.server import ServerService
from src.utils.auth import verify_credentials
from src.utils.logger import logger
from src.utils.rate_limit import limiter
from src.schemas.models import User

router = APIRouter(
    prefix="/servers",
    tags=["Servers"],
)


def _resolve_and_validate_host(url: str) -> None:
    """Resolve DNS for a URL and check the resolved IP is not private (DNS rebinding protection)."""
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: no hostname")

    try:
        resolved_ips = socket.getaddrinfo(
            hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM
        )
    except socket.gaierror:
        raise ValueError(f"DNS resolution failed for {hostname}")

    for family, _, _, _, sockaddr in resolved_ips:
        ip_str = sockaddr[0]
        try:
            addr = ipaddress.ip_address(ip_str)
            if (
                addr.is_private
                or addr.is_loopback
                or addr.is_link_local
                or addr.is_reserved
            ):
                raise ValueError(
                    f"URL resolves to a private/internal address: {ip_str}"
                )
        except ValueError as e:
            if "private" in str(e) or "internal" in str(e):
                raise
            # Could not parse IP - skip
            continue


def _build_mcp_config(
    url: str, transport: ServerTransport, config: dict | None
) -> dict[str, dict]:
    """Build a MultiServerMCPClient-compatible config dict for a single server."""
    transport_str = (
        transport.value if isinstance(transport, ServerTransport) else str(transport)
    )
    entry: dict = {"transport": transport_str, "url": url}
    if config:
        headers = config.get("headers")
        if headers:
            entry["headers"] = headers
    return {"__test_server__": entry}


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


@router.post(
    "/test-connection",
    response_model=ServerTestConnectionResponse,
)
@limiter.limit("10/minute")
async def test_connection(
    request: Request,
    data: ServerTestConnectionRequest,
    user: User = Depends(verify_credentials),
):
    """Test connectivity to an MCP server URL with DNS rebinding protection."""
    # DNS rebinding protection: resolve and validate before connecting
    try:
        _resolve_and_validate_host(data.url)
    except ValueError as e:
        return ServerTestConnectionResponse(success=False, message=str(e))

    mcp_config = _build_mcp_config(data.url, data.transport, data.config)
    try:
        async with MultiServerMCPClient(mcp_config) as client:
            tools = await client.get_tools()
            return ServerTestConnectionResponse(
                success=True,
                message="Connection successful",
                tools_count=len(tools),
            )
    except Exception as e:
        logger.warning(f"MCP test-connection failed for {data.url}: {e}")
        return ServerTestConnectionResponse(
            success=False,
            message=f"Connection failed: {str(e)}",
        )


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


@router.get("/{server_id}/tools", response_model=list[ServerToolResponse])
async def discover_tools(
    server_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(verify_credentials),
):
    """Discover available tools from a saved MCP server."""
    service = ServerService(db, user.id)
    server = await service.get_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    # DNS rebinding protection
    try:
        _resolve_and_validate_host(server.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    decrypted_config = getattr(server, "_decrypted_config", None)
    mcp_config = _build_mcp_config(server.url, server.transport, decrypted_config)

    try:
        async with MultiServerMCPClient(mcp_config) as client:
            tools = await client.get_tools()
            return [
                ServerToolResponse(
                    name=tool.name,
                    description=getattr(tool, "description", None),
                )
                for tool in tools
            ]
    except Exception as e:
        logger.error(f"Tool discovery failed for server {server_id}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to discover tools: {str(e)}",
        )


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
