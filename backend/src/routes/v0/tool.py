from typing import Dict, Any, List, Literal, Optional
from fastapi import status, Depends, APIRouter, Query
from fastapi.responses import JSONResponse
import httpx
from langchain_arcade import ArcadeToolManager
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from src.constants.description import Description
from src.entities import ArcadeConfig
from src.constants.examples import A2A_GET_AGENT_CARD_EXAMPLE, MCP_REQ_BODY_EXAMPLE, ARCADE_RESPONSE_EXAMPLE
from src.constants import APP_LOG_LEVEL, ARCADE_API_KEY, UserTokenKey
from src.models import ProtectedUser
from src.repos.user_repo import UserRepo
from src.utils.auth import resolve_user
from src.services.db import get_db, get_async_db
from src.services.mcp import McpService
from src.utils.logger import logger
from langchain_mcp_adapters.client import MultiServerMCPClient

TAG = "Tool"
router = APIRouter(tags=[TAG])

################################################################################
### List Tools
################################################################################
from src.tools import tools, attach_tool_details
tool_names = [attach_tool_details({'id':tool.name, 'description':tool.description, 'args':tool.args, 'tags':tool.tags}) for tool in tools]
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
def list_tools(
    # user: ProtectedUser = Depends(resolve_user)
):
    return JSONResponse(
        content=tools_response,
        status_code=status.HTTP_200_OK
    )
    
    
################################################################################
### List Arcade Info
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
    type: Literal[
        "static", 
        # "formatted", 
        "scheduled"
    ] = Query(default="static", description="Type of tools to get"),
    # user: ProtectedUser = Depends(resolve_user),
    db: AsyncSession = Depends(get_async_db)
):
    BASE_URL = "https://api.arcade.dev/v1"
    try:
        # user_repo = UserRepo(db, user.id)
        # token = await user_repo.get_token(key=UserTokenKey.ARCADE_API_KEY.name)
        # if not token:
        #     return JSONResponse(
        #         content={'error': 'No ARCADE_API_KEY found'},
        #         status_code=status.HTTP_400_BAD_REQUEST
        #     )
            
        if type == "static":
            url = f"{BASE_URL}/tools"
        elif type == "scheduled":
            url = f"{BASE_URL}/scheduled_tools"
        elif type == "formatted":
            url = f"{BASE_URL}/formatted_tools"
                
        async with httpx.AsyncClient() as client:
            res = await client.get(
                url,
                headers={"Authorization": ARCADE_API_KEY},
                params={
                    "toolkit": toolkit,
                    "limit": limit,
                    "offset": offset
                }
            )
            res.raise_for_status()
            arcade_tools = res.json() 
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
async def get_arcade_tool_spec(
    name: str,
    # user: ProtectedUser = Depends(resolve_user),
    # db: AsyncSession = Depends(get_async_db)
):
    BASE_URL = "https://api.arcade.dev/v1"
    try:
        # user_repo = UserRepo(db, user.id)
        # token = await user_repo.get_token(key=UserTokenKey.ARCADE_API_KEY.name)
        # if not token:
        #     return JSONResponse(
        #         content={'error': 'No ARCADE_API_KEY found'},
        #         status_code=status.HTTP_400_BAD_REQUEST
        #     )

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{BASE_URL}/tools/{name}",
                headers={"Authorization": ARCADE_API_KEY},
            )
            res.raise_for_status()
            arcade_tools = res.json() 
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
    
    
################################################################################
### List MCP Info
################################################################################
from pydantic import BaseModel, Field

class MCPInfo(BaseModel):
    mcp: Optional[Dict[str, Any]] = None
    mcpServers: Optional[Dict[str, Any]] = None
    
    model_config = {
        "json_schema_extra": {"example": MCP_REQ_BODY_EXAMPLE}
    }
    

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
async def list_mcp_info(
    config: MCPInfo
):
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

################################################################################
### List A2A Info
################################################################################
from src.utils.a2a import A2ACardResolver, A2AClient
from src.entities.a2a import A2AServers

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
async def get_a2a_agent_card(
    body: A2AServers
):
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

################################################################################
### Invoke A2A Agent
################################################################################
# @router.post(
#     "/tools/a2a/invoke", 
#     tags=[TAG],
#     responses={
#         status.HTTP_200_OK: {
#             "description": "Invoke a agent.",
#             "content": {
#                 "application/json": {
#                     "example": {}
#                 }
#             }
#         }
#     }
# )
# async def invoke_a2a_agent(
#     body: dict[str, Any]
# ):
#     try:
#         a2a_card = A2ACardResolver(**body)
#         a2a_client = A2AClient(a2a_card)
#         response = a2a_client.invoke(body['task'])
                
#         return JSONResponse(
#             content={'answer': 'Agent invoked'},
#             status_code=status.HTTP_200_OK
#         )
#     except Exception as e:
#         return JSONResponse(
#             content={'error': str(e)},
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
#         )

################################################################################
### Test Tool
################################################################################
from pydantic import BaseModel
from typing import Dict, Any, Optional
import traceback

class ToolRequest(BaseModel):
    tool_id: str
    input: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

################################################################################
### Test Tool
################################################################################
from pydantic import BaseModel
from typing import Dict, Any, Optional
import traceback
import os

class ToolRequest(BaseModel):
    args: Dict[str, Any]
    # metadata: Optional[Dict[str, Any]] = None

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
    user: ProtectedUser = Depends(resolve_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Invoke a tool by executing it with the provided arguments.
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