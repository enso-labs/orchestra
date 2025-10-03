from pydantic import BaseModel, Field
from typing import Callable
from uuid import uuid4
from fastapi.openapi.models import Example

from src.schemas.entities import LLMRequest


class JobTrigger(BaseModel):
    type: str = Field(..., example="cron")
    expression: str = Field(..., example="0 0 * * *")


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
