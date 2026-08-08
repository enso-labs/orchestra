from uuid import uuid4

from apscheduler.triggers.cron import CronTrigger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR, EVENT_JOB_MISSED
from apscheduler.triggers.interval import IntervalTrigger
from src.schemas.contexts import ContextSchema
from src.utils.logger import logger
import ujson
from langgraph.store.base import BaseStore

from src.services.db import DB_URI, get_store_in_memory
from src.schemas.entities.schedule import JobTrigger, Job, Schedule
from src.utils.format import get_time

jobstores = {"default": SQLAlchemyJobStore(url=DB_URI, tablename="schedules")}
SCHEDULER = AsyncIOScheduler(jobstores=jobstores)

IN_MEMORY_JOBS = {}


# Event listeners for debugging
def job_executed(event):
    logger.info(f"Job {event.job_id} executed successfully")


def job_error(event):
    logger.exception(f"Job {event.job_id} failed: {event.exception}")


def job_missed(event):
    logger.warning(f"Job {event.job_id} missed its scheduled time")


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


async def scheduled_llm_invoke(task_dict: dict, user_id: str, title: str = None):
    """
    Standalone function for scheduled LLM invocations.
    This must be a module-level function (not a method) so APScheduler can pickle it.
    """
    from uuid import uuid4
    from src.constants import DISTRIBUTED_WORKERS

    # Distributed mode: dispatch to TaskIQ worker
    if DISTRIBUTED_WORKERS:
        from src.workers.tasks import run_agent_stream

        metadata = task_dict.get("metadata") or {}
        thread_id = metadata.get("thread_id") or str(uuid4())
        logger.info(f"🚀 Dispatching scheduled job '{title}' to TaskIQ worker (thread_id={thread_id})")
        await run_agent_stream.kiq(
            task_dict=task_dict,
            user_id=user_id,
            thread_id=thread_id,
        )
        return

    # In-process mode: execute directly
    from src.schemas.entities import LLMRequest
    from src.agents import construct_agent, Orchestra, init_config
    from src.services.db import RunScopedStore, get_checkpoint_db, get_shared_store
    from src.services.context_files import resolve_context_files, select_memory_sources
    from src.contexts.service import ServiceContext
    from src.agents import prepare_memory_files

    logger.info(f"🚀 Starting scheduled LLM job: {title}")

    # Reconstruct LLMRequest from dict
    params = LLMRequest(**task_dict)
    params.metadata.user_id = user_id
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    logger.info("✓ Successfully reconstructed LLMRequest")

    # Initialize config and get files and todos
    config = init_config(params, user_id)
    files_map = config["metadata"].get("files", {})
    todos_list = config["metadata"].get("todos", [])

    # Process-level singleton (#957). This job runs on the API's event loop -- the
    # scheduler is an AsyncIOScheduler started in the FastAPI lifespan -- so it shares
    # the store the app already holds instead of opening a second pool. Wrapped so
    # this run's `fields` assignment below stays local to it. Never `async with` it.
    store = RunScopedStore(await get_shared_store())
    async with get_checkpoint_db() as checkpointer:
        try:
            service_context = ServiceContext(user_id=user_id, store=store, config=config, checkpointer=checkpointer)
            params = await service_context.llm_service.assistant(params)
            memory_files, _memory_sources = await prepare_memory_files(user_id, service_context.memory_service)
            explicit_files = {
                **(files_map or {}),
                **(params.input.files or {}),
            }
            memory_sources = select_memory_sources(
                explicit_files=explicit_files,
                memory_files=memory_files,
            )
            selected_memory_files = {path: memory_files[path] for path in (memory_sources or [])}
            params.input.files = await resolve_context_files(
                user_id=user_id,
                store=store,
                memory_files=selected_memory_files,
                explicit_files=explicit_files,
            )
            agent: Orchestra = await construct_agent(
                instructions=params.instructions,
                system_prompt=params.system_prompt,
                tools=params.tools,
                model=params.model,
                subagents=params.subagents,
                checkpointer=checkpointer,
                service_context=service_context,
                memory=memory_sources,
                reasoning_effort=params.reasoning_effort,
            )
            params.input.messages[-1].model = agent.model
            # Avoid isinstance checks with subscripted generics—use duck typing or explicit conversion
            try:
                # If messages are not yet LangChain messages (i.e., last one lacks 'type'), convert
                if not hasattr(params.input.messages[-1], "type"):
                    params.input = params.input.to_langchain_messages()
            except Exception:
                # Defensive fallback for malformed input
                params.input = params.input.to_langchain_messages()

            ctx_schema = ContextSchema(model=params.model, user_id=user_id)
            response = await agent.invoke(params.input, config=config, context=ctx_schema)
            logger.info("✓ LLM invocation completed successfully")

            files_map = {**(params.input.files or {}), **response.get("files", {})}
            todos_list = [*todos_list, *response.get("todos", [])]
            return response
        except Exception as e:
            logger.error(f"❌ Error in scheduled job: {e}", exc_info=True)
            raise
        finally:
            if service_context.user_id and service_context.checkpointer:
                final_state = await agent.graph.aget_state(config)
                configurable = {
                    **final_state.config.get("configurable", {}),
                    **config["configurable"],
                }
                messages = final_state.values.get("messages", [])
                messages[-1].model = agent.model
                service_context.store.fields = ["messages", "files"]
                await service_context.thread_service.update(
                    thread_id=configurable.get("thread_id"),
                    data={
                        "thread_id": configurable.get("thread_id"),
                        "checkpoint_id": configurable.get("checkpoint_id"),
                        "assistant_id": configurable.get("assistant_id"),
                        "project_id": configurable.get("project_id"),
                        "messages": messages,
                        "todos": todos_list,
                        "files": files_map,
                        "updated_at": get_time(),
                    },
                )
                logger.info(f"checkpoint: {ujson.dumps(configurable)}")


async def scheduled_prompt_distillation():
    """Daily scheduled job that distills accumulated trajectories into improved prompts.

    Iterates over all (user_id, assistant_id) pairs with stored trajectories,
    skips those with no new trajectories since last distillation, and runs
    PromptOptimizer.distill() for eligible agents.

    This must be a module-level function (not a method) so APScheduler can pickle it.
    All errors are caught per-agent so one failure does not crash the scheduler.
    """
    from src.services.db import RunScopedStore, get_shared_store
    from src.services.prompt.optimize import PromptOptimizer
    from src.constants.llm import DEFAULT_CHAT_MODEL
    from src.utils.format import get_time

    logger.info("prompt_distillation_job_started")

    processed = 0
    skipped = 0
    errors = 0

    try:
        # Process-level singleton (#957) -- this job runs on the API's event loop, so
        # it shares the app's store rather than opening a second pool. Wrapped for
        # `fields` isolation; never `async with` it, we do not own its lifecycle.
        store = RunScopedStore(await get_shared_store())
        # Discover trajectory namespaces: (user_id, "trajectories", assistant_id)
        trajectory_namespaces: list[tuple[str, ...]] = []
        offset = 0
        while True:
            batch = await store.alist_namespaces(max_depth=3, limit=100, offset=offset)
            for ns in batch:
                if len(ns) == 3 and ns[1] == "trajectories":
                    trajectory_namespaces.append(ns)
            if len(batch) < 100:
                break
            offset += 100

        if not trajectory_namespaces:
            logger.info("prompt_distillation_no_trajectories")
            return

        optimizer = PromptOptimizer(model=DEFAULT_CHAT_MODEL)

        for ns in trajectory_namespaces:
            user_id, _, assistant_id = ns
            try:
                # Count current trajectories
                items = await store.asearch(ns, limit=100)
                current_count = len(items)
                if current_count == 0:
                    skipped += 1
                    continue

                # Check if trajectory count has changed since last distillation
                meta_ns = ("system", "distillation_meta")
                meta_key = f"{user_id}:{assistant_id}"
                meta_item = await store.aget(meta_ns, meta_key)
                last_count = 0
                if meta_item and meta_item.value:
                    last_count = meta_item.value.get("last_count", 0)

                if current_count <= last_count:
                    skipped += 1
                    continue

                # Run distillation
                revision_id = await optimizer.distill(user_id, assistant_id, store)

                # Record distillation metadata
                await store.aput(
                    namespace=meta_ns,
                    key=meta_key,
                    value={"last_count": current_count, "last_distilled_at": get_time()},
                )

                if revision_id:
                    processed += 1
                    logger.info(
                        "prompt_distillation_agent_completed",
                        extra={
                            "event": "prompt_distillation_agent_completed",
                            "user_id": user_id,
                            "assistant_id": assistant_id,
                            "revision_id": revision_id,
                        },
                    )
                else:
                    skipped += 1

            except Exception as e:
                errors += 1
                logger.error(
                    "prompt_distillation_agent_error",
                    extra={
                        "event": "prompt_distillation_agent_error",
                        "user_id": user_id,
                        "assistant_id": assistant_id,
                        "error": str(e),
                    },
                )
                continue

    except Exception as e:
        logger.error(
            "prompt_distillation_job_failed",
            extra={"event": "prompt_distillation_job_failed", "error": str(e)},
        )

    logger.info(
        "prompt_distillation_job_completed",
        extra={
            "event": "prompt_distillation_job_completed",
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
        },
    )


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
    def __init__(self, user_id: str = None, store: BaseStore = None):
        self.user_id = user_id
        self.store = store or get_store_in_memory()
        self.scheduler = SCHEDULER

    def get_jobs(self) -> list[Schedule]:
        user_schedules = []
        for job in self.scheduler.get_jobs():
            if job.kwargs.get("user_id") == self.user_id:
                schedule = Schedule(
                    id=job.id,
                    title=job.kwargs.get("title", "Untitled Schedule"),
                    trigger=JobTrigger.from_trigger(job.trigger),
                    task=job.args[0],
                    next_run_time=job.next_run_time,
                )
                user_schedules.append(schedule)
        user_schedules.sort(key=lambda x: x.next_run_time, reverse=True)
        return user_schedules

    def get_job(self, job_id: str) -> Schedule:
        job = self.scheduler.get_job(job_id)
        if job.kwargs.get("user_id") != self.user_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Not authorized to access this job")

        schedule = Schedule(
            id=job.id,
            title=job.kwargs.get("title", "Untitled Schedule"),
            trigger=JobTrigger.from_trigger(job.trigger),
            task=job.args[0],
            next_run_time=job.next_run_time,
        )
        return schedule

    def create_job(self, job: Job) -> Schedule:
        job_id = str(uuid4())
        trigger = create_trigger(job.trigger)

        # Use standalone function for proper pickling by APScheduler
        scheduled_job = self.scheduler.add_job(
            id=job_id,
            func=scheduled_llm_invoke,
            trigger=trigger,
            args=[job.task.model_dump()],
            kwargs={"user_id": self.user_id, "title": job.title},
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
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Schedule not found")

        if existing_job.kwargs.get("user_id") != self.user_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Not authorized to access this job")

        # Prepare update parameters
        update_params = {}

        if job_update.trigger is not None:
            update_params["trigger"] = create_trigger(job_update.trigger)

        if job_update.task is not None:
            update_params["args"] = [job_update.task.model_dump()]

        # Handle title update by updating kwargs
        if job_update.title is not None:
            current_kwargs = existing_job.kwargs.copy()
            current_kwargs["title"] = job_update.title
            update_params["kwargs"] = current_kwargs

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
            if job.kwargs.get("user_id") != self.user_id:
                from fastapi import HTTPException

                raise HTTPException(status_code=403, detail="Not authorized to access this job")
            self.scheduler.remove_job(job_id)

            print(f"✅ Scheduled job deleted: {job_id}")
            print(f"   Job ID: {job_id}")
            return True
        except Exception as e:
            from fastapi import HTTPException

            raise HTTPException(status_code=500, detail=f"Failed to delete job: {e}")


schedule_service = ScheduleService()
