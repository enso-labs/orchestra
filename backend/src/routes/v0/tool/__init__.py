from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse

from src.models import ProtectedUser
from src.utils.auth import get_optional_user
from src.routes.v0.tool.custom import router as tool_custom
from src.routes.v0.tool.invoke import router as tool_invoke

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
def list_tools(
    user: ProtectedUser = Depends(get_optional_user)
):
    return JSONResponse(
        content=tools_response,
        status_code=status.HTTP_200_OK
    )

## Attach custom router    
router.include_router(tool_custom)
router.include_router(tool_invoke)