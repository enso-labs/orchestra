from typing import Optional
from langchain_core.runnables import RunnableConfig
from langgraph.pregel.main import BaseCheckpointSaver
from src.services.project import ProjectService
from src.services.checkpoint import CheckpointService
from src.services.thread import ThreadService
from src.services.assistant import AssistantService
from src.services.prompt import PromptService
from langgraph.store.base import BaseStore
from src.services.presidio import PresidioService
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
            config["configurable"].get("user_id", None)
            or config["metadata"].get("user_id", None)
        )
        self.tool_service = ToolService(user_id=self.user_id, store=store)
        self.memory_service = MemoryService(user_id=self.user_id, store=store)
        self.thread_service = ThreadService(user_id=self.user_id, store=store)
        self.prompt_service = PromptService(user_id=self.user_id, store=store)
        self.project_service = ProjectService(user_id=self.user_id, store=store)
        self.assistant_service = AssistantService(user_id=self.user_id, store=store)
        self.presidio_service = PresidioService()

        if checkpointer:
            self.checkpoint_service = CheckpointService(
                user_id=self.user_id, checkpointer=checkpointer
            )

    async def delete_thread(self, thread_id: str):
        try:
            deleted_checkpoints = (
                await self.checkpoint_service.delete_checkpoints_for_thread(thread_id)
            )
            if not deleted_checkpoints:
                raise ValueError(f"Failed to delete checkpoints for thread {thread_id}")
            deleted_thread = await self.thread_service.delete(thread_id)
            if not deleted_thread:
                raise ValueError(f"Failed to delete thread {thread_id}")
            return True
        except Exception as e:
            logger.error(e)
            return e
