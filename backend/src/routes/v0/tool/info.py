from fastapi import APIRouter, Body, status
from fastapi.responses import JSONResponse
from src.constants.examples import MCP_REQ_BODY_EXAMPLE
from src.services.tool import tool_service
from src.schemas.entities.a2a import A2AServers
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
async def list_mcp_info(config: dict = Body(openapi_examples=MCP_REQ_BODY_EXAMPLE)):
    try:
        tools = await tool_service.mcp_tools(config.mcp)
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
async def get_a2a_agent_card(body: A2AServers):
    try:
        if not body.a2a:
            return JSONResponse(
                content={"error": "No A2A servers or A2A config found"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        agent_cards = tool_service.a2a_tools(body.a2a)

        return JSONResponse(
            content={"agent_cards": agent_cards}, status_code=status.HTTP_200_OK
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
