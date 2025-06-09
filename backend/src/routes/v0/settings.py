from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel, UUID4, Field
from src.utils.logger import logger

from src.utils.auth import verify_credentials
from src.services.db import get_async_db

from src.repos.settings_repo import SettingsRepo
from src.schemas.models import User

TAG = "Settings"
router = APIRouter(tags=[TAG])

DEFAULT_SETTING_VALUE = {
    "system": "You are a helpful assistant.",
    "model": "openai-gpt-4o-mini",
    "tools": ["search_engine"],
    "indexes": [],
}

class SettingBase(BaseModel):
    name: str
    value: dict = Field(default=DEFAULT_SETTING_VALUE)

class SettingCreate(SettingBase):
    pass

class SettingUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[dict] = None

class SettingResponse(SettingBase):
    id: UUID4
    slug: str
    
    class Config:
        from_attributes = True

class SettingsListResponse(BaseModel):
    settings: List[SettingResponse]

class SingleSettingResponse(BaseModel):
    setting: SettingResponse

@router.get("/settings", response_model=SettingsListResponse)
async def list_settings(
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """List all settings."""
    repo = SettingsRepo(db, user.id)
    return {"settings": await repo.get_all()}

@router.get("/settings/{setting_id}", response_model=SingleSettingResponse)
async def get_setting(
    setting_id: str,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Get a specific setting by ID."""
    repo = SettingsRepo(db, user.id)
    setting = await repo.get_by_id(setting_id)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return {"setting": setting}

@router.get("/settings/slug/{slug}", response_model=SingleSettingResponse)
async def get_setting_by_slug(
    slug: str,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Get a specific setting by slug."""
    repo = SettingsRepo(db, user.id)
    setting = await repo.get_by_slug(slug)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return {"setting": setting}

@router.post("/settings", response_model=SingleSettingResponse, status_code=status.HTTP_201_CREATED)
async def create_setting(
    setting: SettingCreate,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Create a new setting."""
    try:
        repo = SettingsRepo(db, user.id)
        return {"setting": await repo.create(name=setting.name, value=setting.value)}
    except Exception as e:
        if "UniqueViolation" in str(e) and "uq_settings_slug" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A setting with this name already exists"
            )
        logger.error(f"Error creating setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/settings/{setting_id}", response_model=SingleSettingResponse)
async def update_setting(
    setting_id: str,
    setting: SettingUpdate,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Update an existing setting."""
    repo = SettingsRepo(db, user.id)
    updated_setting = await repo.update(setting_id, setting.model_dump(exclude_unset=True))
    if not updated_setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return {"setting": updated_setting}

@router.delete("/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    setting_id: str,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Delete a setting."""
    repo = SettingsRepo(db, user.id)
    if not await repo.delete(setting_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return None

@router.put("/settings/slug/{slug}", response_model=SingleSettingResponse)
async def upsert_setting_by_slug(
    slug: str,
    setting: SettingCreate,
    user: User = Depends(verify_credentials),
    db: AsyncSession = Depends(get_async_db)
):
    """Create or update a setting by slug."""
    repo = SettingsRepo(db, user.id)
    return {"setting": await repo.upsert_by_slug(name=setting.name, value=setting.value)}
