from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Response, Body, Query, Request
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache

from src.services.schedule import schedule_service
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.constants.examples import Examples
from src.schemas.entities.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    JobUpdated,
)

router = APIRouter(tags=["Schedule"])


################################################################################
### Execution History Endpoints (must be before /{schedule_id} to avoid capture)
################################################################################
@router.get(
    "/schedules/executions/recent",
    operation_id="ruska_recent_executions",
)
async def get_recent_executions(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    user: ProtectedUser = Depends(verify_credentials),
):
    from src.repos.schedule_execution_repo import ScheduleExecutionRepo

    store = request.app.state.store
    repo = ScheduleExecutionRepo(user_id=str(user.id), store=store)
    executions = await repo.get_recent(limit=limit)
    return {"executions": [e.model_dump(mode="json") for e in executions]}


@router.get(
    "/schedules/executions",
    operation_id="ruska_executions_by_date",
)
async def get_executions_by_date(
    request: Request,
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    user: ProtectedUser = Depends(verify_credentials),
):
    from src.repos.schedule_execution_repo import ScheduleExecutionRepo

    store = request.app.state.store
    repo = ScheduleExecutionRepo(user_id=str(user.id), store=store)

    if not start_date or not end_date:
        executions = await repo.get_recent(limit=50)
        return {"executions": [e.model_dump(mode="json") for e in executions]}

    executions = await repo.get_by_date_range(start_date=start_date, end_date=end_date)
    return {"executions": [e.model_dump(mode="json") for e in executions]}


################################################################################
### List Schedules
################################################################################
@router.get(
    "/schedules",
    responses={200: {"content": {"application/json": {"example": Examples.SCHEDULE_LIST_EXAMPLE}}}},
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
### Get Schedule Executions (per-schedule)
################################################################################
@router.get(
    "/schedules/{schedule_id}/executions",
    operation_id="ruska_schedule_executions",
)
async def get_schedule_executions(
    schedule_id: str,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    user: ProtectedUser = Depends(verify_credentials),
):
    from src.repos.schedule_execution_repo import ScheduleExecutionRepo

    store = request.app.state.store
    repo = ScheduleExecutionRepo(user_id=str(user.id), store=store)
    executions = await repo.get_by_schedule(schedule_id=schedule_id, limit=limit)
    return {"executions": [e.model_dump(mode="json") for e in executions]}


################################################################################
### Run Now
################################################################################
@router.post(
    "/schedules/{job_id}/run",
    operation_id="ruska_run_schedule_now",
)
async def run_job_now(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    result = await schedule_service.run_job_now(job_id)
    return result


################################################################################
### Get Schedule
################################################################################
@router.get(
    "/schedules/{job_id}",
    responses={200: {"content": {"application/json": {"example": Examples.SCHEDULE_FIND_EXAMPLE}}}},
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
    responses={201: {"content": {"application/json": {"example": Examples.SCHEDULE_CREATED_RESPONSE_EXAMPLE}}}},
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
    job_update: ScheduleUpdate = Body(openapi_examples={"update_schedule": Examples.SCHEDULE_UPDATE_EXAMPLE}),
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
@router.delete("/schedules/{job_id}", operation_id="ruska_delete_schedule", tags=["mcp"])
async def delete_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule_service.delete_job(job_id)
    return Response(status_code=204)
