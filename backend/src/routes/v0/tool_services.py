"""
Tool-related service integrations.

This module contains service classes for integrating with external tool services
like Arcade, MCP, and A2A protocols.
"""

import httpx
import traceback
from typing import Dict, Any, List, Optional, Literal
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants import ARCADE_API_KEY, APP_LOG_LEVEL
from src.services.mcp import McpService
from src.utils.a2a import A2ACardResolver
from src.schemas.entities.a2a import A2AServers
from src.repos.user_repo import UserRepo
from src.schemas.models import ProtectedUser
from src.utils.logger import logger
from .tool_schemas import MCPInfo, ToolRequest, ToolInvocationResponse


class ArcadeService:
    """Service for interacting with Arcade API."""
    
    BASE_URL = "https://api.arcade.dev/v1"
    
    @classmethod
    async def get_tools(
        cls,
        toolkit: str = "",
        name: str = "",
        limit: int = 25,
        offset: int = 0,
        tool_type: Literal["static", "scheduled"] = "static"
    ) -> JSONResponse:
        """
        Get tools from Arcade API.
        
        Args:
            toolkit: Toolkit to filter by
            name: Tool name to filter by
            limit: Maximum number of tools to return
            offset: Number of tools to skip
            tool_type: Type of tools to retrieve
            
        Returns:
            JSONResponse with tools data or error
        """
        try:
            if tool_type == "static":
                url = f"{cls.BASE_URL}/tools"
            elif tool_type == "scheduled":
                url = f"{cls.BASE_URL}/scheduled_tools"
            else:
                raise ValueError(f"Unsupported tool type: {tool_type}")
                
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers={"Authorization": ARCADE_API_KEY},
                    params={
                        "toolkit": toolkit,
                        "limit": limit,
                        "offset": offset
                    }
                )
                response.raise_for_status()
                arcade_tools = response.json()
                
            return JSONResponse(
                content=arcade_tools,
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception(f"Error getting arcade tools: {e}")
            return JSONResponse(
                content={'error': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @classmethod
    async def get_tool_spec(cls, name: str) -> JSONResponse:
        """
        Get a specific tool specification from Arcade API.
        
        Args:
            name: Name of the tool to retrieve
            
        Returns:
            JSONResponse with tool specification or error
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{cls.BASE_URL}/tools/{name}",
                    headers={"Authorization": ARCADE_API_KEY},
                )
                response.raise_for_status()
                arcade_tools = response.json()
                
            return JSONResponse(
                content=arcade_tools,
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception(f"Error getting arcade tool spec: {e}")
            return JSONResponse(
                content={'error': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MCPToolService:
    """Service for interacting with MCP (Model Context Protocol) tools."""
    
    @classmethod
    async def get_tools_info(cls, config: MCPInfo) -> JSONResponse:
        """
        Get tool information from MCP servers.
        
        Args:
            config: MCP configuration containing server details
            
        Returns:
            JSONResponse with MCP tools or error
        """
        try:
            mcp_config = config.mcpServers or config.mcp
            if not mcp_config:
                return JSONResponse(
                    content={'error': 'No MCP servers or MCP config found'},
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            
            mcp_service = McpService(mcp_config)
            tools = await mcp_service.get_tools()
            
            return JSONResponse(
                content={'mcp': [
                    {k: v for k, v in tool.model_dump().items() if k not in ['func', 'coroutine']}
                    for tool in tools
                ]},
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            return JSONResponse(
                content={'error': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class A2AToolService:
    """Service for interacting with A2A (Agent to Agent) tools."""
    
    @classmethod
    async def get_agent_cards(cls, body: A2AServers) -> JSONResponse:
        """
        Get agent cards from A2A servers.
        
        Args:
            body: A2A server configuration
            
        Returns:
            JSONResponse with agent cards or error
        """
        try:
            results = []
            
            if not body.a2a:
                return JSONResponse(
                    content={'error': 'No A2A servers or A2A config found'},
                    status_code=status.HTTP_400_BAD_REQUEST
                )
                
            for server_name, server in body.a2a.items():
                try:
                    a2a_card_resolver = A2ACardResolver(server.base_url, server.agent_card_path)
                    agent_card = a2a_card_resolver.get_agent_card()
                    results.append(agent_card.model_dump())
                except Exception as server_error:
                    results.append({"error": str(server_error), "base_url": server.base_url})
                    
            return JSONResponse(
                content={'agent_cards': results},
                status_code=status.HTTP_200_OK
            )
        except Exception as e:
            return JSONResponse(
                content={'error': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ToolInvocationService:
    """Service for invoking tools."""
    
    @classmethod
    async def invoke_tool(
        cls,
        tool_id: str,
        request: ToolRequest,
        user: ProtectedUser,
        db: AsyncSession
    ) -> JSONResponse:
        """
        Invoke a tool with the provided arguments.
        
        Args:
            tool_id: ID of the tool to invoke
            request: Tool invocation request with arguments
            user: Authenticated user
            db: Database session
            
        Returns:
            JSONResponse with tool execution result
        """
        try:
            # Find the tool by id
            from src.tools import tools, dynamic_tools
            selected_tool = next((tool for tool in tools if tool.name == tool_id), None)
            
            if not selected_tool:
                return JSONResponse(
                    content={"error": f"Tool with id '{tool_id}' not found", "success": False},
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            
            user_repo = UserRepo(db, user.id)
            # Use dynamic_tools to properly set metadata
            tool_with_metadata = dynamic_tools([tool_id], {"user_repo": user_repo})[0]
            
            # Execute the tool with the provided arguments
            output = tool_with_metadata.invoke(input=request.args)
                
            return JSONResponse(
                content={"output": output, "success": True},
                status_code=status.HTTP_200_OK
            )
            
        except Exception as e:
            error_message = str(e)
            error_traceback = traceback.format_exc()
            
            return JSONResponse(
                content={
                    "error": error_message,
                    "traceback": error_traceback if "DEBUG" in APP_LOG_LEVEL else None,
                    "success": False
                },
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )