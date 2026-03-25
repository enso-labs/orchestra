from typing import Literal, Optional

from pydantic import BaseModel


class PlannerConfig(BaseModel):
    """Configuration for the planner pre-execution phase."""

    enabled: bool = False
    auto_approve: bool = True  # False = pause for user approval via HITL
    model: Optional[str] = None  # Override model for planner (e.g., use Opus)
    scope_level: Literal["conservative", "ambitious"] = "ambitious"
