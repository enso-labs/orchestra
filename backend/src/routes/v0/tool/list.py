from fastapi import status, Depends, APIRouter, Body, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.db import get_async_db
from src.models import ProtectedUser
from src.utils.auth import get_optional_user
from src.repos.tool_repo import ToolRepo

router = APIRouter()

@router.get(
	"/tools",
	responses={
		status.HTTP_200_OK: {
			"description": "Tools listed successfully",
			"content": {
				"application/json": {
					"example": {"tools": [{"id": "123", "name": "Tool 1", "description": "Tool 1 description", "url": "https://tool1.com", "spec": None, "headers": {}, "tags": ["tag1", "tag2"]}]}
				}
			}
		}
	}
)
async def list_tools(
	user: ProtectedUser = Depends(get_optional_user),
	db: AsyncSession = Depends(get_async_db)
):
	try:
		tool_repo = ToolRepo(db, user.id if user else None)
		tools = tool_repo.list_static_tools()
		if user:
			user_tools = await tool_repo.list_user_tools()
			tools.extend(user_tools)
			
		return JSONResponse(
			content={"tools": tools},
			status_code=status.HTTP_200_OK
		)
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))