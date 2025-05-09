from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse

from src.constants.examples import MCP_REQ_BODY_EXAMPLE, A2A_GET_AGENT_CARD_EXAMPLE
from src.utils.a2a import A2ACardResolver
from src.entities.a2a import A2AServers
from src.services.mcp import McpService

router = APIRouter()

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
### List A2A Info
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