from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, UUID4, Field

from src.utils.auth import verify_credentials, get_db

from src.repos.settings_repo import SettingsRepo
from src.models import User

TAG = "Settings"
router = APIRouter(tags=[TAG])

class SettingBase(BaseModel):
    name: str
    value: dict = Field(default={"system": "You are a helpful assistant.", "tools": ["search_engine"], "model": "openai-gpt-4o"})

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
    db: Session = Depends(get_db)
):
    """List all settings."""
    repo = SettingsRepo(db, user.id)
    return {"settings": repo.get_all()}

@router.get("/settings/{setting_id}", response_model=SingleSettingResponse)
async def get_setting(
    setting_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Get a specific setting by ID."""
    repo = SettingsRepo(db, user.id)
    setting = repo.get_by_id(setting_id)
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
    db: Session = Depends(get_db)
):
    """Get a specific setting by slug."""
    repo = SettingsRepo(db, user.id)
    setting = repo.get_by_slug(slug)
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
    db: Session = Depends(get_db)
):
    """Create a new setting."""
    repo = SettingsRepo(db, user.id)
    return {"setting": repo.create(name=setting.name, value=setting.value)}

@router.put("/settings/{setting_id}", response_model=SingleSettingResponse)
async def update_setting(
    setting_id: str,
    setting: SettingUpdate,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Update an existing setting."""
    repo = SettingsRepo(db, user.id)
    updated_setting = repo.update(setting_id, setting.model_dump(exclude_unset=True))
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
    db: Session = Depends(get_db)
):
    """Delete a setting."""
    repo = SettingsRepo(db, user.id)
    if not repo.delete(setting_id):
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
    db: Session = Depends(get_db)
):
    """Create or update a setting by slug."""
    repo = SettingsRepo(db, user.id)
    return {"setting": repo.upsert_by_slug(name=setting.name, value=setting.value)}
