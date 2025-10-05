from uuid import uuid4

from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import JSONResponse
from src.schemas.entities.schedule import (
    ScheduleCreate,
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

router = APIRouter(tags=["Schedule"])


@router.get("/schedules")
async def get_jobs(
    user: ProtectedUser = Depends(verify_credentials),
):
    jobs = scheduler.get_jobs()
    user_jobs = []
    for job in jobs:
        if job.kwargs["metadata"]["user_id"] == user.id:
            schedule = Schedule(
                id=job.id,
                trigger=JobTrigger.from_trigger(job.trigger),
                task=job.args[0],
                next_run_time=job.next_run_time.isoformat(),
            )
            user_jobs.append(schedule.model_dump())

    return {"schedules": user_jobs}


@router.get("/schedules/{job_id}")
async def get_job(
    job_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    job = scheduler.get_job(job_id)
    if job.kwargs["metadata"]["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")

    schedule = Schedule(
        id=job.id,
        trigger=JobTrigger.from_trigger(job.trigger),
        task=job.args[0],
        # created_at=job.created_at,
        # updated_at=job.updated_at,
    )
    return {"schedule": schedule.model_dump()}


@router.post("/schedules", status_code=201, responses={201: {"model": JobUpdated}})
async def create_job(
    job: ScheduleCreate,
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
        kwargs={"metadata": {"user_id": user.id}},
        replace_existing=True,
        misfire_grace_time=300,
    )

    print(f"✅ Scheduled job created: {scheduled_job}")
    print(f"   Job ID: {job_id}")
    print(f"   Next run time: {scheduled_job.next_run_time}")

    return JSONResponse(status_code=201, content={"job": {"id": job_id}})


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
