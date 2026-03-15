from typing import Optional

from fastapi import APIRouter, Depends, Response
from langgraph.store.base import BaseStore
from pydantic import BaseModel, Field

from src.schemas.entities.heartbeat import ActiveHours
from src.schemas.models import User
from src.services.heartbeat import HeartbeatService
from src.utils.auth import verify_credentials
from src.services.db import get_store

router = APIRouter(tags=["Heartbeat"])


class HeartbeatConfigRequest(BaseModel):
    assistant_id: str
    enabled: bool = False
    checklist: str = ""
    every_seconds: int = Field(default=3600, ge=300, le=86400)
    active_hours: ActiveHours = Field(default_factory=ActiveHours)
    isolated_session: bool = True
    light_context: bool = True
    ack_max_chars: int = 300
    prompt: Optional[str] = None


def _get_service(user: User, store: BaseStore) -> HeartbeatService:
    return HeartbeatService(user_id=str(user.id), store=store)


@router.get("/heartbeat", operation_id="ruska_get_heartbeat", tags=["mcp"])
async def get_heartbeat(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    service = _get_service(user, store)
    config = await service.get_config()
    if config is None:
        return {}
    return config.model_dump(mode="json")


@router.put("/heartbeat", operation_id="ruska_upsert_heartbeat", tags=["mcp"])
async def upsert_heartbeat(
    req: HeartbeatConfigRequest,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    from src.schemas.entities.heartbeat import HeartbeatConfig, DEFAULT_HEARTBEAT_PROMPT

    service = _get_service(user, store)

    existing = await service.get_config()
    config = HeartbeatConfig(
        user_id=str(user.id),
        assistant_id=req.assistant_id,
        enabled=req.enabled,
        checklist=req.checklist,
        every_seconds=req.every_seconds,
        active_hours=req.active_hours,
        isolated_session=req.isolated_session,
        light_context=req.light_context,
        ack_max_chars=req.ack_max_chars,
        prompt=req.prompt or DEFAULT_HEARTBEAT_PROMPT,
        schedule_id=existing.schedule_id if existing else None,
    )

    await service.save_config(config)

    if req.enabled:
        await service.unregister()
        await service.register()
    else:
        await service.unregister()

    return config.model_dump(mode="json")


@router.delete("/heartbeat", status_code=204, operation_id="ruska_delete_heartbeat", tags=["mcp"])
async def delete_heartbeat(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    service = _get_service(user, store)
    await service.delete_config()
    return Response(status_code=204)


@router.get("/heartbeat/state", operation_id="ruska_get_heartbeat_state", tags=["mcp"])
async def get_heartbeat_state(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    service = _get_service(user, store)
    state = await service.get_state()
    return state.model_dump(mode="json")


@router.post("/heartbeat/tick", operation_id="ruska_trigger_heartbeat_tick", tags=["mcp"])
async def trigger_heartbeat_tick(
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    service = _get_service(user, store)
    result = await service.tick()
    return result.model_dump(mode="json")


@router.get("/heartbeat/history", operation_id="ruska_get_heartbeat_history", tags=["mcp"])
async def get_heartbeat_history(
    limit: int = 20,
    user: User = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
):
    service = _get_service(user, store)
    results = await service.get_history(limit=limit)
    return [r.model_dump(mode="json") for r in results]
