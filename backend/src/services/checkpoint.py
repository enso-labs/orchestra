from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.base import (
    Checkpoint,
    BaseCheckpointSaver,
    CheckpointTuple,
    CheckpointMetadata,
    ChannelVersions,
)
from langgraph.types import StateSnapshot, Command
from langchain_core.messages import BaseMessage
from src.utils.logger import logger
from src.utils.messages import from_message_to_dict
from src.utils.retry import retry_db_operation
from src.schemas.entities.hitl import (
    InterruptInfo,
    InterruptConfig,
    DecisionType,
    HumanDecision,
    ResumeResponse,
)


IN_MEMORY_CHECKPOINTER = InMemorySaver()


class CheckpointService:
    def __init__(
        self,
        user_id: str = None,
        checkpointer: BaseCheckpointSaver = None,
        graph: CompiledStateGraph = None,
    ):
        self.user_id = user_id
        self.checkpointer: BaseCheckpointSaver = checkpointer or IN_MEMORY_CHECKPOINTER
        self.graph = graph

    @staticmethod
    def _collect_messages(checkpoint: CheckpointTuple) -> list[BaseMessage]:
        channel_values = checkpoint.checkpoint.get("channel_values", {})
        start_value = channel_values.get("__start__")

        # Handle LLMInput Pydantic model (current) or dict (legacy)
        if start_value is not None:
            if hasattr(start_value, "messages"):
                # Pydantic model with messages attribute
                messages = start_value.messages
            elif isinstance(start_value, dict):
                # Legacy dict format
                messages = start_value.get("messages", [])
            else:
                messages = []
        else:
            messages = channel_values.get("messages", []) or []

        return messages if messages else []

    async def list_checkpoints_from_graph(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        checkpoints = []
        async for checkpoint in self.graph.aget_state_history(config):
            checkpoint = checkpoint._asdict()
            del checkpoint["tasks"]
            checkpoints.append(checkpoint)
        return checkpoints

    @retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,))
    async def list_checkpoints(
        self, thread_id: str, limit: int = 3
    ) -> list[StateSnapshot]:
        try:
            config = RunnableConfig(configurable={"thread_id": thread_id})
            checkpoints = []
            async for checkpoint in self.checkpointer.alist(config, limit=limit):
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

    async def create_checkpoint(
        self,
        thread_id: str,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ):
        config = RunnableConfig(
            configurable={
                "thread_id": thread_id,
                "checkpoint_id": checkpoint.get("id"),
                "checkpoint_ns": checkpoint.get("ns", ""),
            }
        )
        checkpoint = await self.checkpointer.aput(
            config=config,
            checkpoint=checkpoint,
            metadata=metadata,
            new_versions=new_versions,
        )
        return checkpoint

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

    async def get_interrupts(self, thread_id: str) -> list[InterruptInfo]:
        """
        Get pending interrupts for a thread from its checkpoint state.

        Args:
            thread_id: The thread ID to check for interrupts

        Returns:
            List of InterruptInfo objects representing pending interrupts.
            Returns empty list when no graph/checkpoint exists or no interrupts pending.
        """
        if self.graph is None:
            logger.debug(
                f"No graph configured for interrupt detection on thread {thread_id}"
            )
            return []

        try:
            config = RunnableConfig(configurable={"thread_id": thread_id})
            state: StateSnapshot = await self.graph.aget_state(config)

            if not state or not state.interrupts:  # type: ignore[attr-defined]
                return []

            interrupts: list[InterruptInfo] = []
            for interrupt in state.interrupts:  # type: ignore[attr-defined]
                # The interrupt.value contains the HumanInterrupt data
                # Structure: {"action_request": {"action": str, "args": dict}, "config": {...}, "description": str}
                interrupt_value = interrupt.value

                # Handle both list and single interrupt value formats
                if isinstance(interrupt_value, list):
                    interrupt_data = interrupt_value[0] if interrupt_value else {}
                else:
                    interrupt_data = interrupt_value

                # Extract tool info from action_request
                action_request = interrupt_data.get("action_request", {})
                tool_name = action_request.get("action", "unknown")
                tool_args = action_request.get("args", {})

                # Extract description
                description = interrupt_data.get("description")

                # Extract config for allowed actions
                raw_config = interrupt_data.get("config", {})
                allowed_actions: list[DecisionType] = []

                if raw_config.get("allow_accept", False):
                    allowed_actions.append(DecisionType.ACCEPT)
                if raw_config.get("allow_edit", False):
                    allowed_actions.append(DecisionType.EDIT)
                if raw_config.get("allow_respond", False):
                    allowed_actions.append(DecisionType.RESPONSE)
                # REJECT is always allowed as a safety measure
                allowed_actions.append(DecisionType.REJECT)

                interrupt_config = InterruptConfig(allowed_actions=allowed_actions)

                interrupt_info = InterruptInfo(
                    tool_name=tool_name,
                    tool_args=tool_args,
                    description=description,
                    config=interrupt_config,
                )
                interrupts.append(interrupt_info)

            return interrupts

        except Exception as e:
            logger.exception(f"Error getting interrupts for thread {thread_id}: {e}")
            return []

    async def resume_with_decision(
        self, thread_id: str, decisions: list[HumanDecision]
    ) -> ResumeResponse:
        """
        Resume execution of an interrupted thread with human decision(s).

        Uses LangGraph's Command(resume=...) pattern to continue execution
        after a human has made a decision on the pending interrupt.

        Args:
            thread_id: The thread ID to resume
            decisions: List of HumanDecision objects (typically one decision)

        Returns:
            ResumeResponse with success status and new checkpoint_id

        Raises:
            ValueError: When no graph is configured or no interrupt is pending
        """
        if self.graph is None:
            raise ValueError(
                f"No graph configured for resume operation on thread {thread_id}"
            )

        config = RunnableConfig(configurable={"thread_id": thread_id})

        # Check if there's a pending interrupt
        state: StateSnapshot = await self.graph.aget_state(config)
        if not state or not state.interrupts:  # type: ignore[attr-defined]
            raise ValueError(f"No pending interrupt for thread {thread_id}")

        # Build the resume value(s) based on the decision(s)
        # The interrupt() function expects responses in format:
        # {"type": "accept/edit/response", "args": {...}}
        resume_values: list[dict] = []
        for decision in decisions:
            if decision.decision_type == DecisionType.ACCEPT:
                resume_values.append({"type": "accept"})
            elif decision.decision_type == DecisionType.EDIT:
                resume_values.append(
                    {"type": "edit", "args": {"args": decision.edited_args}}
                )
            elif decision.decision_type == DecisionType.RESPONSE:
                resume_values.append(
                    {"type": "response", "args": decision.response_content}
                )
            elif decision.decision_type == DecisionType.REJECT:
                # For reject, we respond with a rejection message
                resume_values.append(
                    {"type": "response", "args": "User rejected this action."}
                )
            else:
                raise ValueError(f"Unsupported decision type: {decision.decision_type}")

        try:
            # Resume execution using Command with resume value
            # For single interrupt, pass single value; for multiple, pass list
            resume_value = (
                resume_values[0] if len(resume_values) == 1 else resume_values
            )

            # Execute the resumed graph
            _result = await self.graph.ainvoke(
                Command(resume=resume_value),
                config=config,
            )

            # Get the new state to extract checkpoint_id
            new_state: StateSnapshot = await self.graph.aget_state(config)
            new_checkpoint_id = new_state.config.get("configurable", {}).get(
                "checkpoint_id"
            )

            logger.info(
                f"Thread {thread_id} resumed successfully with checkpoint {new_checkpoint_id}"
            )

            return ResumeResponse(
                success=True,
                thread_id=thread_id,
                message="Thread resumed successfully",
                checkpoint_id=new_checkpoint_id,
            )

        except Exception as e:
            logger.exception(f"Error resuming thread {thread_id}: {e}")
            return ResumeResponse(
                success=False,
                thread_id=thread_id,
                message=f"Failed to resume thread: {str(e)}",
                checkpoint_id=None,
            )


checkpoint_service = CheckpointService()
