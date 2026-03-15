from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from src.services.schedule import schedule_service
from src.schemas.entities import LLMRequest
from src.schemas.entities.llm import LLMInput, Config
from src.schemas.entities.schedule import JobTrigger, ScheduleCreate


@tool
async def create_schedule(title: str, cron_expression: str, message: str, config: RunnableConfig) -> str:
    """
    Toolkit: Schedule
    Description: Create a recurring schedule that runs an LLM task on a cron expression.
    Args:
        title: A short descriptive name for the schedule (e.g. 'Daily Weather Check').
        cron_expression: A 5-field cron expression (minute hour day month day_of_week).
            Must not schedule more frequently than 1 hour.
        message: The message/prompt to send to the LLM on each scheduled run.
        config: The runnable config (injected automatically).
    Returns:
        Confirmation with schedule ID, title, cron expression, and next run time.
    """
    user_id = config["configurable"].get("user_id")
    assistant_id = config["configurable"].get("assistant_id")
    model = config["configurable"].get("model")

    if not user_id:
        raise ValueError("User ID is required to create a schedule.")

    # Build the LLMRequest for the scheduled task
    llm_input = LLMInput(messages=[LLMInput.ChatMessage(role="user", content=message)])
    metadata = Config(user_id=user_id, assistant_id=assistant_id)
    task = LLMRequest(
        model=model,
        input=llm_input,
        metadata=metadata,
    )

    # Build the trigger
    trigger = JobTrigger(type="cron", expression=cron_expression)

    # Create the schedule via ScheduleService
    schedule_create = ScheduleCreate(title=title, trigger=trigger, task=task)
    schedule_service.user_id = user_id
    schedule = schedule_service.create_job(schedule_create)

    return (
        f"Schedule created successfully!\n"
        f"- **ID**: {schedule.id}\n"
        f"- **Title**: {schedule.title}\n"
        f"- **Cron**: {cron_expression}\n"
        f"- **Next Run**: {schedule.next_run_time}"
    )


@tool
async def list_schedules(config: RunnableConfig) -> str:
    """
    Toolkit: Schedule
    Description: List all recurring schedules for the current user.
    Args:
        config: The runnable config (injected automatically).
    Returns:
        A formatted list of all active schedules, or a message if none exist.
    """
    user_id = config["configurable"].get("user_id")

    if not user_id:
        raise ValueError("User ID is required to list schedules.")

    schedule_service.user_id = user_id
    schedules = schedule_service.get_jobs()

    if not schedules:
        return "You have no scheduled tasks."

    lines = ["**Your Scheduled Tasks:**\n"]
    for s in schedules:
        lines.append(f"- **{s.title}** (ID: `{s.id}`)\n  Cron: `{s.trigger.expression}` | Next Run: {s.next_run_time}")
    return "\n".join(lines)


SCHEDULE_TOOLS = [create_schedule, list_schedules]
