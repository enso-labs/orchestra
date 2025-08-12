"""
Tool management API routes.

This module provides FastAPI routes for managing and interacting with various
tool services including built-in tools, Arcade, MCP, and A2A integrations.
"""

from typing import Literal
from fastapi import status, Depends, APIRouter, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.constants.description import Description
from src.constants.examples import A2A_GET_AGENT_CARD_EXAMPLE, MCP_REQ_BODY_EXAMPLE, ARCADE_RESPONSE_EXAMPLE
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.services.db import get_async_db
from src.schemas.entities.a2a import A2AServers

from .tool_schemas import MCPInfo, ToolRequest
from .tool_services import ArcadeService, MCPToolService, A2AToolService, ToolInvocationService

TAG = "Tool"
router = APIRouter(tags=[TAG])

################################################################################
### List Built-in Tools
################################################################################
from src.tools import TOOL_LIBRARY, attach_tool_details

tool_names = [
    attach_tool_details({
        'id': tool.name, 
        'description': tool.description, 
        'args': tool.args, 
        'tags': tool.tags
    }) 
    for tool in TOOL_LIBRARY
]
tools_response = {"tools": tool_names}


@router.get(
    "/tools", 
    responses={
        status.HTTP_200_OK: {
            "description": "All tools.",
            "content": {
                "application/json": {
                    "example": tools_response
                }
            }
        }
    }
)
def list_tools():
    """List all available built-in tools."""
    return JSONResponse(
        content=tools_response,
        status_code=status.HTTP_200_OK
    )


################################################################################
### Arcade Integration
################################################################################
@router.get(
    "/tools/arcade", 
    description=Description.ARCADE_TOOLS.value,
    responses={
        status.HTTP_200_OK: {
            "description": "All capabilities.",
            "content": {
                "application/json": {
                    "example": ARCADE_RESPONSE_EXAMPLE
                }
            }
        }
    }
)
async def get_arcade_tools(
    toolkit: str = Query(default="", description="Toolkit to get"),
    name: str = Query(default="", description="Name of the tool to get"),
    limit: int = Query(default=25, description="Limit the number of tools to get"),
    offset: int = Query(default=0, description="Offset the number of tools to get"),
    type: Literal["static", "scheduled"] = Query(default="static", description="Type of tools to get"),
    db: AsyncSession = Depends(get_async_db)
):
    """Get tools from Arcade API."""
    return await ArcadeService.get_tools(
        toolkit=toolkit,
        name=name,
        limit=limit,
        offset=offset,
        tool_type=type
    )


@router.get(
    "/tools/arcade/{name}", 
    description=Description.ARCADE_TOOL.value,
    responses={
        status.HTTP_200_OK: {
            "description": "All capabilities.",
            "content": {
                "application/json": {
                    "example": ARCADE_RESPONSE_EXAMPLE['items'][0]
                }
            }
        }
    }
)
async def get_arcade_tool_spec(name: str):
    """Get a specific tool specification from Arcade API."""
    return await ArcadeService.get_tool_spec(name)


################################################################################
### MCP Integration
################################################################################
@router.post(
    "/tools/mcp/info", 
    responses={
        status.HTTP_200_OK: {
            "description": "All tools.",
            "content": {
                "application/json": {
                    "example": []
                }
            }
        }
    }
)
async def list_mcp_info(config: MCPInfo):
    """Get tool information from MCP servers."""
    return await MCPToolService.get_tools_info(config)


################################################################################
### A2A Integration
################################################################################
@router.post(
    "/tools/a2a/info", 
    responses={
        status.HTTP_200_OK: {
            "description": "All capabilities.",
            "content": {
                "application/json": {
                    "example": A2A_GET_AGENT_CARD_EXAMPLE
                }
            }
        }
    }
)
async def get_a2a_agent_card(body: A2AServers):
    """Get agent cards from A2A servers."""
    return await A2AToolService.get_agent_cards(body)


################################################################################
### Tool Invocation
################################################################################
@router.post(
    "/tools/{tool_id}/invoke",
    responses={
        status.HTTP_200_OK: {
            "description": "Tool execution result.",
            "content": {
                "application/json": {
                    "example": {
                        "result": "Tool execution result",
                        "success": True
                    }
                }
            }
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid tool or arguments.",
            "content": {
                "application/json": {
                    "example": {
                        "error": "Tool not found or invalid arguments",
                        "success": False
                    }
                }
            }
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "Error executing tool.",
            "content": {
                "application/json": {
                    "example": {
                        "error": "Internal server error",
                        "success": False
                    }
                }
            }
        }
    }
)
async def invoke_tool(
    tool_id: str,
    request: ToolRequest, 
    user: ProtectedUser = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Invoke a tool by executing it with the provided arguments."""
    return await ToolInvocationService.invoke_tool(tool_id, request, user, db)