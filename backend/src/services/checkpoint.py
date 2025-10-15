from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.base import Checkpoint, BaseCheckpointSaver, CheckpointTuple
from langgraph.types import StateSnapshot
from langchain_core.messages import BaseMessage
from src.utils.logger import logger
from src.utils.messages import from_message_to_dict
from src.utils.retry import retry_db_operation


IN_MEMORY_CHECKPOINTER = InMemorySaver()


class CheckpointService:
    def __init__(
        self,
        user_id: str = None,
        checkpointer: BaseCheckpointSaver = None,
        graph: CompiledStateGraph = None,
    ):
        self.user_id = user_id
        self.checkpointer = checkpointer or IN_MEMORY_CHECKPOINTER
        self.graph = graph

    @staticmethod
    def _collect_messages(checkpoint: CheckpointTuple) -> list[BaseMessage]:
        messages = (
            checkpoint.checkpoint["channel_values"]
            .get("__start__", {})
            .get("messages", [])
            or checkpoint.checkpoint["channel_values"].get("messages", [])
            or []
        )
        return messages

    async def list_checkpoints_from_graph(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        checkpoints = []
        async for checkpoint in self.graph.aget_state_history(config):
            checkpoint = checkpoint._asdict()
            del checkpoint["tasks"]
            checkpoints.append(checkpoint)
        return checkpoints

    @retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,))
    async def list_checkpoints(self, thread_id: str) -> list[StateSnapshot]:
        try:
            config = RunnableConfig(configurable={"thread_id": thread_id})
            checkpoints = []
            async for checkpoint in self.checkpointer.alist(config):
                messages = self._collect_messages(checkpoint)
                snapshot = StateSnapshot(
                    values={"messages": from_message_to_dict(messages)},
                    config=checkpoint.config,
                    parent_config=checkpoint.parent_config,
                    metadata=checkpoint.metadata,
                    created_at=checkpoint.checkpoint["ts"],
                    interrupts=[],
                    next=[],
                    tasks=[],
                )
                formatted_snapshot = snapshot._asdict()
                del formatted_snapshot["tasks"]
                checkpoints.append(formatted_snapshot)
            return checkpoints
        except Exception as e:
            logger.exception(f"Error listing checkpoints: {e}")
            return []

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
        try:
            await self.checkpointer.adelete_thread(thread_id)
            return True
        except Exception as e:
            logger.exception(f"Error deleting checkpoints for thread: {e}")
            return False


checkpoint_service = CheckpointService()
