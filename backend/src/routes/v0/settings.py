from fastapi import APIRouter, Depends, HTTPException, status
from langgraph.store.base import BaseStore

from src.schemas.models import User
from src.schemas.entities.settings import (
    UserSettingsResponse,
    UpdateDefaultModelRequest,
    UpdateSandboxBackendRequest,
    UpsertProviderKeyRequest,
)
from src.repos.user_settings_repo import UserSettingsRepo
from src.utils.auth import verify_credentials
from src.services.db import get_store

router = APIRouter(tags=["Settings"])

_VALID_SANDBOX_BACKENDS = {"daytona"}


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
        sandbox_backend=settings.sandbox_backend,
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
        sandbox_backend=settings.sandbox_backend,
        provider_keys=statuses,
    )


@router.put("/settings/sandbox-backend", response_model=UserSettingsResponse)
async def update_sandbox_backend(
    req: UpdateSandboxBackendRequest,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> UserSettingsResponse:
    backend = req.sandbox_backend
    if backend is not None and backend not in _VALID_SANDBOX_BACKENDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid sandbox_backend '{backend}'. "
                "Must be one of: ['daytona'] or null"
            ),
        )

    repo = _get_repo(user, store)
    await repo.set_sandbox_backend(backend)
    settings, statuses = await repo.get_settings()
    return UserSettingsResponse(
        default_model=settings.default_model,
        sandbox_backend=settings.sandbox_backend,
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
        sandbox_backend=settings.sandbox_backend,
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
        sandbox_backend=settings.sandbox_backend,
        provider_keys=statuses,
    )
