"""Unit tests for schedule tools (create, list, delete)."""

from unittest.mock import MagicMock, patch
from typing import Optional

import pytest
from langchain_core.runnables import RunnableConfig
from fastapi import HTTPException

from src.tools.schedule import create_schedule, list_schedules, delete_schedule


def _make_config(
    user_id: Optional[str] = "user-1", assistant_id: str = "asst-1", model: str = "openai:gpt-4o"
) -> RunnableConfig:
    """Build a RunnableConfig with configurable fields."""
    return RunnableConfig(configurable={"user_id": user_id, "assistant_id": assistant_id, "model": model})


def _make_schedule(id="sched-1", title="Daily Check", cron="0 9 * * *", next_run="2026-03-16T09:00:00"):
    """Build a mock Schedule object."""
    s = MagicMock()
    s.id = id
    s.title = title
    s.trigger = MagicMock()
    s.trigger.expression = cron
    s.next_run_time = next_run
    return s


class TestCreateSchedule:
    """Tests for the create_schedule tool."""

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_successful_creation(self, mock_service):
        mock_schedule = _make_schedule()
        mock_service.create_job.return_value = mock_schedule

        result = await create_schedule.ainvoke(
            {"title": "Daily Check", "cron_expression": "0 9 * * *", "message": "Check weather"},
            config=_make_config(),
        )

        assert "Schedule created successfully!" in result
        assert "sched-1" in result
        assert "Daily Check" in result
        mock_service.create_job.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_returns_id_and_next_run(self, mock_service):
        mock_schedule = _make_schedule(id="abc-123", next_run="2026-04-01T12:00:00")
        mock_service.create_job.return_value = mock_schedule

        result = await create_schedule.ainvoke(
            {"title": "Test", "cron_expression": "0 12 * * *", "message": "hello"},
            config=_make_config(),
        )

        assert "abc-123" in result
        assert "2026-04-01T12:00:00" in result

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_rejects_missing_user_id(self, _mock_service):
        with pytest.raises(Exception, match="User ID is required"):
            await create_schedule.ainvoke(
                {"title": "Test", "cron_expression": "0 9 * * *", "message": "hello"},
                config=_make_config(user_id=None),
            )

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_uses_model_from_config(self, mock_service):
        mock_schedule = _make_schedule()
        mock_service.create_job.return_value = mock_schedule

        await create_schedule.ainvoke(
            {"title": "Test", "cron_expression": "0 9 * * *", "message": "hello"},
            config=_make_config(model="anthropic:claude-haiku-4-5-20251001"),
        )

        # Verify the ScheduleCreate passed to create_job used the config model
        call_args = mock_service.create_job.call_args
        schedule_create = call_args[0][0]
        assert schedule_create.task.model == "anthropic:claude-haiku-4-5-20251001"


class TestListSchedules:
    """Tests for the list_schedules tool."""

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_lists_user_schedules_formatted(self, mock_service):
        mock_service.get_jobs.return_value = [
            _make_schedule(id="s1", title="Morning Check", cron="0 9 * * *"),
            _make_schedule(id="s2", title="Evening Check", cron="0 18 * * *"),
        ]

        result = await list_schedules.ainvoke({}, config=_make_config())

        assert "Your Scheduled Tasks" in result
        assert "Morning Check" in result
        assert "Evening Check" in result
        assert "s1" in result
        assert "s2" in result

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_empty_message(self, mock_service):
        mock_service.get_jobs.return_value = []

        result = await list_schedules.ainvoke({}, config=_make_config())

        assert result == "You have no scheduled tasks."

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_user_isolation(self, mock_service):
        mock_service.get_jobs.return_value = []

        await list_schedules.ainvoke({}, config=_make_config(user_id="user-42"))

        assert mock_service.user_id == "user-42"


class TestDeleteSchedule:
    """Tests for the delete_schedule tool."""

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_deletes_by_id(self, mock_service):
        mock_service.delete_job.return_value = True

        result = await delete_schedule.ainvoke(
            {"schedule_id": "sched-99"},
            config=_make_config(),
        )

        assert "sched-99" in result
        assert "deleted successfully" in result
        mock_service.delete_job.assert_called_once_with("sched-99")

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_nonexistent_schedule_error(self, mock_service):
        mock_service.delete_job.side_effect = HTTPException(status_code=500, detail="Job not found")

        result = await delete_schedule.ainvoke(
            {"schedule_id": "nonexistent"},
            config=_make_config(),
        )

        assert "Could not delete" in result
        assert "Job not found" in result

    @pytest.mark.asyncio
    @patch("src.tools.schedule.schedule_service")
    async def test_cannot_delete_other_users_schedule(self, mock_service):
        mock_service.delete_job.side_effect = HTTPException(status_code=403, detail="Not authorized")

        result = await delete_schedule.ainvoke(
            {"schedule_id": "other-user-sched"},
            config=_make_config(),
        )

        assert "Could not delete" in result
        assert "Not authorized" in result
