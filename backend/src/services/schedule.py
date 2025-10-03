from apscheduler.triggers.cron import CronTrigger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED
from apscheduler.triggers.interval import IntervalTrigger
import logging

from src.services.db import DB_URI
from src.schemas.entities.schedule import JobTrigger, Job

logger = logging.getLogger(__name__)

jobstores = {"default": SQLAlchemyJobStore(url=DB_URI)}
scheduler = AsyncIOScheduler(jobstores=jobstores)

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
scheduler.add_listener(job_executed, EVENT_JOB_EXECUTED)
scheduler.add_listener(job_error, EVENT_JOB_ERROR)
scheduler.add_listener(job_missed, EVENT_JOB_MISSED)


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
