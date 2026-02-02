from datetime import datetime, timedelta

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, Response, Body
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


def _get_projected_executions(
    user_id: str,
    start: datetime,
    end: datetime,
) -> list[ScheduleExecutionResponse]:
    """Generate projected future executions from cron expressions for all user schedules."""
    projections: list[ScheduleExecutionResponse] = []
    for schedule in schedule_service.get_jobs():
        cron_expr = schedule.trigger.expression.strip()
        try:
            cron = croniter(cron_expr, start)
        except (ValueError, KeyError):
            continue
        while True:
            next_time: datetime = cron.get_next(datetime)
            if next_time > end:
                break
            projections.append(
                ScheduleExecutionResponse(
                    id=f"{schedule.id}_proj_{next_time.isoformat()}",
                    schedule_id=schedule.id,
                    status="scheduled",
                    scheduled_time=next_time,
                    metadata={},
                    user_id=user_id,
                )
            )
    return projections


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
    results = [
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

    # Add projected future executions
    now = datetime.utcnow()
    schedule_service.user_id = user.id
    projections = _get_projected_executions(user.id, now, now + timedelta(days=30))
    results.extend(projections)
    results.sort(key=lambda x: x.scheduled_time, reverse=True)
    return results


################################################################################
### Executions by Date Range
################################################################################
@router.get(
    "/schedules/executions",
    response_model=list[ScheduleExecutionResponse],
    operation_id="ruska_list_executions",
)
async def get_executions(
    start: datetime | None = None,
    end: datetime | None = None,
    user: ProtectedUser = Depends(verify_credentials),
):
    effective_end = end if end is not None else datetime.utcnow()
    effective_start = (
        start if start is not None else (effective_end - timedelta(days=30))
    )

    executions = await schedule_execution_service.get_executions_by_date_range(
        user_id=user.id,
        start=effective_start,
        end=effective_end,
    )
    results = [
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

    # Add projected future executions within date range
    now = datetime.utcnow()
    if effective_end > now:
        proj_start = max(effective_start, now)
        schedule_service.user_id = user.id
        projections = _get_projected_executions(user.id, proj_start, effective_end)
        results.extend(projections)
    results.sort(key=lambda x: x.scheduled_time, reverse=True)
    return results


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


################################################################################
### Schedule Executions by Schedule ID
################################################################################
@router.get(
    "/schedules/{schedule_id}/executions",
    response_model=list[ScheduleExecutionResponse],
    operation_id="ruska_list_schedule_executions",
)
async def get_schedule_executions(
    schedule_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    # Verify schedule exists and belongs to user (raises 403 if not)
    try:
        schedule_service.user_id = user.id
        schedule_service.get_job(schedule_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Schedule not found")

    executions = await schedule_execution_service.get_executions_by_schedule(
        schedule_id=schedule_id,
        user_id=user.id,
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
