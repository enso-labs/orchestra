from typing import Optional

from langgraph.store.base import BaseStore

from src.repos.base_repo import BaseRepo
from src.schemas.entities.heartbeat import HeartbeatConfig, HeartbeatState, HeartbeatHistory, HeartbeatTickResult


class HeartbeatConfigRepo(BaseRepo):
    """Repository for heartbeat configuration. One config per user, stored under key 'config'."""

    _KEY = "config"

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_config")

    async def get(self) -> Optional[HeartbeatConfig]:
        item = await self._get(self._KEY)
        if item is None:
            return None
        return HeartbeatConfig.model_validate(item.value)

    async def save(self, config: HeartbeatConfig) -> bool:
        return await self._set(self._KEY, config)

    async def delete(self) -> bool:
        return await self._delete(self._KEY)


class HeartbeatStateRepo(BaseRepo):
    """Repository for heartbeat runtime state. Returns empty state if none exists."""

    _KEY = "state"

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_state")

    async def get(self) -> HeartbeatState:
        item = await self._get(self._KEY)
        if item is None:
            return HeartbeatState()
        return HeartbeatState.model_validate(item.value)

    async def save(self, state: HeartbeatState) -> bool:
        return await self._set(self._KEY, state)


class HeartbeatHistoryRepo(BaseRepo):
    """Repository for heartbeat tick history. Stores escalation results, trimmed to max_entries."""

    _KEY = "history"

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_history")

    async def get(self) -> HeartbeatHistory:
        item = await self._get(self._KEY)
        if item is None:
            return HeartbeatHistory()
        return HeartbeatHistory.model_validate(item.value)

    async def append(self, result: HeartbeatTickResult) -> bool:
        history = await self.get()
        history.results.insert(0, result)
        history.results = history.results[: history.max_entries]
        return await self._set(self._KEY, history)
