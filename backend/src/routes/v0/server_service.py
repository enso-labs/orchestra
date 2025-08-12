"""
Server configuration service layer.

This module contains business logic for server configuration operations,
including CRUD operations, authorization checks, and connection testing.
"""

import uuid
import time
import random
from typing import Optional, List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.schemas.models import Server, User
from .server_schemas import (
    ServerCreate, 
    ServerUpdate, 
    ServerResponse, 
    ServerListResponse,
    ConnectionTestResponse
)
from .server_validation import validate_server_config


class ServerService:
    """Service class for server configuration operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_servers_list(
        self,
        user: User,
        server_type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        public_only: bool = False
    ) -> ServerListResponse:
        """
        Get a paginated list of servers.
        
        Args:
            user: The authenticated user
            server_type: Optional filter by server type
            limit: Maximum number of servers to return
            offset: Number of servers to skip
            public_only: Whether to return only public servers
            
        Returns:
            ServerListResponse with servers and pagination info
        """
        # Build base query
        if public_only:
            query = select(Server).filter(Server.public)
            count_query = select(func.count()).select_from(Server).filter(Server.public)
        else:
            query = select(Server).filter(Server.user_id == user.id)
            count_query = select(func.count()).select_from(Server).filter(Server.user_id == user.id)
        
        # Apply type filter if specified
        if server_type:
            query = query.filter(Server.type == server_type)
            count_query = count_query.filter(Server.type == server_type)
        
        # Get total count
        total = await self.db.scalar(count_query)
        
        # Apply pagination and execute
        query = query.offset(offset).limit(limit)
        result = await self.db.execute(query)
        servers = result.scalars().all()
        
        return ServerListResponse(
            servers=[ServerResponse(**server.to_dict()) for server in servers],
            total=total,
            limit=limit,
            offset=offset
        )
    
    async def get_server_by_id(
        self,
        server_id: uuid.UUID,
        user: User
    ) -> ServerResponse:
        """
        Get a server by ID with authorization check.
        
        Args:
            server_id: The server ID to fetch
            user: The authenticated user
            
        Returns:
            ServerResponse if found and authorized
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        result = await self.db.execute(select(Server).filter(Server.id == server_id))
        server = result.scalar_one_or_none()
        
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")
        
        if not server.public and str(server.user_id) != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this server")
        
        return ServerResponse(**server.to_dict())
    
    async def get_server_by_slug(
        self,
        slug: str,
        user: User
    ) -> ServerResponse:
        """
        Get a server by slug with authorization check.
        
        Args:
            slug: The server slug to fetch
            user: The authenticated user
            
        Returns:
            ServerResponse if found and authorized
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        result = await self.db.execute(select(Server).filter(Server.slug == slug))
        server = result.scalar_one_or_none()
        
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")
        
        if not server.public and str(server.user_id) != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this server")
        
        return ServerResponse(**server.to_dict())
    
    async def create_server(
        self,
        server_data: ServerCreate,
        user: User
    ) -> ServerResponse:
        """
        Create a new server configuration.
        
        Args:
            server_data: The server configuration data
            user: The authenticated user
            
        Returns:
            ServerResponse for the created server
            
        Raises:
            HTTPException: If validation fails
        """
        # Validate server configuration
        validation = await validate_server_config(server_data)
        if not validation.valid:
            raise HTTPException(status_code=400, detail={"errors": validation.errors})
        
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
        
        self.db.add(server)
        await self.db.commit()
        await self.db.refresh(server)
        
        return ServerResponse(**server.to_dict())
    
    async def update_server(
        self,
        server_id: uuid.UUID,
        server_data: ServerCreate,
        user: User
    ) -> ServerResponse:
        """
        Update an existing server configuration (full update).
        
        Args:
            server_id: The server ID to update
            server_data: The new server configuration data
            user: The authenticated user
            
        Returns:
            ServerResponse for the updated server
            
        Raises:
            HTTPException: If server not found, not authorized, or validation fails
        """
        server = await self._get_user_server(server_id, user)
        
        # Validate server configuration
        validation = await validate_server_config(server_data)
        if not validation.valid:
            raise HTTPException(status_code=400, detail={"errors": validation.errors})
        
        # Update server
        server.name = server_data.name
        server.type = server_data.type
        server.config = server_data.config
        server.description = server_data.description
        server.documentation = server_data.documentation
        server.documentation_url = server_data.documentation_url
        server.public = server_data.public
        server.slug = Server.generate_slug(server_data.name)
        
        await self.db.commit()
        await self.db.refresh(server)
        
        return ServerResponse(**server.to_dict())
    
    async def partial_update_server(
        self,
        server_id: uuid.UUID,
        server_data: ServerUpdate,
        user: User
    ) -> ServerResponse:
        """
        Partially update an existing server configuration.
        
        Args:
            server_id: The server ID to update
            server_data: The partial server configuration data
            user: The authenticated user
            
        Returns:
            ServerResponse for the updated server
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        server = await self._get_user_server(server_id, user)
        
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
        
        await self.db.commit()
        await self.db.refresh(server)
        
        return ServerResponse(**server.to_dict())
    
    async def delete_server(
        self,
        server_id: uuid.UUID,
        user: User
    ) -> None:
        """
        Delete a server configuration.
        
        Args:
            server_id: The server ID to delete
            user: The authenticated user
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        server = await self._get_user_server(server_id, user)
        await self.db.delete(server)
        await self.db.commit()
    
    async def test_connection(
        self,
        server_id: uuid.UUID,
        user: User
    ) -> ConnectionTestResponse:
        """
        Test connection to a server configuration.
        
        Args:
            server_id: The server ID to test
            user: The authenticated user
            
        Returns:
            ConnectionTestResponse with test results
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        result = await self.db.execute(select(Server).filter(Server.id == server_id))
        server = result.scalar_one_or_none()
        
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")
        
        if str(server.user_id) != user.id and not server.public:
            raise HTTPException(status_code=403, detail="Not authorized to test this server")
        
        # Mock implementation for now - TODO: Replace with actual connection testing
        try:
            time.sleep(0.5)  # Simulate network latency
            success = random.random() > 0.2  # 80% chance of success
            
            if success:
                return ConnectionTestResponse(
                    success=True,
                    latency_ms=random.randint(50, 500),
                    message="Successfully connected to server"
                )
            else:
                error_types = ["TIMEOUT", "CONNECTION_REFUSED", "AUTHENTICATION_FAILED"]
                error_type = random.choice(error_types)
                
                error_messages = {
                    "TIMEOUT": "Connection timed out after 30 seconds",
                    "CONNECTION_REFUSED": "Connection refused by remote server",
                    "AUTHENTICATION_FAILED": "Authentication failed"
                }
                
                return ConnectionTestResponse(
                    success=False,
                    error=error_messages[error_type],
                    details={
                        "error_code": error_type,
                        "url": list(server.config.values())[0].get("url", "") if server.config else ""
                    }
                )
        
        except Exception as e:
            return ConnectionTestResponse(
                success=False,
                error=str(e),
                details={"error_code": "UNKNOWN_ERROR"}
            )
    
    async def _get_user_server(self, server_id: uuid.UUID, user: User) -> Server:
        """
        Get a server that belongs to the user.
        
        Args:
            server_id: The server ID to fetch
            user: The authenticated user
            
        Returns:
            Server instance if found and owned by user
            
        Raises:
            HTTPException: If server not found or not authorized
        """
        result = await self.db.execute(select(Server).filter(Server.id == server_id))
        server = result.scalar_one_or_none()
        
        if not server:
            raise HTTPException(status_code=404, detail="Server not found")
        
        if str(server.user_id) != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this server")
        
        return server