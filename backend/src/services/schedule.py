from uuid import uuid4
from fastapi import HTTPException
from apscheduler.triggers.cron import CronTrigger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED
from apscheduler.triggers.interval import IntervalTrigger
import logging

from src.services.db import DB_URI
from src.schemas.entities.schedule import JobTrigger, Job, Schedule

logger = logging.getLogger(__name__)

jobstores = {"default": SQLAlchemyJobStore(url=DB_URI, tablename="schedules")}
SCHEDULER = AsyncIOScheduler(jobstores=jobstores)

IN_MEMORY_JOBS = {}


# Event listeners for debugging
def job_executed(event):
    logger.info(f"Job {event.job_id} executed successfully")
    print(f"✅ Job {event.job_id} executed successfully")


def job_error(event):
    logger.error(f"Job {event.job_id} failed: {event.exception}")
    print(f"❌ Job {event.job_id} failed with error: {event.exception}")
    import traceback

    traceback.print_exception(
        type(event.exception), event.exception, event.exception.__traceback__
    )


def job_missed(event):
    logger.warning(f"Job {event.job_id} missed its scheduled time")
    print(f"⚠️ Job {event.job_id} missed its scheduled time")


# Add event listeners
SCHEDULER.add_listener(job_executed, EVENT_JOB_EXECUTED)
SCHEDULER.add_listener(job_error, EVENT_JOB_ERROR)
SCHEDULER.add_listener(job_missed, EVENT_JOB_MISSED)


def create_trigger(trigger: JobTrigger):
    if trigger.type == "cron":
        return CronTrigger.from_crontab(trigger.expression)
    if trigger.type == "interval":
        return IntervalTrigger(seconds=trigger.interval)
    else:
        raise ValueError("Invalid trigger type")


async def scheduled_llm_invoke_wrapper(task_dict: dict, metadata: dict):
    """
    Wrapper function for scheduled LLM invocations.
    Reconstructs LLMRequest from dict and invokes the LLM.
    """
    from src.schemas.entities import LLMRequest
    from src.controllers.llm import llm_invoke

    logger.info(f"🚀 Starting scheduled LLM job with task: {task_dict}")
    print(f"🚀 Starting scheduled LLM job")

    try:
        # Reconstruct LLMRequest from dict
        task = LLMRequest(**task_dict)
        logger.info(f"✓ Successfully reconstructed LLMRequest")

        # Invoke the LLM
        result = await llm_invoke(task, user_id=metadata["user_id"])
        logger.info(f"✓ LLM invocation completed successfully")
        print(f"✓ LLM invocation completed successfully")
        return result
    except Exception as e:
        logger.error(f"❌ Error in scheduled job: {e}", exc_info=True)
        print(f"❌ Error in scheduled job: {e}")
        raise


def create_job(job: Job):
    trigger = create_trigger(job.trigger)
    return Job(
        id=job.id,
        func=job.func,
        args=job.args,
        kwargs=job.kwargs,
        trigger=trigger,
    )


class ScheduleService:
    def __init__(self, user_id: str = None):
        self.user_id = user_id
        self.scheduler = SCHEDULER

    def get_jobs(self) -> list[Schedule]:
        user_schedules = []
        for schedule in self.scheduler.get_jobs():
            if schedule.kwargs["metadata"]["user_id"] == self.user_id:
                schedule = Schedule(
                    id=schedule.id,
                    title=schedule.kwargs["metadata"].get("title", "Untitled Schedule"),
                    trigger=JobTrigger.from_trigger(schedule.trigger),
                    task=schedule.args[0],
                    next_run_time=schedule.next_run_time,
                )
                user_schedules.append(schedule)
        user_schedules.sort(key=lambda x: x.next_run_time, reverse=True)
        return user_schedules

    def get_job(self, job_id: str) -> Schedule:
        job = self.scheduler.get_job(job_id)
        if job.kwargs["metadata"]["user_id"] != self.user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this job"
            )

        schedule = Schedule(
            id=job.id,
            title=job.kwargs["metadata"].get("title", "Untitled Schedule"),
            trigger=JobTrigger.from_trigger(job.trigger),
            task=job.args[0],
            next_run_time=job.next_run_time,
        )
        return schedule

    def create_job(self, job: Job) -> Schedule:
        job_id = str(uuid4())
        trigger = create_trigger(job.trigger)

        # Use wrapper function and pass dict for proper serialization
        scheduled_job = self.scheduler.add_job(
            id=job_id,
            func=scheduled_llm_invoke_wrapper,
            trigger=trigger,
            args=[job.task.model_dump()],
            kwargs={"metadata": {"user_id": self.user_id, "title": job.title}},
            replace_existing=True,
            misfire_grace_time=300,
        )

        print(f"✅ Scheduled job created: {scheduled_job}")
        print(f"   Job ID: {job_id}")
        print(f"   Next run time: {scheduled_job.next_run_time.isoformat()}")

        schedule = Schedule(
            id=job_id,
            title=job.title,
            trigger=JobTrigger.from_trigger(job.trigger),
            task=job.task,
            next_run_time=scheduled_job.next_run_time.isoformat(),
        )
        return schedule

    def update_job(self, job_id: str, job_update: Job) -> Schedule:
        # Get existing job and verify ownership
        existing_job = self.scheduler.get_job(job_id)
        if not existing_job:
            raise HTTPException(status_code=404, detail="Schedule not found")

        if existing_job.kwargs["metadata"]["user_id"] != self.user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this job"
            )

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
        self.scheduler.modify_job(job_id, **update_params)

        # Get the updated job to return current state
        updated_job = self.scheduler.get_job(job_id)

        print(f"✅ Scheduled job updated: {updated_job}")
        print(f"   Job ID: {job_id}")
        print(f"   Next run time: {updated_job.next_run_time.isoformat()}")

        schedule = Schedule(
            id=job_id,
            title=job_update.title,
            trigger=JobTrigger.from_trigger(job_update.trigger),
            task=job_update.task,
            next_run_time=updated_job.next_run_time.isoformat(),
        )
        return schedule

    def delete_job(self, job_id: str) -> None:
        try:
            job = self.scheduler.get_job(job_id)
            if job.kwargs["metadata"]["user_id"] != self.user_id:
                raise HTTPException(
                    status_code=403, detail="Not authorized to access this job"
                )
            self.scheduler.remove_job(job_id)

            print(f"✅ Scheduled job deleted: {job_id}")
            print(f"   Job ID: {job_id}")
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete job: {e}")


schedule_service = ScheduleService()
