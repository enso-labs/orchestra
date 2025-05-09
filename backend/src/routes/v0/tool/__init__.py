from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse

from src.models import ProtectedUser
from src.utils.auth import get_optional_user
from src.routes.v0.tool.custom import router as tool_custom
from src.routes.v0.tool.invoke import router as tool_invoke
from src.routes.v0.tool.create import router as tool_create
from src.routes.v0.tool.list import router as tool_list

TAG = "Tool"
router = APIRouter(tags=[TAG])

## Attach custom router    
router.include_router(tool_custom)
router.include_router(tool_invoke)
router.include_router(tool_create)
router.include_router(tool_list)