from typing import Optional
from langchain_core.runnables import RunnableConfig
from langgraph.pregel.main import BaseCheckpointSaver
from src.services.schedule import ScheduleService
from src.services.llm import LLMService
from src.services.project import ProjectService
from src.services.checkpoint import CheckpointService
from src.services.thread import ThreadService
from src.services.assistant import AssistantService
from src.services.prompt import PromptService
from langgraph.store.base import BaseStore
from src.utils.logger import logger
from src.services.memory import MemoryService
from src.services.tool import ToolService
from src.services.db import get_store_in_memory


class ServiceContext:
    def __init__(
        self,
        user_id: str = None,
        config: RunnableConfig = None,
        store: BaseStore = None,
        checkpointer: Optional[BaseCheckpointSaver] = None,
    ):
        self.config = config
        self.store = store or get_store_in_memory()
        self.checkpointer = checkpointer
        self.user_id = user_id or (
            config["configurable"].get("user_id", None) or config["metadata"].get("user_id", None)
        )

        self.tool_service = ToolService(user_id=self.user_id, store=store)
        self.memory_service = MemoryService(user_id=self.user_id, store=store)
        self.thread_service = ThreadService(user_id=self.user_id, store=store)
        self.prompt_service = PromptService(user_id=self.user_id, store=store)
        self.project_service = ProjectService(user_id=self.user_id, store=store)
        self.schedule_service = ScheduleService(user_id=self.user_id, store=store)
        self.assistant_service = AssistantService(user_id=self.user_id, store=store)
        self.llm_service = LLMService(
            user_id=self.user_id,
            store=store,
            tool_service=self.tool_service,
            assistant_service=self.assistant_service,
            config=config,
        )
        if checkpointer:
            self.checkpoint_service = CheckpointService(user_id=self.user_id, checkpointer=checkpointer)

    async def delete_thread(self, thread_id: str):
        # Delete the thread record first. The user's thread list is read from
        # the thread store, so removing this record is what makes the delete
        # visible — it must succeed and must not be gated behind checkpoint
        # cleanup. (Previously checkpoint deletion ran first and, when it
        # failed, aborted the whole operation; the failure was then swallowed
        # and the route still returned 204, so the thread reappeared on the
        # next list fetch.)
        deleted_thread = await self.thread_service.delete(thread_id)
        if not deleted_thread:
            raise ValueError(f"Failed to delete thread {thread_id}")

        # Best-effort checkpoint cleanup. Orphaned checkpoints are invisible to
        # the user and can be reclaimed separately, so a failure here is logged
        # but must not resurrect the thread or fail the request. Notably, the
        # resilient checkpointer historically did not implement adelete_thread
        # (raising NotImplementedError); that must not break thread deletion.
        checkpoint_service = getattr(self, "checkpoint_service", None)
        if checkpoint_service is not None:
            try:
                deleted_checkpoints = await checkpoint_service.delete_checkpoints_for_thread(thread_id)
                if not deleted_checkpoints:
                    logger.warning(f"Thread {thread_id} deleted but checkpoint cleanup did not complete")
            except Exception as e:
                logger.warning(f"Thread {thread_id} deleted but checkpoint cleanup raised: {e}")

        return True
