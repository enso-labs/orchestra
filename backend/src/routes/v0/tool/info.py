from fastapi import APIRouter, Body, status
from fastapi.responses import JSONResponse
from src.constants.examples import MCP_DICT_EXAMPLE
from src.services.tool import tool_service
from src.schemas.entities.a2a import A2AServer, McpServer, A2A_DICT_EXAMPLE
from src.constants.examples import A2A_GET_AGENT_CARD_EXAMPLE

router = APIRouter()


################################################################################
### List MCP Info
################################################################################
@router.post(
    "/mcp/info",
    responses={
        status.HTTP_200_OK: {
            "description": "All tools.",
            "content": {"application/json": {"example": []}},
        }
    },
)
async def list_mcp_info(
    config: dict[str, McpServer] = Body(openapi_examples=MCP_DICT_EXAMPLE),
):
    try:
        for name, server in config.items():
            config[name] = {
                "transport": server.transport,
                "url": server.url,
                "headers": server.headers,
            }
        tools = await tool_service.mcp_tools(config)
        return JSONResponse(
            content={
                "mcp": [
                    {
                        k: v
                        for k, v in tool.model_dump().items()
                        if k not in ["func", "coroutine"]
                    }
                    for tool in tools
                ]
            },
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


################################################################################
### List A2A Info
################################################################################
@router.post(
    "/a2a/info",
    responses={
        status.HTTP_200_OK: {
            "description": "All capabilities.",
            "content": {"application/json": {"example": A2A_GET_AGENT_CARD_EXAMPLE}},
        }
    },
)
async def get_a2a_agent_card(
    config: dict[str, A2AServer] = Body(openapi_examples=A2A_DICT_EXAMPLE),
):
    try:
        agent_cards = tool_service.agent_cards(config)

        return JSONResponse(
            content={"agent_cards": agent_cards}, status_code=status.HTTP_200_OK
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
