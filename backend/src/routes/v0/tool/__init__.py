from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse

from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.services.tool import tool_service
from src.routes.v0.tool.info import router as info_router


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
def list_tools(user: ProtectedUser = Depends(verify_credentials)):
    tools_response = tool_service.tool_details()
    return JSONResponse(
        content={"tools": tools_response}, status_code=status.HTTP_200_OK
    )


router.include_router(info_router)
