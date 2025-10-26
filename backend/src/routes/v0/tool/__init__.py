from typing import Optional, List
from fastapi import Body, HTTPException, status, Depends, APIRouter, Request
from fastapi.responses import JSONResponse

from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.services.tool import tool_service
from src.routes.v0.tool.info import router as info_router
from src.schemas.entities import InvokeTool
from src.constants.examples import Examples
from src.utils.logger import logger


router = APIRouter(tags=["Tool"], prefix="/tools")


################################################################################
### List MCP Info
################################################################################
@router.get(
    "",
    name="List Tools",
    responses={
        status.HTTP_200_OK: {
            "description": "All tools.",
            "content": {
                "application/json": {"example": {"tools": tool_service.tool_details()}}
            },
        }
    },
)
async def list_tools(user: ProtectedUser = Depends(verify_credentials)):
    tools_response = tool_service.tool_details()
    return JSONResponse(
        content={"tools": tools_response}, status_code=status.HTTP_200_OK
    )


@router.post("/invoke", name="Invoke Tools")
async def invoke_tools(
    request: Request,
    tools: List[InvokeTool] = Body(..., example=Examples.INVOKE_TOOLS_EXAMPLE),
    user: Optional[ProtectedUser] = Depends(verify_credentials),
):
    try:
        tool_service.user_id = user.id if user else None
        tool_results: List[InvokeTool] = []
        for tool in tools:
            result = await tool_service.invoke_tool(tool.name, tool.args)
            tool_result: InvokeTool = InvokeTool(
                name=tool.name, args=tool.args, result=result
            )
            tool_results.append(tool_result.model_dump())
        return {"tools": tool_results}
    except Exception as e:
        logger.exception(str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


router.include_router(info_router)
