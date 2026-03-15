from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ActiveHours(BaseModel):
    start: str = Field(default="09:00", description="Start time in HH:MM format")
    end: str = Field(default="22:00", description="End time in HH:MM format")
    timezone: str = Field(default="UTC", description="IANA timezone identifier")


DEFAULT_HEARTBEAT_PROMPT = (
    "You are a periodic monitoring agent. Review the following checklist and report status.\n\n"
    "Checklist:\n{checklist}\n\n"
    "If everything looks good, respond with HEARTBEAT_OK followed by a brief status (under {ack_max_chars} chars).\n"
    "If any item needs attention, explain the issue in detail."
)


class HeartbeatConfig(BaseModel):
    user_id: str
    assistant_id: str
    enabled: bool = Field(default=False)
    checklist: str = Field(default="", description="Markdown checklist for the heartbeat agent to review")
    every_seconds: int = Field(default=3600, ge=300, le=86400, description="Interval between ticks in seconds")
    active_hours: ActiveHours = Field(default_factory=ActiveHours)
    isolated_session: bool = Field(default=True, description="Run each tick in an isolated chat session")
    light_context: bool = Field(default=True, description="Use minimal context for tick invocations")
    ack_max_chars: int = Field(default=300, description="Max chars allowed after HEARTBEAT_OK token")
    prompt: str = Field(default=DEFAULT_HEARTBEAT_PROMPT, description="Prompt template with {checklist} placeholder")
    schedule_id: Optional[str] = Field(default=None, description="TaskIQ schedule ID when registered")


class HeartbeatState(BaseModel):
    last_run_at: Optional[datetime] = None
    last_result: Optional[str] = None
    consecutive_ok_count: int = Field(default=0)
    next_due_at: Optional[datetime] = None
    total_ticks: int = Field(default=0)
    total_escalations: int = Field(default=0)
    last_escalation_at: Optional[datetime] = Field(default=None, description="For escalation rate limiting")


class HeartbeatTickResult(BaseModel):
    action: Literal["ok", "escalated", "skipped"]
    reason: str
    response: Optional[str] = None
    tokens_used: Optional[int] = None
    duration_ms: Optional[int] = None
    timestamp: datetime


class HeartbeatHistory(BaseModel):
    results: list[HeartbeatTickResult] = Field(default_factory=list)
    max_entries: int = Field(default=100)
