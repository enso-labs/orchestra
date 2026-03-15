"""Unit tests for heartbeat chat tools (configure, status, disable)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.runnables import RunnableConfig

from src.tools.heartbeat import configure_heartbeat, get_heartbeat_status, disable_heartbeat
from src.schemas.entities.heartbeat import (
    ActiveHours,
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
)


def _make_config(user_id="user-1", assistant_id="asst-1") -> RunnableConfig:
    return RunnableConfig(configurable={"user_id": user_id, "assistant_id": assistant_id, "model": "gpt-4o"})


def _make_hb_config(**overrides) -> HeartbeatConfig:
    defaults = {
        "user_id": "user-1",
        "assistant_id": "asst-1",
        "enabled": True,
        "checklist": "- [ ] Check inbox",
        "every_seconds": 3600,
        "active_hours": ActiveHours(start="09:00", end="18:00"),
        "schedule_id": "sched-1",
    }
    defaults.update(overrides)
    return HeartbeatConfig(**defaults)


class TestConfigureHeartbeat:
    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_creates_config_and_registers(self, mock_svc_class):
        mock_svc = AsyncMock()
        mock_svc.register.return_value = "sched-abc"
        mock_svc_class.return_value = mock_svc

        result = await configure_heartbeat.ainvoke(
            {
                "checklist": "- [ ] Check inbox\n- [ ] Review alerts",
                "every_hours": 1.0,
                "active_hours_start": "09:00",
                "active_hours_end": "18:00",
            },
            config=_make_config(),
        )

        assert "Heartbeat configured successfully!" in result
        assert "every 1.0h" in result
        assert "sched-abc" in result
        mock_svc.save_config.assert_called_once()
        mock_svc.unregister.assert_called_once()
        mock_svc.register.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_returns_confirmation_with_details(self, mock_svc_class):
        mock_svc = AsyncMock()
        mock_svc.register.return_value = "sched-xyz"
        mock_svc_class.return_value = mock_svc

        result = await configure_heartbeat.ainvoke(
            {
                "checklist": "- [ ] Test item",
                "every_hours": 2.0,
                "active_hours_start": "08:00",
                "active_hours_end": "20:00",
            },
            config=_make_config(),
        )

        assert "08:00" in result
        assert "20:00" in result
        assert "7200s" in result


class TestGetHeartbeatStatus:
    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_returns_formatted_output_with_history(self, mock_svc_class):
        now = datetime.now(timezone.utc)
        mock_svc = AsyncMock()
        mock_svc.get_config.return_value = _make_hb_config()
        mock_svc.get_state.return_value = HeartbeatState(total_ticks=10, consecutive_ok_count=5, total_escalations=2)
        mock_svc.get_history.return_value = [
            HeartbeatTickResult(action="escalated", reason="Issue found", timestamp=now),
        ]
        mock_svc_class.return_value = mock_svc

        result = await get_heartbeat_status.ainvoke({}, config=_make_config())

        assert "Heartbeat Status" in result
        assert "Total Ticks: 10" in result
        assert "Consecutive OKs: 5" in result
        assert "escalated" in result.lower()

    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_returns_no_config_message(self, mock_svc_class):
        mock_svc = AsyncMock()
        mock_svc.get_config.return_value = None
        mock_svc_class.return_value = mock_svc

        result = await get_heartbeat_status.ainvoke({}, config=_make_config())

        assert "No heartbeat configured" in result


class TestDisableHeartbeat:
    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_removes_config_and_returns_confirmation(self, mock_svc_class):
        mock_svc = AsyncMock()
        mock_svc.get_config.return_value = _make_hb_config()
        mock_svc.delete_config.return_value = True
        mock_svc_class.return_value = mock_svc

        result = await disable_heartbeat.ainvoke({}, config=_make_config())

        assert "disabled" in result.lower()
        mock_svc.delete_config.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.tools.heartbeat.HeartbeatService")
    async def test_returns_nothing_to_disable_message(self, mock_svc_class):
        mock_svc = AsyncMock()
        mock_svc.get_config.return_value = None
        mock_svc_class.return_value = mock_svc

        result = await disable_heartbeat.ainvoke({}, config=_make_config())

        assert "nothing to disable" in result.lower()
