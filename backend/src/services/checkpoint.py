from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.base import Checkpoint


class CheckpointService:
    def __init__(
        self, user_id: str = None, checkpointer: InMemorySaver = InMemorySaver()
    ):
        self.user_id = user_id
        self.checkpointer = checkpointer
        self.graph = create_react_agent("", [], checkpointer=self.checkpointer)

    async def list_checkpoints(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        checkpoints = []
        async for checkpoint in self.graph.aget_state_history(config):
            checkpoint = checkpoint._asdict()
            del checkpoint["tasks"]
            checkpoints.append(checkpoint)
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

    async def get_checkpoint_state(self, thread_id: str, checkpoint_id: str):
        config = RunnableConfig(
            configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id}
        )
        checkpoint = await self.graph.aget_state(config)
        return checkpoint._asdict()
        # return {**checkpoint.values, **checkpoint.config, **checkpoint.parent_config}

    async def update_checkpoint_state(self, config: RunnableConfig, values: dict):
        return await self.graph.aupdate_state(config=config, values=values)

    async def delete_checkpoints_for_thread(self, thread_id: str) -> bool:
        if thread_id in self.checkpointer.storage:
            del self.checkpointer.storage[thread_id]
            return True
        return False


checkpoint_service = CheckpointService()
