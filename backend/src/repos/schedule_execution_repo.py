from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.schemas.models.schedule_execution import ScheduleExecution


class ScheduleExecutionRepo:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def create(
        self,
        schedule_id: str,
        scheduled_time: datetime,
        status: str = "scheduled",
        thread_id: str | None = None,
        metadata: dict | None = None,
    ) -> ScheduleExecution:
        execution = ScheduleExecution(
            id=uuid4(),
            schedule_id=schedule_id,
            user_id=self.user_id,
            thread_id=thread_id,
            status=status,
            scheduled_time=scheduled_time,
            metadata_=metadata or {},
        )
        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)
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
        result = await self.db.execute(select(ScheduleExecution).filter(ScheduleExecution.id == execution_id))
        execution = result.scalar_one_or_none()
        if not execution:
            return None

        execution.status = status
        if started_at is not None:
            execution.started_at = started_at
        if completed_at is not None:
            execution.completed_at = completed_at
        if duration_ms is not None:
            execution.duration_ms = duration_ms
        if thread_id is not None:
            execution.thread_id = thread_id
        if error_message is not None:
            execution.error_message = error_message
        if metadata is not None:
            execution.metadata_ = metadata

        await self.db.commit()
        await self.db.refresh(execution)
        return execution

    async def get_by_schedule(self, schedule_id: str, limit: int = 50) -> list[ScheduleExecution]:
        result = await self.db.execute(
            select(ScheduleExecution)
            .filter(
                ScheduleExecution.schedule_id == schedule_id,
                ScheduleExecution.user_id == self.user_id,
            )
            .order_by(desc(ScheduleExecution.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_recent(self, limit: int = 20) -> list[ScheduleExecution]:
        result = await self.db.execute(
            select(ScheduleExecution)
            .filter(ScheduleExecution.user_id == self.user_id)
            .order_by(desc(ScheduleExecution.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_date_range(self, start_date: datetime, end_date: datetime) -> list[ScheduleExecution]:
        result = await self.db.execute(
            select(ScheduleExecution)
            .filter(
                ScheduleExecution.user_id == self.user_id,
                ScheduleExecution.created_at >= start_date,
                ScheduleExecution.created_at <= end_date,
            )
            .order_by(desc(ScheduleExecution.created_at))
        )
        return list(result.scalars().all())

    async def count_by_status(self, schedule_id: str, status: str) -> int:
        result = await self.db.execute(
            select(ScheduleExecution).filter(
                ScheduleExecution.schedule_id == schedule_id,
                ScheduleExecution.user_id == self.user_id,
                ScheduleExecution.status == status,
            )
        )
        return len(list(result.scalars().all()))
