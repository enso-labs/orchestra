from fastapi import APIRouter, Depends, Response, Body
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache

from src.services.cron import cron_service
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.constants.examples import Examples
from src.schemas.entities.cron import (
    CronCreate,
    CronUpdate,
    JobUpdated,
)

router = APIRouter(tags=["Cron"])


################################################################################
### List Crons
################################################################################
@router.get(
    "/crons",
    responses={200: {"content": {"application/json": {"example": Examples.SCHEDULE_LIST_EXAMPLE}}}},
    operation_id="ruska_list_crons",
    tags=["mcp"],
)
@cache(expire=30)
async def get_jobs(
    user: ProtectedUser = Depends(verify_credentials),
):
    cron_service.user_id = user.id
    crons = cron_service.get_jobs()
    return {"crons": [cron.model_dump() for cron in crons]}


################################################################################
### Get Cron
################################################################################
@router.get(
    "/crons/{job_id}",
    responses={200: {"content": {"application/json": {"example": Examples.SCHEDULE_FIND_EXAMPLE}}}},
    operation_id="ruska_get_cron",
    tags=["mcp"],
)
async def get_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    cron_service.user_id = user.id
    cron = cron_service.get_job(job_id)
    return {"cron": cron.model_dump()}


################################################################################
### Create Cron
################################################################################
@router.post(
    "/crons",
    status_code=201,
    responses={201: {"content": {"application/json": {"example": Examples.SCHEDULE_CREATED_RESPONSE_EXAMPLE}}}},
    operation_id="ruska_create_cron",
    tags=["mcp"],
)
async def create_job(
    job: CronCreate = Body(openapi_examples=Examples.SCHEDULE_CREATE_EXAMPLES),
    user: ProtectedUser = Depends(verify_credentials),
):
    cron_service.user_id = user.id
    cron = cron_service.create_job(job)
    return JSONResponse(
        status_code=201,
        content={
            "job": {
                "id": cron.id,
                "next_run_time": cron.next_run_time.isoformat(),
            }
        },
    )


################################################################################
### Update Cron
################################################################################
@router.put(
    "/crons/{job_id}",
    responses={200: {"model": JobUpdated}},
    operation_id="ruska_update_cron",
    tags=["mcp"],
)
async def update_job(
    job_id: str,
    job_update: CronUpdate = Body(openapi_examples={"update_cron": Examples.SCHEDULE_UPDATE_EXAMPLE}),
    user: ProtectedUser = Depends(verify_credentials),
):
    cron_service.user_id = user.id
    cron = cron_service.update_job(job_id, job_update)
    return JSONResponse(
        status_code=200,
        content={
            "job": {
                "id": cron.id,
                "next_run_time": cron.next_run_time.isoformat(),
            }
        },
    )


################################################################################
### Delete Cron
################################################################################
@router.delete("/crons/{job_id}", operation_id="ruska_delete_cron", tags=["mcp"])
async def delete_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    cron_service.user_id = user.id
    cron_service.delete_job(job_id)
    return Response(status_code=204)
