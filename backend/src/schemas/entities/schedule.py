from pydantic import BaseModel, Field
from typing import Callable
from uuid import uuid4
from fastapi.openapi.models import Example
from datetime import datetime

from src.schemas.entities import LLMRequest
from apscheduler.triggers.cron import CronTrigger


class JobTrigger(BaseModel):
    type: str = Field(..., example="cron")
    expression: str = Field(..., example="0 0 * * *")

    @classmethod
    def from_trigger(cls, trigger: CronTrigger) -> "JobTrigger":
        """Create model from APScheduler CronTrigger"""
        expr = " ".join(str(f) for f in trigger.fields[:6])
        return cls(type="cron", expression=expr)


class JobId(BaseModel):
    id: str = Field(..., example=str(uuid4()))


class Job(JobId):
    trigger: JobTrigger
    func: str | Callable = Field(..., example="src.jobs.my_job")
    args: list = Field(default_factory=list)
    kwargs: dict = Field(default_factory=dict)


class JobCreate(BaseModel):
    trigger: JobTrigger
    func: str = Field(..., example="src.jobs.my_job")
    args: list = Field(default_factory=list)
    kwargs: dict = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True
        example = {
            "trigger": {"type": "cron", "expression": "0 0 * * *"},
            "func": "src.jobs.my_job",
            "args": [],
            "kwargs": {},
        }


class JobUpdated(BaseModel):
    job: Job = Field(..., example={"id": "123e4567-e89b-12d3-a456-426614174000"})

    class Config:
        example = {"job": {"id": "123e4567-e89b-12d3-a456-426614174000"}}


class JobList(BaseModel):
    jobs: list[Job] = Field(...)

    class Config:
        example = {
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


class JobDeleted(BaseModel):
    message: str = Field(..., example="Job deleted successfully")

    class Config:
        example = {"message": "Job deleted successfully"}


######################################################


class ScheduleCreate(BaseModel):
    trigger: JobTrigger
    task: LLMRequest

    model_config = {
        "json_schema_extra": {
            "example": {
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


class Schedule(BaseModel):
    id: str = Field(..., example=str(uuid4()))
    trigger: JobTrigger
    task: LLMRequest
    next_run_time: datetime = Field(..., example=datetime.now())
