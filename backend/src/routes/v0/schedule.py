from fastapi import APIRouter, Depends, Response, Body
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache

from src.services.schedule import schedule_service
from src.services.schedule_execution import schedule_execution_service
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.constants.examples import Examples
from src.schemas.entities.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleExecutionResponse,
    JobUpdated,
)

router = APIRouter(tags=["Schedule"])


################################################################################
### List Schedules
################################################################################
@router.get(
    "/schedules",
    responses={
        200: {
            "content": {"application/json": {"example": Examples.SCHEDULE_LIST_EXAMPLE}}
        }
    },
    operation_id="ruska_list_schedules",
    tags=["mcp"],
)
@cache(expire=30)
async def get_jobs(
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedules = schedule_service.get_jobs()
    return {"schedules": [schedule.model_dump() for schedule in schedules]}


################################################################################
### Recent Executions
################################################################################
@router.get(
    "/schedules/executions/recent",
    response_model=list[ScheduleExecutionResponse],
    operation_id="ruska_list_recent_executions",
)
async def get_recent_executions(
    limit: int = 20,
    user: ProtectedUser = Depends(verify_credentials),
):
    executions = await schedule_execution_service.get_recent_executions(
        user_id=user.id,
        limit=limit,
    )
    return [
        ScheduleExecutionResponse(
            id=str(e.id),
            schedule_id=e.schedule_id,
            thread_id=e.thread_id,
            status=e.status,
            scheduled_time=e.scheduled_time,
            started_at=e.started_at,
            completed_at=e.completed_at,
            error_message=e.error_message,
            metadata=e.metadata or {},
            user_id=e.user_id,
        )
        for e in executions
    ]


################################################################################
### Get Schedule
################################################################################
@router.get(
    "/schedules/{job_id}",
    responses={
        200: {
            "content": {"application/json": {"example": Examples.SCHEDULE_FIND_EXAMPLE}}
        }
    },
    operation_id="ruska_get_schedule",
    tags=["mcp"],
)
async def get_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule = schedule_service.get_job(job_id)
    return {"schedule": schedule.model_dump()}


################################################################################
### Create Schedule
################################################################################
@router.post(
    "/schedules",
    status_code=201,
    responses={
        201: {
            "content": {
                "application/json": {
                    "example": Examples.SCHEDULE_CREATED_RESPONSE_EXAMPLE
                }
            }
        }
    },
    operation_id="ruska_create_schedule",
    tags=["mcp"],
)
async def create_job(
    job: ScheduleCreate = Body(openapi_examples=Examples.SCHEDULE_CREATE_EXAMPLES),
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule = schedule_service.create_job(job)
    return JSONResponse(
        status_code=201,
        content={
            "job": {
                "id": schedule.id,
                "next_run_time": schedule.next_run_time.isoformat(),
            }
        },
    )


################################################################################
### Update Schedule
################################################################################
@router.put(
    "/schedules/{job_id}",
    responses={200: {"model": JobUpdated}},
    operation_id="ruska_update_schedule",
    tags=["mcp"],
)
async def update_job(
    job_id: str,
    job_update: ScheduleUpdate = Body(
        openapi_examples={"update_schedule": Examples.SCHEDULE_UPDATE_EXAMPLE}
    ),
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule = schedule_service.update_job(job_id, job_update)
    return JSONResponse(
        status_code=200,
        content={
            "job": {
                "id": schedule.id,
                "next_run_time": schedule.next_run_time.isoformat(),
            }
        },
    )


################################################################################
### Delete Schedule
################################################################################
@router.delete(
    "/schedules/{job_id}", operation_id="ruska_delete_schedule", tags=["mcp"]
)
async def delete_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule_service.delete_job(job_id)
    return Response(status_code=204)
