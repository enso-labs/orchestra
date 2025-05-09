from fastapi import status, Depends, APIRouter, Body, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.db import get_async_db
from src.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.repos.tool_repo import ToolRepo
from src.entities import AgentTool

router = APIRouter()

@router.post(
	"/tools",
	responses={
		status.HTTP_201_CREATED: {
			"description": "Tool created successfully",
		}
	}
)
async def create_tool(
	user: ProtectedUser = Depends(verify_credentials),
	tool: AgentTool = Body(...),
	db: AsyncSession = Depends(get_async_db)
):
	try:
		tool_repo = ToolRepo(db, user.id)
		tool = await tool_repo.create(
			name=tool.name,
			description=tool.description,
			url=tool.url,
			spec=tool.spec,
			headers=tool.headers,
			tags=tool.tags
		)
		return JSONResponse(
			content={"tool": tool.to_dict()},
			status_code=status.HTTP_201_CREATED
		)
	except ValueError as e:
		if "A tool with this name already exists" in str(e):
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
		else:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))