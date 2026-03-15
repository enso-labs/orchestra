from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from src.services.heartbeat import HeartbeatService
from src.schemas.entities.heartbeat import HeartbeatConfig, ActiveHours
from src.services.db import get_store_in_memory


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
    Description: Configure a periodic heartbeat monitor that checks a checklist at regular intervals.
    Args:
        checklist: Markdown checklist for the heartbeat agent to review periodically.
        every_hours: How often to run the heartbeat, in hours (min 0.083 = 5min, max 24).
        active_hours_start: Start of active window in HH:MM format (e.g. '09:00').
        active_hours_end: End of active window in HH:MM format (e.g. '18:00').
        config: The runnable config (injected automatically).
    Returns:
        Confirmation with interval, active hours, checklist summary, and schedule ID.
    """
    user_id = config["configurable"].get("user_id")
    assistant_id = config["configurable"].get("assistant_id")

    if not user_id:
        raise ValueError("User ID is required to configure heartbeat.")

    every_seconds = int(every_hours * 3600)

    service = HeartbeatService(user_id=user_id, store=get_store_in_memory())

    hb_config = HeartbeatConfig(
        user_id=user_id,
        assistant_id=assistant_id or "",
        enabled=True,
        checklist=checklist,
        every_seconds=every_seconds,
        active_hours=ActiveHours(start=active_hours_start, end=active_hours_end),
    )

    await service.save_config(hb_config)
    await service.unregister()
    schedule_id = await service.register()

    return (
        f"Heartbeat configured successfully!\n"
        f"- **Interval**: every {every_hours}h ({every_seconds}s)\n"
        f"- **Active Hours**: {active_hours_start} - {active_hours_end}\n"
        f"- **Checklist**:\n{checklist}\n"
        f"- **Schedule ID**: {schedule_id}"
    )


@tool
async def get_heartbeat_status(config: RunnableConfig) -> str:
    """
    Toolkit: Heartbeat
    Description: Get the current heartbeat configuration, state, and recent activity.
    Args:
        config: The runnable config (injected automatically).
    Returns:
        Formatted status including config, state metrics, and last 5 history entries.
    """
    user_id = config["configurable"].get("user_id")

    if not user_id:
        raise ValueError("User ID is required to get heartbeat status.")

    service = HeartbeatService(user_id=user_id, store=get_store_in_memory())
    hb_config = await service.get_config()

    if hb_config is None:
        return "No heartbeat configured. Use the configure_heartbeat tool to set one up."

    state = await service.get_state()
    history = await service.get_history(limit=5)

    lines = [
        "**Heartbeat Status**\n",
        f"- **Enabled**: {hb_config.enabled}",
        f"- **Interval**: every {hb_config.every_seconds}s ({hb_config.every_seconds / 3600:.1f}h)",
        f"- **Active Hours**: {hb_config.active_hours.start} - {hb_config.active_hours.end}"
        f" ({hb_config.active_hours.timezone})",
        f"- **Schedule ID**: {hb_config.schedule_id or 'Not registered'}",
        "",
        "**State**",
        f"- Last Run: {state.last_run_at or 'Never'}",
        f"- Last Result: {state.last_result or 'N/A'}",
        f"- Consecutive OKs: {state.consecutive_ok_count}",
        f"- Total Ticks: {state.total_ticks}",
        f"- Total Escalations: {state.total_escalations}",
    ]

    if history:
        lines.append("\n**Recent Activity (escalations only)**")
        for entry in history:
            lines.append(f"- [{entry.timestamp}] {entry.action}: {entry.reason}")

    return "\n".join(lines)


@tool
async def disable_heartbeat(config: RunnableConfig) -> str:
    """
    Toolkit: Heartbeat
    Description: Disable and remove the heartbeat monitor configuration.
    Args:
        config: The runnable config (injected automatically).
    Returns:
        Confirmation that heartbeat has been disabled, or message if nothing to disable.
    """
    user_id = config["configurable"].get("user_id")

    if not user_id:
        raise ValueError("User ID is required to disable heartbeat.")

    service = HeartbeatService(user_id=user_id, store=get_store_in_memory())
    hb_config = await service.get_config()

    if hb_config is None:
        return "No heartbeat configured — nothing to disable."

    await service.delete_config()
    return "Heartbeat has been disabled and removed successfully."


HEARTBEAT_TOOLS = [configure_heartbeat, get_heartbeat_status, disable_heartbeat]
