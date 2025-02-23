from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from src.models import User
from src.utils.auth import verify_credentials, get_db
from src.services.agent import AgentService
from src.entities import BaseSetting
from src.utils.logger import logger

router = APIRouter(tags=["Settings"])

@router.get(
    "/settings",
    description="List all settings for an agent"
)
def list_settings(
    agent_id: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    return {
        "settings": service.list_agent_settings(agent_id)
    }

@router.post(
    "/settings",
    description="Create or update settings for an agent"
)
def create_or_update_settings(
    agent_id: str,
    body: BaseSetting,
    setting_key: Optional[str] = Query(None, description="Setting key, defaults to 'default'"),
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    return service.update_agent_settings(
        agent_id=agent_id,
        settings=body,
        setting_key=setting_key
    )

@router.get(
    "/settings/{key}",
    description="Get specific settings by key"
)
def get_settings(
    agent_id: str,
    key: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    setting = service.setting_repo.get_setting(agent_id=agent_id, key=key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found"
        )
    return {
        "key": setting.key,
        "settings": BaseSetting.model_validate_json(setting.value).model_dump()
    }

@router.delete(
    "/settings/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Delete specific settings by key"
)
def delete_settings(
    agent_id: str,
    key: str,
    user: User = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    service = AgentService(db=db, user_id=str(user.id))
    if service.setting_repo.delete(agent_id=agent_id, key=key):
        return None
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Settings not found"
    ) 