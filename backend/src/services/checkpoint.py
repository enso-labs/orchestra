from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.base import Checkpoint

from src.services.thread import thread_service

in_memory_checkpointer = InMemorySaver()


class CheckpointService:
    def __init__(self, checkpointer: InMemorySaver = in_memory_checkpointer):
        self.checkpointer = checkpointer
        self.graph = create_react_agent("", [], checkpointer=self.checkpointer)

    async def search_threads(self, user_id: str):
        return await thread_service.search(user_id=user_id)

    async def list_checkpoints(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        checkpoints = []
        async for checkpoint in self.graph.aget_state_history(config):
            checkpoints.append(checkpoint._asdict())
        return checkpoints

    async def get_checkpoint_state(
        self, thread_id: str, checkpoint_id: str | None = None
    ):
        config = RunnableConfig(
            configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id}
        )
        checkpoint = await self.graph.aget_state(config)
        return checkpoint._asdict()

    async def update_checkpoint_state(self, config: RunnableConfig, values: dict):
        return await self.graph.aupdate_state(config=config, values=values)


checkpoint_service = CheckpointService()
