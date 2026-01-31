from fastapi import APIRouter, Depends, HTTPException, status
from langgraph.store.base import BaseStore

from src.schemas.models import User
from src.schemas.entities.settings import (
    UserSettingsResponse,
    UpdateDefaultModelRequest,
    UpsertProviderKeyRequest,
)
from src.repos.user_settings_repo import UserSettingsRepo
from src.utils.auth import verify_credentials
from src.services.db import get_store

router = APIRouter(tags=["Settings"])


def _get_repo(user: User, store: BaseStore) -> UserSettingsRepo:
    return UserSettingsRepo(str(user.id), store)


@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    settings, statuses = await repo.get_settings()
    return UserSettingsResponse(
        default_model=settings.default_model,
        provider_keys=statuses,
    )


@router.put("/settings/default-model", response_model=UserSettingsResponse)
async def update_default_model(
    req: UpdateDefaultModelRequest,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    await repo.set_default_model(req.model)
    settings, statuses = await repo.get_settings()
    return UserSettingsResponse(
        default_model=settings.default_model,
        provider_keys=statuses,
    )


@router.put("/settings/provider-keys", response_model=UserSettingsResponse)
async def upsert_provider_key(
    req: UpsertProviderKeyRequest,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    try:
        await repo.upsert_provider_key(req.provider, req.api_key)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    settings, statuses = await repo.get_settings()
    return UserSettingsResponse(
        default_model=settings.default_model,
        provider_keys=statuses,
    )


@router.delete(
    "/settings/provider-keys/{provider}", response_model=UserSettingsResponse
)
async def delete_provider_key(
    provider: str,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    try:
        await repo.delete_provider_key(provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    settings, statuses = await repo.get_settings()
    return UserSettingsResponse(
        default_model=settings.default_model,
        provider_keys=statuses,
    )
