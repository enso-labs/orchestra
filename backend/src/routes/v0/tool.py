from typing import Dict, Any, Optional
from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from src.constants.examples import MCP_REQ_BODY_EXAMPLE
from src.constants import APP_LOG_LEVEL
from src.models import ProtectedUser
from src.repos.user_repo import UserRepo
from src.utils.auth import verify_credentials
from src.services.db import get_db
from src.services.mcp import McpService
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
    tags=[TAG],
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
def list_tools(username: str = Depends(verify_credentials)):
    return JSONResponse(
        content=tools_response,
        status_code=status.HTTP_200_OK
    )
    
    
################################################################################
### List MCP Info
################################################################################
from pydantic import BaseModel

class MCPInfo(BaseModel):
    mcp: Optional[Dict[str, Any]] = None
    mcpServers: Optional[Dict[str, Any]] = None
    
    model_config = {
        "json_schema_extra": {"example": MCP_REQ_BODY_EXAMPLE}
    }
    

@router.post(
    "/tools/mcp/info", 
    tags=[TAG],
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
        agent_session = McpService()
        mcp_config = config.mcpServers or config.mcp
        if not mcp_config:
            return JSONResponse(
                content={'error': 'No MCP servers or MCP config found'},
                status_code=status.HTTP_400_BAD_REQUEST
            )
        await agent_session.setup(mcp_config)
        tools = agent_session.tools()
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
    finally:
        await agent_session.cleanup()

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
    tags=[TAG],
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
    db: Session = Depends(get_db)
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