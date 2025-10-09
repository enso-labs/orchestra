from pydantic import BaseModel, Field, field_validator
from typing import Callable, Optional
from uuid import uuid4
from datetime import datetime

from src.schemas.entities import LLMRequest
from apscheduler.triggers.cron import CronTrigger


class JobTrigger(BaseModel):
    type: str = Field(..., json_schema_extra={"example": "cron"})
    expression: str = Field(..., json_schema_extra={"example": " 0 1 * * *"})

    @field_validator("expression")
    def validate_expression(cls, v: str) -> str:
        # Ensure the cron expression represents a schedule of at least 1 hour
        # Cron format: second minute hour day month day_of_week (6 fields)
        fields = v.strip().split(" ")
        if len(fields) < 5:
            raise ValueError("Cron expression must have at least 5 fields")
        # Accept both 5-field and 6-field cron expressions
        # The hour field is at index 2 for 6-field, 1 for 5-field
        if len(fields) == 6:
            hour_field = fields[2]
            minute_field = fields[1]
        else:
            hour_field = fields[1]
            minute_field = fields[0]
        # If minute field is '*' or '*/1', it runs every minute (less than 1 hour)
        # If hour field is '*', it runs every hour or more frequently
        # We want to ensure the minimum interval is 1 hour
        if minute_field in ("*", "*/1"):
            raise ValueError(
                "Cron expression must not schedule more frequently than 1 hour (minute field must not be '*' or '*/1')"
            )
        if hour_field == "*":
            raise ValueError(
                "Cron expression must not schedule more frequently than 1 hour (hour field must not be '*')"
            )
        return v

    @classmethod
    def from_trigger(cls, trigger: CronTrigger) -> "JobTrigger":
        """Create model from APScheduler CronTrigger or JobTrigger"""
        if isinstance(trigger, JobTrigger):
            return trigger
        trigger.fields.reverse()
        trigger.fields.pop(0)
        expr = " ".join(str(f) for f in trigger.fields[:5])
        return cls(type="cron", expression=expr)


class JobId(BaseModel):
    id: str = Field(..., json_schema_extra={"example": str(uuid4())})


class Job(JobId):
    trigger: JobTrigger
    func: str | Callable = Field(..., json_schema_extra={"example": "src.jobs.my_job"})
    args: list = Field(default_factory=list)
    kwargs: dict = Field(default_factory=dict)


class JobCreate(BaseModel):
    trigger: JobTrigger
    func: str = Field(..., json_schema_extra={"example": "src.jobs.my_job"})
    args: list = Field(default_factory=list)
    kwargs: dict = Field(default_factory=dict)

    model_config = {
        "arbitrary_types_allowed": True,
        "json_schema_extra": {
            "example": {
                "trigger": {"type": "cron", "expression": "0 0 * * *"},
                "func": "src.jobs.my_job",
                "args": [],
                "kwargs": {},
            }
        },
    }


class JobUpdated(BaseModel):
    job: Job = Field(
        ...,
        json_schema_extra={"example": {"id": "123e4567-e89b-12d3-a456-426614174000"}},
    )

    model_config = {
        "json_schema_extra": {
            "example": {"job": {"id": "123e4567-e89b-12d3-a456-426614174000"}}
        }
    }


class JobList(BaseModel):
    jobs: list[Job] = Field(...)

    model_config = {
        "json_schema_extra": {
            "example": {
                "jobs": [
                    {
                        "job_id": "123e4567-e89b-12d3-a456-426614174000",
                        "trigger": {"type": "cron", "expression": "0 0 * * *"},
                        "func": "src.jobs.my_job",
                        "args": [],
                        "kwargs": {},
                    }
                ]
            }
        }
    }


class JobDeleted(BaseModel):
    message: str = Field(..., json_schema_extra={"example": "Job deleted successfully"})

    model_config = {
        "json_schema_extra": {"example": {"message": "Job deleted successfully"}}
    }


######################################################


class ScheduleCreate(BaseModel):
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        json_schema_extra={"example": "Daily Weather Check"},
    )
    trigger: JobTrigger
    task: LLMRequest

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Daily Weather Check",
                "trigger": {"type": "cron", "expression": "* * * * *"},
                "task": {
                    "model": "openai:gpt-5-nano",
                    "system": "You are a helpful assistant.",
                    "messages": [{"role": "user", "content": "Weather in Dallas?"}],
                    "tools": [],
                    "a2a": {},
                    "mcp": {},
                    "subagents": [],
                    "metadata": {},
                },
            }
        }
    }


class ScheduleUpdate(BaseModel):
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        json_schema_extra={"example": "Updated Daily Weather Check"},
    )
    trigger: Optional[JobTrigger] = None
    task: Optional[LLMRequest] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "title": "Updated Daily Weather Check",
                "trigger": {"type": "cron", "expression": "0 2 * * *"},
                "task": {
                    "model": "openai:gpt-5-nano",
                    "system": "You are a helpful assistant.",
                    "messages": [
                        {"role": "user", "content": "Updated weather check for Dallas?"}
                    ],
                    "tools": [],
                    "a2a": {},
                    "mcp": {},
                    "subagents": [],
                    "metadata": {},
                },
            }
        }
    }


class Schedule(BaseModel):
    id: str = Field(..., json_schema_extra={"example": str(uuid4())})
    title: str = Field(..., json_schema_extra={"example": "Daily Weather Check"})
    trigger: JobTrigger
    task: LLMRequest
    next_run_time: datetime = Field(..., json_schema_extra={"example": datetime.now()})
