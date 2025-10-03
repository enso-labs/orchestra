from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from src.schemas.entities.schedule import ScheduleCreate, JobUpdated
from src.services.schedule import (
    create_trigger,
    scheduler,
    scheduled_llm_invoke_wrapper,
)
from src.services.schedule import IN_MEMORY_JOBS
from src.schemas.models import ProtectedUser
from src.utils.auth import verify_credentials

router = APIRouter(tags=["Schedule"])


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
    )

    IN_MEMORY_JOBS[job_id] = job

    print(f"✅ Scheduled job created: {scheduled_job}")
    print(f"   Job ID: {job_id}")
    print(f"   Next run time: {scheduled_job.next_run_time}")

    return JSONResponse(status_code=201, content={"job": {"id": job_id}})
