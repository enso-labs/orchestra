# Spec 003: Heartbeat REST API + Chat Tools

## User Story

As a user, I want to configure heartbeat from the UI and conversationally ("set up a heartbeat to check my inbox every hour") — so I can manage my agent's periodic awareness from wherever I am.

## Purpose

Expose the `HeartbeatService` (Spec 002) via REST endpoints for the frontend and LangChain tools for chat-based configuration. This spec bridges the backend engine to user-facing interfaces.

## Problem Statement

Spec 002 builds the heartbeat engine, but there's no way for users or the UI to interact with it. This spec adds:
1. REST API for the frontend dashboard (Spec 004)
2. LangChain tools for conversational heartbeat management

## Technical Approach

### New File: `backend/src/routes/v0/heartbeat.py`

REST endpoints following the pattern from `backend/src/routes/v0/schedule.py`:

```python
from fastapi import APIRouter, Depends, Body, HTTPException
from src.common.auth import verify_credentials, ProtectedUser
from src.services.heartbeat import HeartbeatService
from src.schemas.entities.heartbeat import HeartbeatConfig, ActiveHours
from src.common.store import get_store
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(tags=["Heartbeat"])

# --- Request/Response Schemas ---

class HeartbeatConfigRequest(BaseModel):
    assistant_id: str
    enabled: bool = True
    checklist: str = "# Heartbeat Checklist\n- Check for urgent items"
    every_seconds: int = Field(default=3600, ge=300, le=86400)
    active_hours: Optional[ActiveHours] = None
    isolated_session: bool = True
    light_context: bool = True
    ack_max_chars: int = 300
    prompt: Optional[str] = None

class HeartbeatConfigResponse(BaseModel):
    config: dict

class HeartbeatStateResponse(BaseModel):
    state: dict

class HeartbeatTickResponse(BaseModel):
    result: dict

class HeartbeatHistoryResponse(BaseModel):
    results: list[dict]


# --- Endpoints ---

@router.get("/heartbeat", tags=["mcp"])
async def get_heartbeat_config(
    user: ProtectedUser = Depends(verify_credentials),
) -> HeartbeatConfigResponse:
    """Get the current heartbeat configuration."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)
    config = await service.get_config()

    if not config:
        return HeartbeatConfigResponse(config={})

    return HeartbeatConfigResponse(config=config.model_dump(mode="json"))


@router.put("/heartbeat", tags=["mcp"])
async def upsert_heartbeat_config(
    body: HeartbeatConfigRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
) -> HeartbeatConfigResponse:
    """Create or update heartbeat configuration."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)

    # Build config
    config = HeartbeatConfig(
        user_id=user.id,
        assistant_id=body.assistant_id,
        enabled=body.enabled,
        checklist=body.checklist,
        every_seconds=body.every_seconds,
        active_hours=body.active_hours or ActiveHours(),
        isolated_session=body.isolated_session,
        light_context=body.light_context,
        ack_max_chars=body.ack_max_chars,
    )

    if body.prompt:
        config.prompt = body.prompt

    # Save config
    saved = await service.save_config(config)

    # Register/unregister with TaskIQ Scheduler
    if saved.enabled:
        await service.unregister()  # Remove existing schedule if any
        await service.register()
    else:
        await service.unregister()

    return HeartbeatConfigResponse(config=saved.model_dump(mode="json"))


@router.delete("/heartbeat", status_code=204, tags=["mcp"])
async def delete_heartbeat_config(
    user: ProtectedUser = Depends(verify_credentials),
) -> None:
    """Disable and remove heartbeat configuration."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)
    await service.delete_config()


@router.get("/heartbeat/state", tags=["mcp"])
async def get_heartbeat_state(
    user: ProtectedUser = Depends(verify_credentials),
) -> HeartbeatStateResponse:
    """Get heartbeat runtime state (last run, next due, etc.)."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)
    state = await service.get_state()
    return HeartbeatStateResponse(state=state.model_dump(mode="json"))


@router.post("/heartbeat/tick", tags=["mcp"])
async def trigger_heartbeat_tick(
    user: ProtectedUser = Depends(verify_credentials),
) -> HeartbeatTickResponse:
    """Manually trigger a heartbeat tick (for testing)."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)
    result = await service.tick()
    return HeartbeatTickResponse(result=result.model_dump(mode="json"))


@router.get("/heartbeat/history", tags=["mcp"])
async def get_heartbeat_history(
    limit: int = 20,
    user: ProtectedUser = Depends(verify_credentials),
) -> HeartbeatHistoryResponse:
    """Get recent heartbeat tick results."""
    store = get_store()
    service = HeartbeatService(user_id=user.id, store=store)
    results = await service.get_history(limit=limit)
    return HeartbeatHistoryResponse(
        results=[r.model_dump(mode="json") for r in results]
    )
```

### Modify: `backend/src/routes/v0/__init__.py`

Register the heartbeat router:

```python
# Add import:
from src.routes.v0.heartbeat import router as heartbeat

# In create_api_router(), add after schedule router (line ~32):
app.include_router(heartbeat, prefix=prefix)
```

### New File: `backend/src/tools/heartbeat.py`

LangChain tools following `backend/src/tools/memory.py` pattern:

```python
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from src.services.heartbeat import HeartbeatService
from src.schemas.entities.heartbeat import HeartbeatConfig, ActiveHours
from src.common.store import get_store
from typing import Optional


@tool
async def configure_heartbeat(
    checklist: str,
    every_hours: float,
    active_hours_start: str,
    active_hours_end: str,
    config: RunnableConfig,
) -> str:
    """
    Toolkit: Heartbeat
    Description: Configure periodic heartbeat monitoring. The agent will periodically
        check the provided checklist and only escalate when something needs attention.
    Args:
        checklist: Markdown checklist of items to monitor (e.g., "- Check for urgent emails\\n- Review pending PRs")
        every_hours: How often to check, in hours (e.g., 1.0 for hourly, 0.5 for every 30 min). Minimum 0.083 (5 min).
        active_hours_start: Start of active window in HH:MM format (e.g., "09:00")
        active_hours_end: End of active window in HH:MM format (e.g., "18:00")
    Returns:
        Confirmation that heartbeat has been configured with details.
    """
    user_id = config["configurable"].get("user_id")
    assistant_id = config["configurable"].get("assistant_id")

    store = get_store()
    service = HeartbeatService(user_id=user_id, store=store)

    every_seconds = int(every_hours * 3600)

    hb_config = HeartbeatConfig(
        user_id=user_id,
        assistant_id=assistant_id or "",
        enabled=True,
        checklist=checklist,
        every_seconds=every_seconds,
        active_hours=ActiveHours(
            start=active_hours_start,
            end=active_hours_end,
        ),
    )

    await service.save_config(hb_config)

    # Register with scheduler
    await service.unregister()  # Remove old schedule if any
    schedule_id = await service.register()

    interval_display = f"{every_hours}h" if every_hours >= 1 else f"{int(every_hours * 60)}m"

    return (
        f"Heartbeat configured successfully!\n"
        f"- **Interval**: Every {interval_display}\n"
        f"- **Active hours**: {active_hours_start} - {active_hours_end}\n"
        f"- **Checklist**:\n{checklist}\n"
        f"- **Schedule ID**: `{schedule_id}`\n\n"
        f"I'll periodically review your checklist and only notify you when something needs attention."
    )


@tool
async def get_heartbeat_status(config: RunnableConfig) -> str:
    """
    Toolkit: Heartbeat
    Description: Get the current heartbeat status, including configuration and recent activity.
    Returns:
        Current heartbeat configuration, state, and recent tick results.
    """
    user_id = config["configurable"].get("user_id")

    store = get_store()
    service = HeartbeatService(user_id=user_id, store=store)

    hb_config = await service.get_config()
    if not hb_config:
        return "No heartbeat is configured. Use the configure_heartbeat tool to set one up."

    state = await service.get_state()
    history = await service.get_history(limit=5)

    # Format interval
    hours = hb_config.every_seconds / 3600
    interval_display = f"{hours}h" if hours >= 1 else f"{int(hours * 60)}m"

    lines = [
        f"**Heartbeat Status**\n",
        f"- **Enabled**: {'Yes' if hb_config.enabled else 'No'}",
        f"- **Interval**: Every {interval_display}",
        f"- **Active hours**: {hb_config.active_hours.start} - {hb_config.active_hours.end} ({hb_config.active_hours.timezone})",
        f"- **Last run**: {state.last_run_at.isoformat() if state.last_run_at else 'Never'}",
        f"- **Last result**: {state.last_result or 'N/A'}",
        f"- **Consecutive OKs**: {state.consecutive_ok_count}",
        f"- **Total ticks**: {state.total_ticks} ({state.total_escalations} escalations)",
    ]

    if state.next_due_at:
        lines.append(f"- **Next due**: {state.next_due_at.isoformat()}")

    if history:
        lines.append(f"\n**Recent Activity** (last {len(history)}):")
        for h in history:
            icon = "✓" if h.action == "ok" else "⚠" if h.action == "escalated" else "⏭"
            lines.append(f"  {icon} {h.action} — {h.reason} ({h.timestamp.strftime('%m/%d %H:%M')})")

    return "\n".join(lines)


@tool
async def disable_heartbeat(config: RunnableConfig) -> str:
    """
    Toolkit: Heartbeat
    Description: Disable and remove the heartbeat configuration. The agent will stop
        periodic monitoring.
    Returns:
        Confirmation that heartbeat has been disabled.
    """
    user_id = config["configurable"].get("user_id")

    store = get_store()
    service = HeartbeatService(user_id=user_id, store=store)

    hb_config = await service.get_config()
    if not hb_config:
        return "No heartbeat is configured — nothing to disable."

    await service.delete_config()
    return "Heartbeat has been disabled and removed. I'll stop periodic monitoring."


HEARTBEAT_TOOLS = [configure_heartbeat, get_heartbeat_status, disable_heartbeat]
```

### Modify: `backend/src/tools/__init__.py`

Add `HEARTBEAT_TOOLS` to `default_tools()`:

```python
# Add import:
from src.tools.heartbeat import HEARTBEAT_TOOLS

# In default_tools(), add to the returned list:
def default_tools() -> list[BaseTool]:
    tools = [
        *SEARCH_TOOLS,
        *PYTHON_CODE_INTERPRETER_TOOLS,
        *FINANCE_TOOLS,
        *MEMORY_TOOLS,
        *THREAD_SEARCH_TOOLS,
        *SCHEDULE_TOOLS,
        *HEARTBEAT_TOOLS,  # <-- NEW
    ]
    if APP_ENV == "test":
        tools.extend(TEST_TOOLS)
    return tools
```

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/heartbeat` | Get heartbeat config |
| `PUT` | `/api/heartbeat` | Create/update config + register schedule |
| `DELETE` | `/api/heartbeat` | Disable + remove config |
| `GET` | `/api/heartbeat/state` | Runtime state (last run, next due) |
| `POST` | `/api/heartbeat/tick` | Manual trigger for testing |
| `GET` | `/api/heartbeat/history` | Recent tick results |

## Chat Tool Summary

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `configure_heartbeat` | Set up periodic monitoring | checklist, every_hours, active_hours_start/end |
| `get_heartbeat_status` | Check current config + state | (none) |
| `disable_heartbeat` | Stop monitoring | (none) |

## Integration Points

| Component | File | Integration |
|-----------|------|-------------|
| Router registration | `backend/src/routes/v0/__init__.py` | Add `heartbeat` router after `schedule` |
| Tool registration | `backend/src/tools/__init__.py` | Add `HEARTBEAT_TOOLS` to `default_tools()` |
| HeartbeatService | `backend/src/services/heartbeat.py` (Spec 002) | All endpoints delegate to service |
| Auth | `backend/src/common/auth.py` | `verify_credentials` on all endpoints |
| Store | `backend/src/common/store.py` | `get_store()` for LangGraph store access |

## Acceptance Criteria

1. `GET /api/heartbeat` returns current config (empty if none)
2. `PUT /api/heartbeat` creates config and registers TaskIQ schedule
3. `PUT /api/heartbeat` with `enabled: false` unregisters the schedule
4. `DELETE /api/heartbeat` removes config and unregisters schedule
5. `GET /api/heartbeat/state` returns runtime state
6. `POST /api/heartbeat/tick` manually triggers a tick and returns result
7. `GET /api/heartbeat/history` returns recent tick results (default 20)
8. All endpoints enforce user authentication via `verify_credentials`
9. Chat tool `configure_heartbeat` creates config and registers schedule
10. Chat tool `get_heartbeat_status` returns formatted config + state + history
11. Chat tool `disable_heartbeat` removes config and unregisters schedule
12. User says "set up a heartbeat to check my inbox every hour" → agent calls `configure_heartbeat`

## Test Plan

### Unit Tests: `backend/tests/unit/routes/test_heartbeat_routes.py`

```python
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


class TestGetHeartbeatConfig:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_config(self, client, auth_headers):
        """GET /api/heartbeat returns empty config when none exists."""

    @pytest.mark.asyncio
    async def test_returns_config(self, client, auth_headers):
        """GET /api/heartbeat returns saved config."""


class TestUpsertHeartbeatConfig:
    @pytest.mark.asyncio
    async def test_creates_config(self, client, auth_headers):
        """PUT /api/heartbeat creates new config."""

    @pytest.mark.asyncio
    async def test_registers_schedule_when_enabled(self, client, auth_headers):
        """PUT /api/heartbeat with enabled=true calls register()."""

    @pytest.mark.asyncio
    async def test_unregisters_schedule_when_disabled(self, client, auth_headers):
        """PUT /api/heartbeat with enabled=false calls unregister()."""

    @pytest.mark.asyncio
    async def test_validates_every_seconds_range(self, client, auth_headers):
        """Rejects every_seconds < 300 or > 86400."""


class TestDeleteHeartbeatConfig:
    @pytest.mark.asyncio
    async def test_deletes_config(self, client, auth_headers):
        """DELETE /api/heartbeat removes config."""

    @pytest.mark.asyncio
    async def test_returns_204(self, client, auth_headers):
        """DELETE returns 204 No Content."""


class TestHeartbeatTick:
    @pytest.mark.asyncio
    async def test_manual_tick(self, client, auth_headers):
        """POST /api/heartbeat/tick triggers tick and returns result."""


class TestHeartbeatHistory:
    @pytest.mark.asyncio
    async def test_returns_history(self, client, auth_headers):
        """GET /api/heartbeat/history returns recent results."""

    @pytest.mark.asyncio
    async def test_respects_limit(self, client, auth_headers):
        """GET /api/heartbeat/history?limit=5 returns at most 5."""
```

### Unit Tests: `backend/tests/unit/tools/test_heartbeat_tools.py`

```python
import pytest
from unittest.mock import patch, AsyncMock
from src.tools.heartbeat import configure_heartbeat, get_heartbeat_status, disable_heartbeat


@pytest.fixture
def mock_config():
    return {
        "configurable": {
            "user_id": "test-user-123",
            "assistant_id": "test-assistant-456",
        }
    }


class TestConfigureHeartbeat:
    @pytest.mark.asyncio
    async def test_creates_config_and_registers(self, mock_config):
        """Verify config is saved and schedule registered."""

    @pytest.mark.asyncio
    async def test_returns_confirmation(self, mock_config):
        """Verify response includes interval, hours, checklist."""


class TestGetHeartbeatStatus:
    @pytest.mark.asyncio
    async def test_no_config_message(self, mock_config):
        """Returns helpful message when no config exists."""

    @pytest.mark.asyncio
    async def test_returns_formatted_status(self, mock_config):
        """Returns config + state + recent history."""


class TestDisableHeartbeat:
    @pytest.mark.asyncio
    async def test_disables_and_confirms(self, mock_config):
        """Removes config and returns confirmation."""

    @pytest.mark.asyncio
    async def test_no_config_message(self, mock_config):
        """Returns message when nothing to disable."""
```

### E2E Validation

See main plan — Phase 2: Heartbeat Configuration (curl + agent-browser).
