from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from src.models import ProtectedUser
from src.utils.auth import get_db, verify_credentials

router = APIRouter(tags=["Model"])

################################################################################
### List Models
################################################################################
from src.constants.llm import get_available_models
@router.get(
    "/models", 
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
def list_models(user: ProtectedUser = Depends(verify_credentials), db: Session = Depends(get_db)):
    return JSONResponse(
        content={"models": get_available_models()},
        status_code=status.HTTP_200_OK
    )