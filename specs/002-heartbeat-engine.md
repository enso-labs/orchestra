# Spec 002: Heartbeat Engine (TaskIQ Scheduler)

## User Story

As a developer, I want the scheduling system to support heartbeat-style periodic awareness so agents only escalate to full LLM invocations when something needs attention — reducing cost and noise.

## Purpose

Core heartbeat engine using **TaskIQ Scheduler** with `ListRedisScheduleSource` for dynamic schedule management. Inspired by OpenClaw's HEARTBEAT.md pattern, adapted for Orchestra's LangGraph store and multi-tenant architecture.

## Problem Statement

Every scheduled job in Orchestra fires a full LLM invocation regardless of whether anything needs attention. A daily "check for urgent emails" job costs the same whether there are 50 urgent emails or zero. There's no lightweight "peek and decide" mechanism. The heartbeat pattern solves this: the agent reads a checklist, decides if action is needed, and only escalates when something requires attention.

Additionally, Orchestra uses two separate systems for scheduling (APScheduler for timing, TaskIQ for execution). The heartbeat engine introduces TaskIQ Scheduler to unify timing + execution for new features.

## Key Concepts (from OpenClaw)

| Concept | OpenClaw | Orchestra Adaptation |
|---------|----------|---------------------|
| **HEARTBEAT.md** | Markdown file on filesystem | Markdown stored in LangGraph store (multi-tenant) |
| **HEARTBEAT_OK** | Token at start/end of reply | Same — agent returns `HEARTBEAT_OK` when nothing needs attention |
| **ackMaxChars** | Default 300 chars | `HeartbeatConfig.ack_max_chars` (default 300) |
| **activeHours** | Time window control | `ActiveHours` schema with start/end/timezone |
| **isolatedSession** | Fresh session per run | Fresh thread per tick, no conversation history |
| **lightContext** | Only checklist in prompt | Only checklist + system prompt, no memory/tools |

## Technical Approach

### New File: `backend/src/schemas/entities/heartbeat.py`

Pydantic models for heartbeat configuration and state:

```python
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class ActiveHours(BaseModel):
    """Time window during which heartbeat ticks execute."""
    start: str = Field(default="09:00", description="Start time in HH:MM format")
    end: str = Field(default="22:00", description="End time in HH:MM format")
    timezone: str = Field(default="UTC", description="IANA timezone name")


class HeartbeatConfig(BaseModel):
    """User-scoped heartbeat configuration."""
    user_id: str
    assistant_id: str
    enabled: bool = Field(default=False)
    checklist: str = Field(
        default="# Heartbeat Checklist\n- Check for urgent items",
        description="Markdown checklist the agent reads each tick",
    )
    every_seconds: int = Field(
        default=3600,
        ge=300,       # minimum 5 minutes
        le=86400,     # maximum 24 hours
        description="Interval between heartbeat ticks in seconds",
    )
    active_hours: ActiveHours = Field(default_factory=ActiveHours)
    isolated_session: bool = Field(
        default=True,
        description="Use a fresh session per tick (no conversation history)",
    )
    light_context: bool = Field(
        default=True,
        description="Limit context to just the checklist (no memory/tools)",
    )
    ack_max_chars: int = Field(
        default=300,
        description="If HEARTBEAT_OK reply has <= this many extra chars, suppress it",
    )
    prompt: str = Field(
        default=(
            "You are performing a periodic heartbeat check. "
            "Review the checklist below and determine if any items need attention.\n\n"
            "If nothing needs attention, respond with HEARTBEAT_OK.\n"
            "If something needs attention, respond with details and recommended actions.\n\n"
            "Checklist:\n{checklist}"
        ),
        description="System prompt template. {checklist} is replaced with the checklist content.",
    )
    schedule_id: Optional[str] = Field(
        default=None,
        description="TaskIQ schedule ID for unregistration",
    )


class HeartbeatState(BaseModel):
    """Runtime state of a user's heartbeat."""
    last_run_at: Optional[datetime] = None
    last_result: Optional[str] = None  # "ok" | "escalated" | "skipped"
    consecutive_ok_count: int = Field(default=0)
    next_due_at: Optional[datetime] = None
    total_ticks: int = Field(default=0)
    total_escalations: int = Field(default=0)


class HeartbeatTickResult(BaseModel):
    """Result of a single heartbeat tick."""
    action: Literal["ok", "escalated", "skipped"]
    reason: str
    response: Optional[str] = None
    tokens_used: Optional[int] = None
    duration_ms: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HeartbeatHistory(BaseModel):
    """Collection of recent tick results."""
    results: list[HeartbeatTickResult] = Field(default_factory=list)
    max_entries: int = Field(default=100)
```

### New File: `backend/src/repos/heartbeat_repo.py`

Following `BaseRepo` pattern from `backend/src/repos/base_repo.py`:

```python
from src.repos.base_repo import BaseRepo
from src.schemas.entities.heartbeat import (
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatHistory,
    HeartbeatTickResult,
)
from langgraph.store.base import BaseStore


class HeartbeatConfigRepo(BaseRepo):
    """Stores heartbeat configuration per user."""

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_config")

    async def get(self) -> HeartbeatConfig | None:
        item = await self._get("config")
        if item:
            return HeartbeatConfig(**item.value)
        return None

    async def save(self, config: HeartbeatConfig) -> bool:
        return await self._set("config", config)

    async def delete(self) -> bool:
        return await self._delete("config")


class HeartbeatStateRepo(BaseRepo):
    """Stores heartbeat runtime state per user."""

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_state")

    async def get(self) -> HeartbeatState:
        item = await self._get("state")
        if item:
            return HeartbeatState(**item.value)
        return HeartbeatState()

    async def save(self, state: HeartbeatState) -> bool:
        return await self._set("state", state)


class HeartbeatHistoryRepo(BaseRepo):
    """Stores recent heartbeat tick results per user."""

    def __init__(self, user_id: str, store: BaseStore):
        super().__init__(user_id=user_id, store=store, entity_type="heartbeat_history")

    async def get(self) -> HeartbeatHistory:
        item = await self._get("history")
        if item:
            return HeartbeatHistory(**item.value)
        return HeartbeatHistory()

    async def append(self, result: HeartbeatTickResult) -> bool:
        history = await self.get()
        history.results.insert(0, result)
        # Trim to max entries
        history.results = history.results[: history.max_entries]
        return await self._set("history", history)
```

Namespace structure:
- Config: `(user_id, "heartbeat_config")` → key `"config"`
- State: `(user_id, "heartbeat_state")` → key `"state"`
- History: `(user_id, "heartbeat_history")` → key `"history"`

### New File: `backend/src/services/heartbeat.py`

Core heartbeat service:

```python
import time
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from langgraph.store.base import BaseStore

from src.repos.heartbeat_repo import (
    HeartbeatConfigRepo,
    HeartbeatStateRepo,
    HeartbeatHistoryRepo,
)
from src.schemas.entities.heartbeat import (
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
)
from src.common.store import get_store_in_memory

logger = logging.getLogger(__name__)

HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK"


class HeartbeatService:
    def __init__(self, user_id: str, store: BaseStore = None):
        self.user_id = user_id
        self.store = store or get_store_in_memory()
        self.config_repo = HeartbeatConfigRepo(user_id=user_id, store=self.store)
        self.state_repo = HeartbeatStateRepo(user_id=user_id, store=self.store)
        self.history_repo = HeartbeatHistoryRepo(user_id=user_id, store=self.store)

    async def get_config(self) -> HeartbeatConfig | None:
        return await self.config_repo.get()

    async def save_config(self, config: HeartbeatConfig) -> HeartbeatConfig:
        config.user_id = self.user_id
        await self.config_repo.save(config)
        return config

    async def delete_config(self) -> bool:
        await self.unregister()
        return await self.config_repo.delete()

    async def get_state(self) -> HeartbeatState:
        return await self.state_repo.get()

    async def get_history(self, limit: int = 20) -> list[HeartbeatTickResult]:
        history = await self.history_repo.get()
        return history.results[:limit]

    def _is_within_active_hours(self, config: HeartbeatConfig) -> bool:
        """Check if current time is within configured active hours."""
        tz = ZoneInfo(config.active_hours.timezone)
        now = datetime.now(tz)
        current_time = now.strftime("%H:%M")
        start = config.active_hours.start
        end = config.active_hours.end

        if start <= end:
            return start <= current_time <= end
        else:
            # Wraps midnight (e.g., 22:00 - 06:00)
            return current_time >= start or current_time <= end

    def _detect_heartbeat_ok(self, response: str, ack_max_chars: int) -> bool:
        """
        Detect HEARTBEAT_OK token in response.
        Returns True if the response indicates no action needed.
        Token must appear at start or end of response.
        Remaining content must be <= ack_max_chars.
        """
        stripped = response.strip()

        # Check if HEARTBEAT_OK appears at start or end
        if stripped.startswith(HEARTBEAT_OK_TOKEN):
            remaining = stripped[len(HEARTBEAT_OK_TOKEN):].strip()
        elif stripped.endswith(HEARTBEAT_OK_TOKEN):
            remaining = stripped[:-len(HEARTBEAT_OK_TOKEN)].strip()
        else:
            return False

        return len(remaining) <= ack_max_chars

    async def tick(self, config: HeartbeatConfig | None = None) -> HeartbeatTickResult:
        """
        Execute a single heartbeat tick.

        1. Check active hours — skip if outside window
        2. Read checklist from config
        3. Invoke agent with checklist prompt
        4. Detect HEARTBEAT_OK — suppress if nothing needs attention
        5. Record state and history
        """
        start_time = time.time()

        if config is None:
            config = await self.get_config()
        if config is None:
            return HeartbeatTickResult(
                action="skipped",
                reason="No heartbeat configuration found",
            )

        if not config.enabled:
            return HeartbeatTickResult(
                action="skipped",
                reason="Heartbeat is disabled",
            )

        # Check active hours
        if not self._is_within_active_hours(config):
            result = HeartbeatTickResult(
                action="skipped",
                reason=f"Outside active hours ({config.active_hours.start}-{config.active_hours.end} {config.active_hours.timezone})",
            )
            await self._record_result(result)
            return result

        # Build prompt with checklist
        prompt = config.prompt.replace("{checklist}", config.checklist)

        # Invoke agent (lightweight)
        try:
            response = await self._invoke_agent(config, prompt)
        except Exception as e:
            logger.error(f"Heartbeat tick failed for user {self.user_id}: {e}")
            result = HeartbeatTickResult(
                action="skipped",
                reason=f"Agent invocation failed: {str(e)}",
                duration_ms=int((time.time() - start_time) * 1000),
            )
            await self._record_result(result)
            return result

        # Detect HEARTBEAT_OK
        is_ok = self._detect_heartbeat_ok(response, config.ack_max_chars)
        duration_ms = int((time.time() - start_time) * 1000)

        if is_ok:
            result = HeartbeatTickResult(
                action="ok",
                reason="Agent reported HEARTBEAT_OK — nothing needs attention",
                duration_ms=duration_ms,
            )
        else:
            result = HeartbeatTickResult(
                action="escalated",
                reason="Agent detected items needing attention",
                response=response,
                duration_ms=duration_ms,
            )

        await self._record_result(result)
        return result

    async def _invoke_agent(self, config: HeartbeatConfig, prompt: str) -> str:
        """
        Invoke the agent with the heartbeat prompt.
        Uses isolated session + light context if configured.
        """
        from src.schemas.entities.llm import LLMRequest

        request = LLMRequest(
            input={"messages": [{"role": "user", "content": prompt}]},
            model="anthropic/claude-haiku-3-20250307",  # Use cheapest model for heartbeat
            system_prompt="You are a heartbeat monitor. Be concise.",
            metadata={
                "user_id": self.user_id,
                "assistant_id": config.assistant_id,
                "graph_id": "react",
                "source": "heartbeat",
            },
        )

        # Import here to avoid circular dependency
        from src.services.schedule import scheduled_llm_invoke

        response = await scheduled_llm_invoke(
            request.model_dump(),
            user_id=self.user_id,
            title="Heartbeat tick",
        )
        return response or ""

    async def _record_result(self, result: HeartbeatTickResult) -> None:
        """Update state and history after a tick."""
        state = await self.state_repo.get()
        state.last_run_at = result.timestamp
        state.last_result = result.action
        state.total_ticks += 1

        if result.action == "ok":
            state.consecutive_ok_count += 1
        elif result.action == "escalated":
            state.consecutive_ok_count = 0
            state.total_escalations += 1

        config = await self.get_config()
        if config:
            state.next_due_at = result.timestamp + timedelta(seconds=config.every_seconds)

        await self.state_repo.save(state)
        await self.history_repo.append(result)

    async def register(self) -> str | None:
        """
        Register heartbeat with TaskIQ Scheduler.
        Creates an interval-based schedule that fires run_heartbeat_tick.
        Returns schedule_id for later unregistration.
        """
        config = await self.get_config()
        if not config or not config.enabled:
            return None

        from src.workers.heartbeat import run_heartbeat_tick
        from src.workers.scheduler import redis_source

        schedule = await run_heartbeat_tick.schedule_by_interval(
            redis_source,
            seconds=config.every_seconds,
            user_id=self.user_id,
        )

        config.schedule_id = schedule.schedule_id
        await self.config_repo.save(config)

        logger.info(f"Registered heartbeat for user {self.user_id}, schedule_id={schedule.schedule_id}")
        return schedule.schedule_id

    async def unregister(self) -> bool:
        """Remove heartbeat from TaskIQ Scheduler."""
        config = await self.get_config()
        if not config or not config.schedule_id:
            return False

        from src.workers.scheduler import redis_source

        try:
            await redis_source.delete_schedule(config.schedule_id)
            config.schedule_id = None
            await self.config_repo.save(config)
            logger.info(f"Unregistered heartbeat for user {self.user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unregister heartbeat: {e}")
            return False
```

### New File: `backend/src/workers/heartbeat.py`

TaskIQ task for heartbeat execution:

```python
from src.workers.broker import broker


@broker.task(task_name="run_heartbeat_tick")
async def run_heartbeat_tick(user_id: str) -> dict:
    """
    TaskIQ task that executes a single heartbeat tick for a user.
    Called by the TaskIQ Scheduler at the configured interval.
    """
    from src.services.heartbeat import HeartbeatService
    from src.common.store import get_store

    store = get_store()
    service = HeartbeatService(user_id=user_id, store=store)
    result = await service.tick()

    return result.model_dump(mode="json")
```

### New File: `backend/src/workers/scheduler.py`

TaskIQ Scheduler setup:

```python
from taskiq import TaskiqScheduler
from taskiq_redis import ListRedisScheduleSource
from src.constants.redis import REDIS_URL

redis_source = ListRedisScheduleSource(REDIS_URL)

scheduler = TaskiqScheduler(
    broker="src.workers.broker:broker",
    sources=[redis_source],
)
```

### Modify: `backend/src/contexts/service.py`

Wire `HeartbeatService` into `ServiceContext`:

```python
# Add import at top:
from src.services.heartbeat import HeartbeatService

# In __init__, after schedule_service (line ~38):
self.heartbeat_service = HeartbeatService(user_id=self.user_id, store=store)
```

### Modify: `docker-compose.dev.yml`

Add scheduler service:

```yaml
  scheduler:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    env_file: ${BACKEND_ENV_FILE:-./backend/.env.docker.dev}
    environment:
      REDIS_URL: redis://redis:6379/0
    command: >
      bash -c "uv sync && taskiq scheduler src.workers.scheduler:scheduler"
    depends_on:
      backend:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - storage
      - services
    volumes:
      - ./backend/src:/app/src
    deploy:
      resources:
        limits:
          memory: 256M
```

### No New Dependencies

`taskiq` and `taskiq-redis` are already in `pyproject.toml`. The `ListRedisScheduleSource` and `TaskiqScheduler` classes are available from the existing packages.

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  TaskIQ Scheduler Process                        │
│  (taskiq scheduler src.workers.scheduler:scheduler)│
│                                                   │
│  ListRedisScheduleSource ─── reads intervals ──► │
│        │                                          │
│        ▼                                          │
│  Dispatches run_heartbeat_tick(user_id)           │
│  to TaskIQ broker (Redis Streams)                 │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  TaskIQ Worker Process                           │
│  (taskiq worker src.workers.tasks:broker)        │
│                                                   │
│  run_heartbeat_tick(user_id):                     │
│    1. Load HeartbeatConfig from LangGraph store   │
│    2. Check active_hours                          │
│    3. Build prompt from checklist                 │
│    4. Invoke agent (light context, cheap model)   │
│    5. Detect HEARTBEAT_OK token                   │
│    6. Record HeartbeatState + HeartbeatHistory     │
│    7. Return HeartbeatTickResult                  │
└─────────────────────────────────────────────────┘
```

## Data Flow

```
User configures heartbeat (API/chat)
    ↓
HeartbeatService.save_config() → LangGraph store (user_id, "heartbeat_config")
    ↓
HeartbeatService.register() → TaskIQ schedule_by_interval(redis_source, seconds)
    ↓
TaskIQ Scheduler ticks → dispatches run_heartbeat_tick(user_id)
    ↓
HeartbeatService.tick():
    ├── Outside active hours? → HeartbeatTickResult(action="skipped")
    ├── Agent says HEARTBEAT_OK? → HeartbeatTickResult(action="ok") [suppressed]
    └── Agent has details? → HeartbeatTickResult(action="escalated") [stored/notified]
    ↓
State + History → LangGraph store (user_id, "heartbeat_state"/"heartbeat_history")
```

## Acceptance Criteria

1. `HeartbeatConfig` can be created, read, updated, deleted via repos
2. `HeartbeatService.tick()` skips execution outside `active_hours`
3. `HeartbeatService.tick()` detects `HEARTBEAT_OK` token and returns `action="ok"`
4. `HeartbeatService.tick()` returns `action="escalated"` with full response when agent finds issues
5. `HeartbeatState` tracks `consecutive_ok_count`, resets on escalation
6. `HeartbeatHistory` stores last N tick results (default 100)
7. `HeartbeatService.register()` creates TaskIQ interval schedule
8. `HeartbeatService.unregister()` removes TaskIQ schedule
9. Scheduler service starts via `docker-compose.dev.yml`
10. User isolation enforced — configs namespaced by `user_id`

## Test Plan

### Unit Tests: `backend/tests/unit/services/test_heartbeat_service.py`

```python
import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from src.services.heartbeat import HeartbeatService, HEARTBEAT_OK_TOKEN
from src.schemas.entities.heartbeat import (
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
    ActiveHours,
)


class TestHeartbeatOkDetection:
    def test_detects_ok_at_start(self):
        service = HeartbeatService(user_id="test")
        assert service._detect_heartbeat_ok("HEARTBEAT_OK", 300) is True

    def test_detects_ok_at_end(self):
        service = HeartbeatService(user_id="test")
        assert service._detect_heartbeat_ok("All clear. HEARTBEAT_OK", 300) is True

    def test_rejects_ok_with_long_content(self):
        service = HeartbeatService(user_id="test")
        long_content = "x" * 301 + " HEARTBEAT_OK"
        assert service._detect_heartbeat_ok(long_content, 300) is False

    def test_rejects_missing_token(self):
        service = HeartbeatService(user_id="test")
        assert service._detect_heartbeat_ok("Everything is fine", 300) is False

    def test_ok_with_whitespace(self):
        service = HeartbeatService(user_id="test")
        assert service._detect_heartbeat_ok("  HEARTBEAT_OK  ", 300) is True


class TestActiveHours:
    def test_within_active_hours(self):
        """Current time within start-end window."""

    def test_outside_active_hours(self):
        """Current time before start or after end."""

    def test_midnight_wrap(self):
        """Active hours spanning midnight (e.g., 22:00-06:00)."""


class TestTick:
    @pytest.mark.asyncio
    async def test_tick_skips_when_disabled(self):
        """Config exists but enabled=False."""

    @pytest.mark.asyncio
    async def test_tick_skips_outside_hours(self):
        """Within config but outside active hours window."""

    @pytest.mark.asyncio
    async def test_tick_returns_ok(self):
        """Agent responds with HEARTBEAT_OK."""

    @pytest.mark.asyncio
    async def test_tick_returns_escalated(self):
        """Agent responds with detailed findings."""

    @pytest.mark.asyncio
    async def test_tick_updates_state(self):
        """State reflects last_run_at, consecutive_ok_count."""

    @pytest.mark.asyncio
    async def test_tick_appends_history(self):
        """History grows with each tick result."""

    @pytest.mark.asyncio
    async def test_consecutive_ok_resets_on_escalation(self):
        """consecutive_ok_count resets to 0 on escalation."""


class TestRegistration:
    @pytest.mark.asyncio
    async def test_register_creates_schedule(self):
        """Verify TaskIQ schedule is created with correct interval."""

    @pytest.mark.asyncio
    async def test_unregister_removes_schedule(self):
        """Verify TaskIQ schedule is deleted."""

    @pytest.mark.asyncio
    async def test_register_stores_schedule_id(self):
        """Config updated with schedule_id for later unregistration."""
```
