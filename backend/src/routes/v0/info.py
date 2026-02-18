from fastapi import APIRouter

from src.constants import APP_VERSION, APP_ENV, BACKEND_TYPE, WORKSPACE_ROOT

router = APIRouter(tags=["Info"])


@router.get("/health")
async def health():
    """Health check endpoint returning server status, mode, and workspace path."""
    return {
        "status": "ok",
        "version": APP_VERSION,
        "mode": BACKEND_TYPE,
        "workspace": WORKSPACE_ROOT,
        "environment": APP_ENV,
    }
