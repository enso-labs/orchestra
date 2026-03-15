"""Unit tests for HeartbeatService."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from src.schemas.entities.heartbeat import (
    ActiveHours,
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
)
from src.services.heartbeat import HeartbeatService


# --- Helpers ---

USER_ID = "test-user-1"
ASSISTANT_ID = "assistant-1"


def _make_config(**overrides) -> HeartbeatConfig:
    defaults = {
        "user_id": USER_ID,
        "assistant_id": ASSISTANT_ID,
        "enabled": True,
        "checklist": "- [ ] Check inbox\n- [ ] Review alerts",
        "every_seconds": 3600,
        "active_hours": ActiveHours(start="00:00", end="23:59", timezone="UTC"),
    }
    defaults.update(overrides)
    return HeartbeatConfig(**defaults)


def _make_state(**overrides) -> HeartbeatState:
    return HeartbeatState(**overrides)


# --- TestHeartbeatOkDetection ---


class TestHeartbeatOkDetection:
    """Test _detect_heartbeat_ok static method."""

    def test_detects_ok_at_start(self):
        response = "HEARTBEAT_OK All systems nominal."
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is True

    def test_detects_ok_at_end(self):
        response = "Everything looks good. HEARTBEAT_OK"
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is True

    def test_rejects_content_beyond_ack_max_chars(self):
        long_content = "A" * 301
        response = f"HEARTBEAT_OK {long_content}"
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is False

    def test_rejects_missing_token(self):
        response = "Everything looks good, no issues found."
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is False

    def test_handles_whitespace_padding(self):
        response = "   HEARTBEAT_OK   Brief status.   "
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is True

    def test_ok_only_no_extra_content(self):
        response = "HEARTBEAT_OK"
        assert HeartbeatService._detect_heartbeat_ok(response, ack_max_chars=300) is True


# --- TestActiveHours ---


class TestActiveHours:
    """Test _is_within_active_hours static method."""

    @patch("src.services.heartbeat.datetime")
    def test_within_window_returns_true(self, mock_datetime):
        """10:30 is within 09:00-22:00."""
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("UTC")
        mock_now = datetime(2026, 3, 15, 10, 30, tzinfo=tz)
        mock_datetime.now.return_value = mock_now
        mock_datetime.side_effect = lambda *a, **kw: datetime(*a, **kw)

        config = _make_config(active_hours=ActiveHours(start="09:00", end="22:00", timezone="UTC"))
        assert HeartbeatService._is_within_active_hours(config) is True

    @patch("src.services.heartbeat.datetime")
    def test_outside_window_returns_false(self, mock_datetime):
        """05:00 is outside 09:00-22:00."""
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("UTC")
        mock_now = datetime(2026, 3, 15, 5, 0, tzinfo=tz)
        mock_datetime.now.return_value = mock_now
        mock_datetime.side_effect = lambda *a, **kw: datetime(*a, **kw)

        config = _make_config(active_hours=ActiveHours(start="09:00", end="22:00", timezone="UTC"))
        assert HeartbeatService._is_within_active_hours(config) is False

    @patch("src.services.heartbeat.datetime")
    def test_midnight_wrapping_within(self, mock_datetime):
        """23:00 is within 22:00-06:00 (midnight wrap)."""
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("UTC")
        mock_now = datetime(2026, 3, 15, 23, 0, tzinfo=tz)
        mock_datetime.now.return_value = mock_now
        mock_datetime.side_effect = lambda *a, **kw: datetime(*a, **kw)

        config = _make_config(active_hours=ActiveHours(start="22:00", end="06:00", timezone="UTC"))
        assert HeartbeatService._is_within_active_hours(config) is True

    @patch("src.services.heartbeat.datetime")
    def test_midnight_wrapping_outside(self, mock_datetime):
        """12:00 is outside 22:00-06:00 (midnight wrap)."""
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("UTC")
        mock_now = datetime(2026, 3, 15, 12, 0, tzinfo=tz)
        mock_datetime.now.return_value = mock_now
        mock_datetime.side_effect = lambda *a, **kw: datetime(*a, **kw)

        config = _make_config(active_hours=ActiveHours(start="22:00", end="06:00", timezone="UTC"))
        assert HeartbeatService._is_within_active_hours(config) is False


# --- TestTick ---


class TestTick:
    """Test tick() method."""

    @pytest.fixture
    def service(self):
        svc = HeartbeatService(user_id=USER_ID)
        svc.config_repo = AsyncMock()
        svc.state_repo = AsyncMock()
        svc.history_repo = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_skips_when_disabled(self, service):
        service.config_repo.get.return_value = _make_config(enabled=False)

        result = await service.tick()

        assert result.action == "skipped"
        assert "disabled" in result.reason.lower() or "not configured" in result.reason.lower()

    @pytest.mark.asyncio
    async def test_skips_when_no_config(self, service):
        service.config_repo.get.return_value = None

        result = await service.tick()

        assert result.action == "skipped"

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=False)
    async def test_skips_outside_hours(self, mock_hours, service):
        service.config_repo.get.return_value = _make_config()

        result = await service.tick()

        assert result.action == "skipped"
        assert "active hours" in result.reason.lower()

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    async def test_returns_ok_on_heartbeat_ok(self, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state()
        mock_invoke.return_value = "HEARTBEAT_OK Everything is fine."

        result = await service.tick()

        assert result.action == "ok"
        assert result.response == "HEARTBEAT_OK Everything is fine."

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    @patch.object(HeartbeatService, "_handle_escalation", new_callable=AsyncMock)
    async def test_returns_escalated_without_token(self, mock_escalation, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state()
        mock_invoke.return_value = "Alert: inbox has 50 unread messages requiring attention."

        result = await service.tick()

        assert result.action == "escalated"
        mock_escalation.assert_called_once()

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    @patch.object(HeartbeatService, "_handle_escalation", new_callable=AsyncMock)
    async def test_creates_new_chat_thread_on_escalation(self, mock_escalation, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state()
        mock_invoke.return_value = "Critical issue found in monitoring dashboard."

        await service.tick()

        mock_escalation.assert_called_once()
        call_args = mock_escalation.call_args[0][0]
        assert call_args.action == "escalated"

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    async def test_updates_state_correctly_on_ok(self, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state(consecutive_ok_count=3, total_ticks=5)
        mock_invoke.return_value = "HEARTBEAT_OK"

        await service.tick()

        # State should have been saved with updated values
        saved_state = service.state_repo.save.call_args[0][0]
        assert saved_state.consecutive_ok_count == 4
        assert saved_state.total_ticks == 6

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    @patch.object(HeartbeatService, "_handle_escalation", new_callable=AsyncMock)
    async def test_resets_consecutive_ok_on_escalation(self, mock_escalation, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state(consecutive_ok_count=5, total_ticks=10)
        mock_invoke.return_value = "Issue detected in system."

        await service.tick()

        saved_state = service.state_repo.save.call_args[0][0]
        assert saved_state.consecutive_ok_count == 0
        assert saved_state.total_escalations == 1

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    @patch.object(HeartbeatService, "_handle_escalation", new_callable=AsyncMock)
    async def test_appends_to_history_only_on_escalation(self, mock_escalation, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state()
        mock_invoke.return_value = "Issue found."

        await service.tick()

        service.history_repo.append.assert_called_once()

    @pytest.mark.asyncio
    @patch.object(HeartbeatService, "_is_within_active_hours", return_value=True)
    @patch.object(HeartbeatService, "_invoke_agent", new_callable=AsyncMock)
    async def test_does_not_append_history_on_ok(self, mock_invoke, mock_hours, service):
        service.config_repo.get.return_value = _make_config()
        service.state_repo.get.return_value = _make_state()
        mock_invoke.return_value = "HEARTBEAT_OK All clear."

        await service.tick()

        service.history_repo.append.assert_not_called()


# --- TestEscalationRateLimiting ---


class TestEscalationRateLimiting:
    """Test escalation rate limiting behavior."""

    @pytest.fixture
    def service(self):
        svc = HeartbeatService(user_id=USER_ID)
        svc.config_repo = AsyncMock()
        svc.state_repo = AsyncMock()
        svc.history_repo = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_rate_limits_escalation_within_cooldown(self, service):
        """If last escalation was < 15 minutes ago, skip thread creation."""
        now = datetime.now(timezone.utc)
        recent_escalation = now - timedelta(minutes=5)

        service.state_repo.get.return_value = _make_state(last_escalation_at=recent_escalation)

        result = HeartbeatTickResult(
            action="escalated",
            reason="Issue found",
            response="Alert",
            timestamp=now,
        )

        with patch("src.services.thread.ThreadService") as mock_ts:
            await service._handle_escalation(result)
            mock_ts.assert_not_called()

    @pytest.mark.asyncio
    async def test_allows_escalation_after_cooldown(self, service):
        """If last escalation was > 15 minutes ago, create thread."""
        now = datetime.now(timezone.utc)
        old_escalation = now - timedelta(minutes=20)

        service.state_repo.get.return_value = _make_state(last_escalation_at=old_escalation)

        result = HeartbeatTickResult(
            action="escalated",
            reason="Issue found",
            response="Alert details",
            timestamp=now,
        )

        with (
            patch("src.services.thread.ThreadService") as mock_ts_class,
            patch("src.schemas.entities.store.Thread"),
        ):
            mock_instance = AsyncMock()
            mock_ts_class.return_value = mock_instance

            await service._handle_escalation(result)

            mock_instance.create.assert_called_once()


# --- TestRegistration ---


class TestRegistration:
    """Test register/unregister methods."""

    @pytest.fixture
    def service(self):
        svc = HeartbeatService(user_id=USER_ID)
        svc.config_repo = AsyncMock()
        svc.state_repo = AsyncMock()
        svc.history_repo = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_register_creates_schedule_and_stores_id(self, service):
        config = _make_config(every_seconds=1800)
        service.config_repo.get.return_value = config

        with (
            patch("taskiq.ScheduledTask") as mock_st,
            patch("taskiq_redis.ListRedisScheduleSource") as mock_source_class,
        ):
            mock_task = MagicMock()
            mock_task.schedule_id = "sched-123"
            mock_st.return_value = mock_task

            mock_source = AsyncMock()
            mock_source_class.return_value = mock_source

            result = await service.register()

            assert result == "sched-123"
            mock_source.add_schedule.assert_called_once_with(mock_task)
            assert config.schedule_id == "sched-123"
            service.config_repo.save.assert_called_once_with(config)

    @pytest.mark.asyncio
    async def test_register_returns_none_when_no_config(self, service):
        service.config_repo.get.return_value = None

        result = await service.register()

        assert result is None

    @pytest.mark.asyncio
    async def test_unregister_removes_schedule_and_clears_id(self, service):
        config = _make_config(schedule_id="sched-456")
        service.config_repo.get.return_value = config

        with patch("taskiq_redis.ListRedisScheduleSource") as mock_source_class:
            mock_source = AsyncMock()
            mock_source_class.return_value = mock_source

            result = await service.unregister()

            assert result is True
            mock_source.delete_schedule.assert_called_once_with("sched-456")
            assert config.schedule_id is None
            service.config_repo.save.assert_called_once_with(config)

    @pytest.mark.asyncio
    async def test_unregister_returns_false_when_no_schedule_id(self, service):
        config = _make_config(schedule_id=None)
        service.config_repo.get.return_value = config

        result = await service.unregister()

        assert result is False
