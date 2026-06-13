from fastapi import APIRouter

from src.config.branding import BRANDING, Branding

router = APIRouter(prefix="/config")


@router.get("/public", name="Public Branding Config", response_model=Branding)
async def get_public_config() -> Branding:
    """Public white-label branding + links (no secrets).

    Consumed by the frontend at boot to render the brand name, logo, and
    docs/console/contact links. All fields are non-sensitive and safe to
    expose unauthenticated.
    """
    return BRANDING
