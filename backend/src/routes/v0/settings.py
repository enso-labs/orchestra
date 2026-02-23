from fastapi import APIRouter, Depends, HTTPException, status
from langgraph.store.base import BaseStore

from src.schemas.models import User
from src.schemas.entities.settings import (
    UserSettings,
    DefaultsResponse,
    UserSettingsResponse,
    PatchDefaultsRequest,
    UpsertProviderKeyRequest,
    ProviderKeyStatus,
)
from src.repos.user_settings_repo import UserSettingsRepo
from src.utils.auth import verify_credentials
from src.services.db import get_store

router = APIRouter(tags=["Settings"])


def _get_repo(user: User, store: BaseStore) -> UserSettingsRepo:
    return UserSettingsRepo(str(user.id), store)


def _build_response(settings: UserSettings, statuses: list[ProviderKeyStatus]) -> UserSettingsResponse:
    return UserSettingsResponse(
        defaults=DefaultsResponse(
            model=settings.default_model,
            sandbox=settings.default_sandbox,
            tools=settings.default_tools,
            mcp=settings.default_mcp,
            a2a=settings.default_a2a,
            subagents=settings.default_subagents,
            model_visibility=settings.default_model_visibility,
        ),
        provider_keys=statuses,
    )


@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    settings, statuses = await repo.get_settings()
    return _build_response(settings, statuses)


@router.patch("/settings/default", response_model=UserSettingsResponse)
async def patch_defaults(
    req: PatchDefaultsRequest,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    repo = _get_repo(user, store)
    data = req.model_dump(exclude_unset=True)
    try:
        await repo.patch_defaults(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    settings, statuses = await repo.get_settings()
    return _build_response(settings, statuses)


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
    return _build_response(settings, statuses)


@router.delete("/settings/provider-keys/{provider}", response_model=UserSettingsResponse)
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
    return _build_response(settings, statuses)
