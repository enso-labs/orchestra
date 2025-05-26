from fastapi import status, Depends, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.db import get_async_db
from src.models import ProtectedUser
from src.utils.auth import AuthenticatedUser, get_optional_user
from src.utils.logger import logger
TAG = "Model"
router = APIRouter(tags=[TAG])

################################################################################
### List Models
################################################################################
from src.constants.llm import get_available_models, get_public_models
@router.get(
    "/models", 
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "All models.",
            "content": {
                "application/json": {
                    "example": {
                        "models": []
                    }
                }
            }
        }
    }
)
async def list_models(
    user: AuthenticatedUser = Depends(get_optional_user),
):
    try:
        models = get_available_models() if user else get_public_models()
        return JSONResponse(
            content={"models": models},
            status_code=status.HTTP_200_OK
        )
    except Exception as e:
        logger.exception(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))