from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from src.models import ProtectedUser
from src.repos.user_repo import UserRepo
from src.utils.auth import get_db, verify_credentials

TAG = "Agent"
router = APIRouter(tags=[TAG])

################################################################################
### List Tools
################################################################################
from src.tools import tools
tool_names = [{'id':tool.name, 'description':tool.description, 'args':tool.args} for tool in tools]
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
def list_tools(username: str = Depends(verify_credentials)):
    return JSONResponse(
        content=tools_response,
        status_code=status.HTTP_200_OK
    )
    
################################################################################
### List Models
################################################################################
from src.constants.llm import get_available_models
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
def list_models(user: ProtectedUser = Depends(verify_credentials), db: Session = Depends(get_db)):
    user_repo = UserRepo(db=db)
    return JSONResponse(
        content={"models": get_available_models(user_repo=user_repo, user_id=user.id)},
        status_code=status.HTTP_200_OK
    )