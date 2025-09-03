from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.base import Checkpoint

from src.schemas.entities import ThreadSearch

in_memory_checkpointer = InMemorySaver()


class CheckpointService:
    def __init__(self, checkpointer: InMemorySaver = in_memory_checkpointer):
        self.checkpointer = checkpointer

    async def search_threads(self, thread_search: ThreadSearch):
        thread_ids = list(self.checkpointer.storage.keys())
        filtered_list = [item for item in thread_ids if item is not None]
        final_list = []
        for thread_id in filtered_list[: thread_search.limit]:
            checkpoint = await self.get_checkpoint(thread_id)
            final_list.append({"thread_id": thread_id, "checkpoint": checkpoint})
        return final_list

    async def list_checkpoints(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        graph = create_react_agent("", [], checkpointer=self.checkpointer)
        checkpoints = []
        async for checkpoint in graph.aget_state_history(config):
            checkpoints.append(
                {
                    **checkpoint.config,
                    "values": checkpoint.values,
                    "metadata": checkpoint.metadata,
                    "parent_config": checkpoint.parent_config,
                    "created_at": checkpoint.created_at,
                }
            )
        return checkpoints

    async def get_checkpoint(
        self,
        thread_id: str,
        checkpoint_id: str | None = None,
    ) -> Checkpoint | None:
        config = RunnableConfig(
            configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id}
        )
        checkpoint = await self.checkpointer.aget(config)
        return checkpoint


checkpoint_service = CheckpointService()
