from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from typing import Optional, List

from src.services.tool import tool_service
from src.schemas.entities import InvokeTool
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.constants.examples import Examples

invoke_router = APIRouter()


@invoke_router.post("/invoke", name="Invoke Tools")
async def invoke_tools(
    request: Request,
    tools: List[InvokeTool] = Body(..., examples=[Examples.INVOKE_TOOLS_EXAMPLE]),
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
