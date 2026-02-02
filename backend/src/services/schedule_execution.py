import uuid
from datetime import datetime

from sqlalchemy import select

from src.schemas.models.schedule_execution import ScheduleExecution
from src.services.db import AsyncSessionLocal


class ScheduleExecutionService:
    async def create_execution(
        self,
        schedule_id: str,
        user_id: str,
        scheduled_time: datetime,
    ) -> ScheduleExecution:
        async with AsyncSessionLocal() as session:
            execution = ScheduleExecution(
                id=uuid.uuid4(),
                schedule_id=schedule_id,
                user_id=user_id,
                scheduled_time=scheduled_time,
                status="scheduled",
            )
            session.add(execution)
            await session.commit()
            await session.refresh(execution)
            return execution

    async def update_execution(
        self,
        execution_id: uuid.UUID,
        status: str,
        thread_id: str | None = None,
        error_message: str | None = None,
        completed_at: datetime | None = None,
        started_at: datetime | None = None,
    ) -> ScheduleExecution | None:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ScheduleExecution).where(ScheduleExecution.id == execution_id)
            )
            execution = result.scalar_one_or_none()
            if execution is None:
                return None
            execution.status = status
            if thread_id is not None:
                execution.thread_id = thread_id
            if error_message is not None:
                execution.error_message = error_message
            if completed_at is not None:
                execution.completed_at = completed_at
            if started_at is not None:
                execution.started_at = started_at
            await session.commit()
            await session.refresh(execution)
            return execution

    async def get_recent_executions(
        self,
        user_id: str,
        limit: int = 20,
    ) -> list[ScheduleExecution]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ScheduleExecution)
                .where(ScheduleExecution.user_id == user_id)
                .order_by(ScheduleExecution.scheduled_time.desc())
                .limit(limit)
            )
            return list(result.scalars().all())

    async def get_executions_by_schedule(
        self,
        schedule_id: str,
        user_id: str,
    ) -> list[ScheduleExecution]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ScheduleExecution)
                .where(
                    ScheduleExecution.schedule_id == schedule_id,
                    ScheduleExecution.user_id == user_id,
                )
                .order_by(ScheduleExecution.scheduled_time.desc())
            )
            return list(result.scalars().all())

    async def get_executions_by_date_range(
        self,
        user_id: str,
        start: datetime,
        end: datetime,
    ) -> list[ScheduleExecution]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ScheduleExecution)
                .where(
                    ScheduleExecution.user_id == user_id,
                    ScheduleExecution.scheduled_time >= start,
                    ScheduleExecution.scheduled_time <= end,
                )
                .order_by(ScheduleExecution.scheduled_time.desc())
            )
            return list(result.scalars().all())


schedule_execution_service = ScheduleExecutionService()
