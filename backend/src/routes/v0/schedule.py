from uuid import uuid4

from fastapi import APIRouter, Depends, Response, HTTPException, Body
from fastapi.responses import JSONResponse
from src.schemas.entities.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    JobUpdated,
    Schedule,
    JobTrigger,
)
from src.services.schedule import (
    create_trigger,
    scheduler,
    scheduled_llm_invoke_wrapper,
)
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials
from src.constants.examples import Examples

router = APIRouter(tags=["Schedule"])


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
    jobs = scheduler.get_jobs()
    user_jobs = []
    for job in jobs:
        if job.kwargs["metadata"]["user_id"] == user.id:
            schedule = Schedule(
                id=job.id,
                title=job.kwargs["metadata"].get("title", "Untitled Schedule"),
                trigger=JobTrigger.from_trigger(job.trigger),
                task=job.args[0],
                next_run_time=job.next_run_time,
            )
            user_jobs.append(schedule.model_dump())

    return {"schedules": user_jobs}


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
    job = scheduler.get_job(job_id)
    if job.kwargs["metadata"]["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    schedule = Schedule(
        id=job.id,
        title=job.kwargs["metadata"].get("title", "Untitled Schedule"),
        trigger=JobTrigger.from_trigger(job.trigger),
        task=job.args[0],
        next_run_time=job.next_run_time,
    )
    return {"schedule": schedule.model_dump()}


@router.post("/schedules", status_code=201, responses={201: {"model": JobUpdated}})
async def create_job(
    job: ScheduleCreate = Body(
        openapi_examples={"create_schedule": Examples.SCHEDULE_CREATE_EXAMPLE}
    ),
    user: ProtectedUser = Depends(verify_credentials),
):
    job_id = str(uuid4())
    trigger = create_trigger(job.trigger)

    # Use wrapper function and pass dict for proper serialization
    scheduled_job = scheduler.add_job(
        id=job_id,
        func=scheduled_llm_invoke_wrapper,
        trigger=trigger,
        args=[job.task.model_dump()],
        kwargs={"metadata": {"user_id": user.id, "title": job.title}},
        replace_existing=True,
        misfire_grace_time=300,
    )

    print(f"✅ Scheduled job created: {scheduled_job}")
    print(f"   Job ID: {job_id}")
    print(f"   Next run time: {scheduled_job.next_run_time.isoformat()}")

    return JSONResponse(
        status_code=201,
        content={
            "job": {
                "id": job_id,
                "next_run_time": scheduled_job.next_run_time.isoformat(),
            }
        },
    )


@router.put("/schedules/{job_id}", responses={200: {"model": JobUpdated}})
async def update_job(
    job_id: str,
    job_update: ScheduleUpdate = Body(
        openapi_examples={"update_schedule": Examples.SCHEDULE_UPDATE_EXAMPLE}
    ),
    user: ProtectedUser = Depends(verify_credentials),
):
    # Get existing job and verify ownership
    existing_job = scheduler.get_job(job_id)
    if not existing_job:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if existing_job.kwargs["metadata"]["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    # Prepare update parameters
    update_params = {}

    if job_update.trigger is not None:
        update_params["trigger"] = create_trigger(job_update.trigger)

    if job_update.task is not None:
        update_params["args"] = [job_update.task.model_dump()]

    # Handle title update by updating kwargs metadata
    if job_update.title is not None:
        current_metadata = existing_job.kwargs.get("metadata", {})
        current_metadata["title"] = job_update.title
        update_params["kwargs"] = {"metadata": current_metadata}

    # Update the job using modify_job
    scheduler.modify_job(job_id, **update_params)

    # Get the updated job to return current state
    updated_job = scheduler.get_job(job_id)

    print(f"✅ Scheduled job updated: {updated_job}")
    print(f"   Job ID: {job_id}")
    print(f"   Next run time: {updated_job.next_run_time.isoformat()}")

    return JSONResponse(
        status_code=200,
        content={
            "job": {
                "id": job_id,
                "next_run_time": updated_job.next_run_time.isoformat(),
            }
        },
    )


@router.delete("/schedules/{job_id}")
async def delete_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    job = scheduler.get_job(job_id)
    if job.kwargs["metadata"]["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    scheduler.remove_job(job_id)
    return Response(status_code=204)
