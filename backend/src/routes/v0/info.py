from fastapi import status, Depends, APIRouter
from fastapi.responses import JSONResponse
from src.constants import APP_VERSION

TAG = "Info"
router = APIRouter(tags=[TAG])


@router.get(
    "/info",
    tags=[TAG],
    responses={
        status.HTTP_200_OK: {
            "description": "All tools.",
            "content": {"application/json": {"example": {"version": APP_VERSION}}},
        }
    },
)
def info():
    return JSONResponse(
        content={"version": APP_VERSION}, status_code=status.HTTP_200_OK
    )
