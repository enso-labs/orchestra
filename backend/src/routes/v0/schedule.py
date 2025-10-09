from fastapi import APIRouter, Depends, Response, HTTPException, Body
from fastapi.responses import JSONResponse

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
### List Schedules
################################################################################
@router.get(
    "/schedules",
    responses={
        200: {
            "content": {"application/json": {"example": Examples.SCHEDULE_LIST_EXAMPLE}}
        }
    },
)
async def get_jobs(
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedules = schedule_service.get_jobs()
    return {"schedules": [schedule.model_dump() for schedule in schedules]}


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
@router.post("/schedules", status_code=201, responses={201: {"model": JobUpdated}})
async def create_job(
    job: ScheduleCreate = Body(
        openapi_examples={"create_schedule": Examples.SCHEDULE_CREATE_EXAMPLE}
    ),
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
@router.put("/schedules/{job_id}", responses={200: {"model": JobUpdated}})
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
@router.delete("/schedules/{job_id}")
async def delete_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    schedule_service.user_id = user.id
    schedule_service.delete_job(job_id)
    return Response(status_code=204)
