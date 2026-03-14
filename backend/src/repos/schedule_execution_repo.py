from datetime import datetime
from typing import Optional
from uuid import uuid4

from langgraph.store.base import BaseStore, SearchItem

from src.repos.base_repo import BaseRepo
from src.services.db import get_store_in_memory
from src.schemas.entities.schedule_execution import ScheduleExecution
from src.schemas.entities import SearchFilter


class ScheduleExecutionRepo(BaseRepo):
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        store = store or get_store_in_memory()
        super().__init__(user_id=user_id, store=store, entity_type="schedule_executions")

    def _format(self, item: SearchItem) -> ScheduleExecution:
        return ScheduleExecution.model_validate(item.value)

    async def create(
        self,
        schedule_id: str,
        scheduled_time: datetime,
        status: str = "scheduled",
        thread_id: str | None = None,
        metadata: dict | None = None,
    ) -> ScheduleExecution:
        now = datetime.now()
        execution_id = str(uuid4())
        execution = ScheduleExecution(
            id=execution_id,
            schedule_id=schedule_id,
            thread_id=thread_id,
            status=status,
            scheduled_time=scheduled_time,
            started_at=now if status == "running" else None,
            metadata=metadata or {},
            created_at=now,
            updated_at=now,
        )
        await self._set(key=execution_id, value=execution)
        return execution

    async def update_status(
        self,
        execution_id: str,
        status: str,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        duration_ms: int | None = None,
        thread_id: str | None = None,
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> Optional[ScheduleExecution]:
        item = await self._get(execution_id)
        if not item:
            return None

        existing = ScheduleExecution.model_validate(item.value)
        updated = ScheduleExecution(
            id=existing.id,
            schedule_id=existing.schedule_id,
            thread_id=thread_id if thread_id is not None else existing.thread_id,
            status=status,
            scheduled_time=existing.scheduled_time,
            started_at=started_at if started_at is not None else existing.started_at,
            completed_at=completed_at if completed_at is not None else existing.completed_at,
            duration_ms=duration_ms if duration_ms is not None else existing.duration_ms,
            error_message=error_message if error_message is not None else existing.error_message,
            metadata=metadata if metadata is not None else existing.metadata,
            created_at=existing.created_at,
            updated_at=datetime.now(),
        )
        await self._set(key=execution_id, value=updated)
        return updated

    async def get_by_schedule(self, schedule_id: str, limit: int = 50) -> list[ScheduleExecution]:
        search_filter = SearchFilter(
            filter={"schedule_id": schedule_id},
            limit=limit,
        )
        items: list[SearchItem] = await self._search(search_filter)
        executions = [self._format(item) for item in items]
        executions.sort(key=lambda e: e.created_at or datetime.min, reverse=True)
        return executions

    async def get_recent(self, limit: int = 20) -> list[ScheduleExecution]:
        search_filter = SearchFilter(limit=limit)
        items: list[SearchItem] = await self._search(search_filter)
        executions = [self._format(item) for item in items]
        executions.sort(key=lambda e: e.created_at or datetime.min, reverse=True)
        return executions

    async def get_by_date_range(
        self, start_date: datetime, end_date: datetime, limit: int = 200
    ) -> list[ScheduleExecution]:
        search_filter = SearchFilter(limit=limit)
        items: list[SearchItem] = await self._search(search_filter)
        executions = [self._format(item) for item in items]
        # Filter by date range in-memory (Store doesn't support date range queries natively)
        filtered = [e for e in executions if e.created_at and start_date <= e.created_at <= end_date]
        filtered.sort(key=lambda e: e.created_at or datetime.min, reverse=True)
        return filtered
