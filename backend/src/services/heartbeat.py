import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4
from zoneinfo import ZoneInfo

from langgraph.store.base import BaseStore

from src.repos.heartbeat_repo import HeartbeatConfigRepo, HeartbeatStateRepo, HeartbeatHistoryRepo
from src.schemas.entities.heartbeat import (
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
)
from src.services.db import get_store_in_memory
from src.utils.logger import logger

HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK"
ESCALATION_COOLDOWN_SECONDS = 900  # 15 minutes


class HeartbeatService:
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        self.user_id = user_id
        self.store = store or get_store_in_memory()
        self.config_repo = HeartbeatConfigRepo(user_id=user_id, store=self.store)
        self.state_repo = HeartbeatStateRepo(user_id=user_id, store=self.store)
        self.history_repo = HeartbeatHistoryRepo(user_id=user_id, store=self.store)

    @staticmethod
    def _is_within_active_hours(config: HeartbeatConfig) -> bool:
        """Check if current time is within the configured active hours window, with timezone support."""
        tz = ZoneInfo(config.active_hours.timezone)
        now = datetime.now(tz)
        current_time = now.strftime("%H:%M")

        start = config.active_hours.start
        end = config.active_hours.end

        if start <= end:
            # Normal window: e.g., 09:00-22:00
            return start <= current_time <= end
        else:
            # Midnight wrapping: e.g., 22:00-06:00
            return current_time >= start or current_time <= end

    @staticmethod
    def _detect_heartbeat_ok(response: str, ack_max_chars: int) -> bool:
        """Return True if HEARTBEAT_OK appears at start or end and remaining content is within ack_max_chars."""
        stripped = response.strip()
        if stripped.startswith(HEARTBEAT_OK_TOKEN):
            remaining = stripped[len(HEARTBEAT_OK_TOKEN) :].strip()
            return len(remaining) <= ack_max_chars
        if stripped.endswith(HEARTBEAT_OK_TOKEN):
            remaining = stripped[: -len(HEARTBEAT_OK_TOKEN)].strip()
            return len(remaining) <= ack_max_chars
        return False

    async def tick(self) -> HeartbeatTickResult:
        """Execute a single heartbeat tick: check config, active hours, invoke agent, detect OK, record result."""
        start_time = time.time()
        now = datetime.now(timezone.utc)

        # 1. Load config (skip if None or disabled)
        config = await self.config_repo.get()
        if config is None or not config.enabled:
            return HeartbeatTickResult(
                action="skipped",
                reason="Heartbeat not configured or disabled",
                timestamp=now,
            )

        # 2. Check active hours (skip if outside)
        if not self._is_within_active_hours(config):
            return HeartbeatTickResult(
                action="skipped",
                reason="Outside active hours",
                timestamp=now,
            )

        # 3. Build prompt replacing {checklist}
        prompt = config.prompt.format(
            checklist=config.checklist,
            ack_max_chars=config.ack_max_chars,
        )

        # 4. Invoke agent via scheduled_llm_invoke() with cheapest model and source:'heartbeat' metadata
        try:
            response_text = await self._invoke_agent(config, prompt)
        except Exception as e:
            logger.error(f"Heartbeat tick agent invocation failed: {e}", exc_info=True)
            return HeartbeatTickResult(
                action="skipped",
                reason=f"Agent invocation failed: {e}",
                timestamp=now,
                duration_ms=int((time.time() - start_time) * 1000),
            )

        duration_ms = int((time.time() - start_time) * 1000)

        # 5. Detect HEARTBEAT_OK -> action 'ok' or 'escalated'
        is_ok = self._detect_heartbeat_ok(response_text, config.ack_max_chars)
        action = "ok" if is_ok else "escalated"
        reason = "All checks passed" if is_ok else "Agent flagged issues requiring attention"

        result = HeartbeatTickResult(
            action=action,
            reason=reason,
            response=response_text,
            duration_ms=duration_ms,
            timestamp=now,
        )

        # 6. On escalation create new chat thread
        if action == "escalated":
            await self._handle_escalation(result)

        # 7. Record state + history
        await self._record_result(config, result)

        return result

    async def _invoke_agent(self, config: HeartbeatConfig, prompt: str) -> str:
        """Invoke agent via scheduled_llm_invoke and return response text."""
        from src.services.schedule import scheduled_llm_invoke
        from src.schemas.entities.llm import LLMRequest, LLMInput
        from src.constants.llm import DEFAULT_CHAT_MODEL_BASIC

        thread_id = str(uuid4()) if config.isolated_session else f"heartbeat-{self.user_id}"

        llm_request = LLMRequest(
            input=LLMInput(messages=[LLMInput.ChatMessage(role="user", content=prompt)]),
            model=DEFAULT_CHAT_MODEL_BASIC,
            metadata={
                "user_id": self.user_id,
                "thread_id": thread_id,
                "assistant_id": config.assistant_id,
                "source": "heartbeat",
            },
        )

        response = await scheduled_llm_invoke(
            task_dict=llm_request.model_dump(),
            user_id=self.user_id,
            title=f"Heartbeat tick for {self.user_id}",
        )

        # Extract text from response
        if response and isinstance(response, dict):
            messages = response.get("messages", [])
            if messages:
                last_msg = messages[-1]
                if hasattr(last_msg, "content"):
                    return str(last_msg.content)
                elif isinstance(last_msg, dict):
                    return str(last_msg.get("content", ""))
        return str(response) if response else ""

    async def _handle_escalation(self, result: HeartbeatTickResult):
        """Create a new chat thread for escalation, with rate limiting."""
        state = await self.state_repo.get()

        # Rate limiting: if last escalation was < 15 minutes ago, skip thread creation
        if state.last_escalation_at:
            elapsed = (result.timestamp - state.last_escalation_at).total_seconds()
            if elapsed < ESCALATION_COOLDOWN_SECONDS:
                logger.info(
                    f"Heartbeat escalation rate-limited: last escalation {elapsed:.0f}s ago "
                    f"(cooldown: {ESCALATION_COOLDOWN_SECONDS}s)"
                )
                return

        # Create escalation thread
        try:
            from src.services.thread import ThreadService
            from src.schemas.entities.store import Thread

            thread_service = ThreadService(user_id=self.user_id, store=self.store)
            thread_id = str(uuid4())
            thread = Thread(
                id=thread_id,
                title=f"Heartbeat Escalation: {result.reason}",
                messages=[
                    {"role": "assistant", "content": result.response or result.reason},
                ],
                metadata={"source": "heartbeat", "escalation": True},
            )
            await thread_service.create(thread)
            logger.info(f"Heartbeat escalation thread created: {thread_id}")
        except Exception as e:
            logger.error(f"Failed to create escalation thread: {e}", exc_info=True)

    async def _record_result(self, config: HeartbeatConfig, result: HeartbeatTickResult):
        """Update state counters. Append to history only on escalation."""
        state = await self.state_repo.get()

        state.last_run_at = result.timestamp
        state.last_result = result.action
        state.total_ticks += 1
        state.next_due_at = result.timestamp + timedelta(seconds=config.every_seconds)

        if result.action == "ok":
            state.consecutive_ok_count += 1
        elif result.action == "escalated":
            state.consecutive_ok_count = 0
            state.total_escalations += 1
            state.last_escalation_at = result.timestamp
            # History stores escalations only
            await self.history_repo.append(result)

        await self.state_repo.save(state)

    # --- CRUD methods ---

    async def get_config(self) -> Optional[HeartbeatConfig]:
        return await self.config_repo.get()

    async def save_config(self, config: HeartbeatConfig) -> bool:
        return await self.config_repo.save(config)

    async def delete_config(self) -> bool:
        """Delete config, calling unregister() first."""
        await self.unregister()
        return await self.config_repo.delete()

    async def get_state(self) -> HeartbeatState:
        return await self.state_repo.get()

    async def get_history(self, limit: int = 20) -> list[HeartbeatTickResult]:
        history = await self.history_repo.get()
        return history.results[:limit]

    # --- Registration stubs (implemented in US-009) ---

    async def register(self) -> Optional[str]:
        """Register heartbeat with TaskIQ scheduler. Implemented in US-009."""
        return None

    async def unregister(self) -> bool:
        """Unregister heartbeat from TaskIQ scheduler. Implemented in US-009."""
        return False
