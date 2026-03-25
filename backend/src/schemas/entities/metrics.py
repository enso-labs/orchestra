from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field
from src.constants.phases import AgentPhase


class TurnMetrics(BaseModel):
    """Per-LLM-call metrics captured by the cost tracking middleware."""

    turn_id: str
    thread_id: str
    agent_phase: str = AgentPhase.SOLO
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    estimated_cost_usd: float = 0.0
    duration_seconds: float = 0.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ThreadCostSummary(BaseModel):
    """Aggregate cost data for a thread."""

    thread_id: str
    total_cost_usd: float = 0.0
    total_duration_seconds: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    cost_by_phase: dict[str, float] = Field(default_factory=dict)
    turn_count: int = 0


class RunBudget(BaseModel):
    """Budget cap configuration for a thread or assistant."""

    max_cost_usd: Optional[float] = None
    max_duration_minutes: Optional[float] = None
    action_on_exceed: Literal["pause", "stop", "warn"] = "warn"
