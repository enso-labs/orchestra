# Spec 001: Agent-Initiated Scheduling from Chat

## User Story

As a user on the chat page, I want to ask my agent to schedule a task, and have it create/manage schedules seamlessly — so I never have to leave the conversation to set up recurring work.

## Purpose

Let users say "schedule a daily weather check at 8am" in chat. The agent creates, lists, and deletes schedules via LangChain tools that wrap the existing `ScheduleService`. No new infrastructure — works with the current APScheduler system.

## Problem Statement

Orchestra has a full scheduling system (APScheduler + cron triggers + UI), but it's only accessible through the Schedules page. Users must leave their chat context, navigate to `/schedules`, fill out a form, and manually configure cron expressions. There's no way to conversationally say "remind me every morning" and have the agent handle it.

## Technical Approach

### New File: `backend/src/tools/schedule.py`

Three LangChain tools following the `@tool` + `RunnableConfig` pattern from `backend/src/tools/memory.py`:

```python
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from src.services.schedule import ScheduleService
from src.schemas.entities.schedule import ScheduleCreate, JobTrigger
from src.schemas.entities.llm import LLMRequest


@tool
async def create_schedule(
    title: str,
    cron_expression: str,
    message: str,
    config: RunnableConfig,
) -> str:
    """
    Toolkit: Scheduling
    Description: Create a recurring scheduled task that runs on a cron schedule.
        The task will invoke the current agent with the given message at the specified times.
    Args:
        title: A short descriptive name for the schedule (e.g., "Daily weather check")
        cron_expression: A 5-field cron expression (e.g., "0 9 * * *" for 9am daily).
            Minimum interval is 1 hour. Fields: minute hour day month weekday.
        message: The message/prompt to send to the agent on each run.
    Returns:
        Confirmation with schedule ID and next run time, or error message.
    """
    user_id = config["configurable"].get("user_id")
    assistant_id = config["configurable"].get("assistant_id")
    model = config["configurable"].get("model", "anthropic/claude-sonnet-4-20250514")

    schedule_service = ScheduleService(user_id=user_id)

    task = LLMRequest(
        input={"messages": [{"role": "user", "content": message}]},
        model=model,
        metadata={
            "user_id": user_id,
            "assistant_id": assistant_id,
            "graph_id": "react",
        },
    )

    job_data = ScheduleCreate(
        title=title,
        trigger=JobTrigger(type="cron", expression=cron_expression),
        task=task,
    )

    # ScheduleService.create_job() expects a Job, but we build from ScheduleCreate
    # Reuse the existing create flow from the schedule route
    schedule = schedule_service.create_job(
        Job(
            id=str(uuid4()),
            trigger=job_data.trigger,
            func="src.services.schedule:scheduled_llm_invoke",
            args=[task.model_dump()],
            kwargs={"user_id": user_id, "title": title},
        )
    )

    return (
        f"Schedule created successfully!\n"
        f"- **ID**: `{schedule.id}`\n"
        f"- **Title**: {title}\n"
        f"- **Cron**: `{cron_expression}`\n"
        f"- **Next run**: {schedule.next_run_time.isoformat()}"
    )


@tool
async def list_schedules(config: RunnableConfig) -> str:
    """
    Toolkit: Scheduling
    Description: List all scheduled tasks for the current user.
    Returns:
        A formatted list of all schedules with their IDs, titles, cron expressions,
        and next run times.
    """
    user_id = config["configurable"].get("user_id")
    schedule_service = ScheduleService(user_id=user_id)
    schedules = schedule_service.get_jobs()

    if not schedules:
        return "You have no scheduled tasks."

    lines = [f"You have {len(schedules)} scheduled task(s):\n"]
    for s in schedules:
        lines.append(
            f"- **{s.title}** (ID: `{s.id}`)\n"
            f"  Cron: `{s.trigger.expression}` | Next run: {s.next_run_time.isoformat()}"
        )
    return "\n".join(lines)


@tool
async def delete_schedule(schedule_id: str, config: RunnableConfig) -> str:
    """
    Toolkit: Scheduling
    Description: Delete a scheduled task by its ID.
    Args:
        schedule_id: The ID of the schedule to delete.
    Returns:
        Confirmation that the schedule was deleted, or error message.
    """
    user_id = config["configurable"].get("user_id")
    schedule_service = ScheduleService(user_id=user_id)

    try:
        schedule_service.delete_job(schedule_id)
        return f"Schedule `{schedule_id}` has been deleted."
    except Exception as e:
        return f"Failed to delete schedule: {str(e)}"


SCHEDULE_TOOLS = [create_schedule, list_schedules, delete_schedule]
```

### Modify: `backend/src/tools/__init__.py`

Add `SCHEDULE_TOOLS` to `default_tools()`:

```python
# At top of file, add import:
from src.tools.schedule import SCHEDULE_TOOLS

# In default_tools() (line ~16-22), add to the returned list:
def default_tools() -> list[BaseTool]:
    tools = [
        *SEARCH_TOOLS,
        *PYTHON_CODE_INTERPRETER_TOOLS,
        *FINANCE_TOOLS,
        *MEMORY_TOOLS,
        *THREAD_SEARCH_TOOLS,
        *SCHEDULE_TOOLS,  # <-- NEW
    ]
    if APP_ENV == "test":
        tools.extend(TEST_TOOLS)
    return tools
```

### Key Design Decisions

1. **Reuse `ScheduleService` directly** — No new service layer. The tools call `ScheduleService.create_job()`, `.get_jobs()`, `.delete_job()` which already handle APScheduler interaction.

2. **Extract context from `RunnableConfig`** — Following `memory.py` pattern, `user_id` and `assistant_id` come from `config["configurable"]`. The agent's current model is also extracted so scheduled runs use the same model.

3. **Build `LLMRequest` from chat context** — The tool constructs the full `LLMRequest` that `scheduled_llm_invoke()` expects, including metadata for agent routing.

4. **Cron expression as input** — The agent is responsible for translating natural language ("every morning at 8am") into a cron expression ("0 8 * * *"). LLMs handle this well.

5. **No UI changes needed** — Schedules created via chat appear on the existing Schedules page automatically since they use the same `ScheduleService`.

### Integration Points

| Component | File | Integration |
|-----------|------|-------------|
| Tool registration | `backend/src/tools/__init__.py:16-22` | Add `SCHEDULE_TOOLS` to `default_tools()` |
| Schedule service | `backend/src/services/schedule.py:221` | Call `create_job()` |
| Schedule service | `backend/src/services/schedule.py:190` | Call `get_jobs()` |
| Schedule service | `backend/src/services/schedule.py:296` | Call `delete_job()` |
| Job schema | `backend/src/schemas/entities/schedule.py:60-64` | Build `Job` instance |
| LLM schema | `backend/src/schemas/entities/llm.py` | Build `LLMRequest` for task |

## Acceptance Criteria

1. User can say "schedule a daily weather check at 9am" and the agent creates a schedule
2. User can say "list my schedules" and see all active schedules
3. User can say "delete schedule X" and the schedule is removed
4. Created schedules appear on the `/schedules` page
5. Scheduled tasks execute at the specified times via APScheduler
6. Tool respects user isolation — users can only see/modify their own schedules
7. Cron expression validation rejects intervals shorter than 1 hour

## Test Plan

### Unit Tests: `backend/tests/unit/tools/test_schedule_tools.py`

```python
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from src.tools.schedule import create_schedule, list_schedules, delete_schedule


@pytest.fixture
def mock_config():
    return {
        "configurable": {
            "user_id": "test-user-123",
            "assistant_id": "test-assistant-456",
            "model": "anthropic/claude-sonnet-4-20250514",
        }
    }


class TestCreateSchedule:
    @pytest.mark.asyncio
    async def test_creates_schedule_successfully(self, mock_config):
        """Verify schedule is created with correct cron and message."""

    @pytest.mark.asyncio
    async def test_returns_schedule_id_and_next_run(self, mock_config):
        """Verify response includes schedule ID and next run time."""

    @pytest.mark.asyncio
    async def test_rejects_invalid_cron_expression(self, mock_config):
        """Verify validation catches sub-hourly intervals."""

    @pytest.mark.asyncio
    async def test_uses_current_model_from_config(self, mock_config):
        """Verify LLMRequest uses model from configurable context."""


class TestListSchedules:
    @pytest.mark.asyncio
    async def test_lists_user_schedules(self, mock_config):
        """Verify all user schedules are returned formatted."""

    @pytest.mark.asyncio
    async def test_empty_schedules_message(self, mock_config):
        """Verify friendly message when no schedules exist."""

    @pytest.mark.asyncio
    async def test_user_isolation(self, mock_config):
        """Verify only current user's schedules are returned."""


class TestDeleteSchedule:
    @pytest.mark.asyncio
    async def test_deletes_schedule_by_id(self, mock_config):
        """Verify schedule is deleted and confirmation returned."""

    @pytest.mark.asyncio
    async def test_delete_nonexistent_schedule(self, mock_config):
        """Verify error message for missing schedule."""

    @pytest.mark.asyncio
    async def test_cannot_delete_other_users_schedule(self, mock_config):
        """Verify user cannot delete another user's schedule."""
```

### E2E Validation (agent-browser)

See main plan E2E section — Phase 1: Schedule Tool from Chat.

**Backend curl validation:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test1234"}' | jq -r '.access_token')

# Verify schedules created via chat tool appear in API
curl -s http://localhost:8000/api/schedules \
  -H "Authorization: Bearer $TOKEN" | jq '.schedules[] | {id, title, next_run_time}'
```
