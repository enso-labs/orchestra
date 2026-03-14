from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ScheduleExecution(BaseModel):
    id: str
    schedule_id: str
    thread_id: Optional[str] = None
    status: str = "scheduled"  # scheduled | running | success | failure | skipped
    scheduled_time: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
