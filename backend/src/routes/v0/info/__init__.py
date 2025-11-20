from fastapi import APIRouter

from .health import router as health


router = APIRouter(tags=["Info"], prefix="/info")
router.include_router(health)
