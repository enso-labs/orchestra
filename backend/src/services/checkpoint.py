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
from langgraph.store.base import BaseStore
from uuid import uuid4
from src.utils.logger import logger
from src.utils.messages import from_message_to_dict
from src.utils.retry import retry_db_operation
from src.services.errors import is_retryable_error, CheckpointConnectionError
from src.schemas.entities.checkpoint import ThreadCheckpointSummary, ThreadCheckpointDetail, ForkCheckpointResponse
from src.schemas.entities.store import Thread
import psycopg


# Exception types that should trigger checkpoint retry
CHECKPOINT_EXCEPTIONS = (
    psycopg.OperationalError,
    psycopg.InterfaceError,
    ConnectionError,
    OSError,
    CheckpointConnectionError,
)
from src.schemas.entities.hitl import (
    InterruptInfo,
    InterruptConfig,
    DecisionType,
    HumanDecision,
    ResumeResponse,
)
from src.services.thread import ThreadService
from src.utils.format import format_content


IN_MEMORY_CHECKPOINTER = InMemorySaver()


class CheckpointService:
    def __init__(
        self,
        user_id: str = None,
        checkpointer: BaseCheckpointSaver = None,
        graph: CompiledStateGraph = None,
        store: BaseStore = None,
    ):
        self.user_id = user_id
        self.checkpointer: BaseCheckpointSaver = checkpointer or IN_MEMORY_CHECKPOINTER
        self.graph = graph
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store) if store is not None else None

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

    @staticmethod
    def _extract_value(payload: object, key: str, default: object):
        if hasattr(payload, key):
            return getattr(payload, key)
        if isinstance(payload, dict):
            return payload.get(key, default)
        return default

    @staticmethod
    def _get_channel_value(checkpoint: CheckpointTuple, key: str, default: object):
        channel_values = checkpoint.checkpoint.get("channel_values", {})
        if key in channel_values:
            return channel_values.get(key, default)

        start_value = channel_values.get("__start__")
        return CheckpointService._extract_value(start_value, key, default)

    @staticmethod
    def _latest_message_preview(messages: list[dict]) -> str | None:
        for message in reversed(messages):
            if message.get("type") in {"tool", "tool_use"}:
                continue
            content = format_content(message.get("content", ""))
            if content:
                return content[:140]
        return None

    @staticmethod
    def _resolve_model(messages: list[dict]) -> str | None:
        for message in reversed(messages):
            model = message.get("model")
            if model:
                return model
        return None

    @staticmethod
    def _checkpoint_id_from_config(config: RunnableConfig | None) -> str | None:
        if not config:
            return None
        return config.get("configurable", {}).get("checkpoint_id")

    async def _get_state_snapshot(self, thread_id: str, checkpoint_id: str | None = None) -> StateSnapshot | None:
        if self.graph is None:
            return None
        config = RunnableConfig(configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id})
        try:
            return await self.graph.aget_state(config)
        except Exception as e:
            logger.warning(
                f"Failed to load state snapshot for thread {thread_id} checkpoint {checkpoint_id or 'latest'}: {e}"
            )
            return None

    async def _get_checkpoint_tuple(self, thread_id: str, checkpoint_id: str | None = None) -> CheckpointTuple | None:
        config = RunnableConfig(configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id})
        return await self.checkpointer.aget_tuple(config)

    def _checkpoint_values(self, checkpoint: CheckpointTuple) -> dict:
        values: dict = {}

        messages = self._collect_messages(checkpoint)
        if messages:
            values["messages"] = messages

        files = self._get_channel_value(checkpoint, "files", None)
        if files is not None:
            values["files"] = files

        todos = self._get_channel_value(checkpoint, "todos", None)
        if todos is not None:
            values["todos"] = todos

        return values

    async def _build_checkpoint_detail(
        self,
        thread_id: str,
        checkpoint: CheckpointTuple,
        *,
        state: StateSnapshot | None = None,
    ) -> ThreadCheckpointDetail:
        messages = from_message_to_dict(self._collect_messages(checkpoint))
        state_values = state.values if state is not None else self._checkpoint_values(checkpoint)
        files = state_values.get("files") or self._get_channel_value(checkpoint, "files", {}) or {}
        todos = state_values.get("todos") or self._get_channel_value(checkpoint, "todos", []) or []
        checkpoint_id = self._checkpoint_id_from_config(checkpoint.config) or checkpoint.checkpoint.get("id")
        parent_checkpoint_id = self._checkpoint_id_from_config(checkpoint.parent_config)
        has_interrupts = bool(getattr(state, "interrupts", None))
        is_restorable = self.is_restorable(checkpoint, state=state)

        return ThreadCheckpointDetail(
            thread_id=thread_id,
            checkpoint_id=checkpoint_id,
            parent_checkpoint_id=parent_checkpoint_id,
            created_at=checkpoint.checkpoint.get("ts"),
            source=checkpoint.metadata.get("source") if checkpoint.metadata else None,
            model=self._resolve_model(messages),
            messages=messages,
            files=files,
            todos=todos,
            has_interrupts=has_interrupts,
            is_restorable=is_restorable,
            metadata=dict(checkpoint.metadata or {}),
        )

    async def list_checkpoint_summaries(
        self,
        thread_id: str,
        limit: int = 20,
        before: str | None = None,
        *,
        head_checkpoint_id: str | None = None,
    ) -> list[ThreadCheckpointSummary]:
        before_config = None
        before_timestamp = None
        if before:
            if "T" in before:
                before_timestamp = before
            else:
                before_config = RunnableConfig(configurable={"thread_id": thread_id, "checkpoint_id": before})

        config = RunnableConfig(configurable={"thread_id": thread_id})
        summaries: list[ThreadCheckpointSummary] = []
        async for checkpoint in self.checkpointer.alist(config, before=before_config, limit=limit * 3):
            created_at = checkpoint.checkpoint.get("ts")
            if before_timestamp and created_at and created_at >= before_timestamp:
                continue

            checkpoint_id = self._checkpoint_id_from_config(checkpoint.config) or checkpoint.checkpoint.get("id")
            state = await self._get_state_snapshot(thread_id, checkpoint_id)
            detail = await self._build_checkpoint_detail(
                thread_id,
                checkpoint,
                state=state,
            )
            summaries.append(
                ThreadCheckpointSummary(
                    checkpoint_id=detail.checkpoint_id,
                    parent_checkpoint_id=detail.parent_checkpoint_id,
                    created_at=detail.created_at,
                    source=detail.source,
                    message_preview=self._latest_message_preview(detail.messages),
                    model=detail.model,
                    has_files=bool(detail.files),
                    has_todos=bool(detail.todos),
                    has_interrupts=detail.has_interrupts,
                    is_restorable=detail.is_restorable,
                    is_head=detail.checkpoint_id == head_checkpoint_id,
                )
            )
            if len(summaries) >= limit:
                break

        return summaries

    async def get_checkpoint_detail(self, thread_id: str, checkpoint_id: str) -> ThreadCheckpointDetail | None:
        checkpoint = await self._get_checkpoint_tuple(thread_id, checkpoint_id)
        if checkpoint is None:
            return None
        state = await self._get_state_snapshot(thread_id, checkpoint_id)
        return await self._build_checkpoint_detail(thread_id, checkpoint, state=state)

    def is_restorable(self, checkpoint_tuple: CheckpointTuple, *, state: StateSnapshot | None = None) -> bool:
        if checkpoint_tuple.pending_writes:
            return False

        if checkpoint_tuple.checkpoint.get("pending_sends"):
            return False

        if state is None:
            return True

        if getattr(state, "interrupts", None):
            return False
        if getattr(state, "tasks", None):
            return False
        if getattr(state, "next", None):
            return False
        return True

    async def fork_checkpoint(
        self,
        thread_id: str,
        checkpoint_id: str,
        user_id: str,
        *,
        source_thread: Thread | None = None,
        title: str | None = None,
    ) -> ForkCheckpointResponse:
        if self.graph is None:
            raise ValueError("No graph configured for checkpoint fork")
        if self.thread_service is None:
            raise ValueError("No thread store configured for checkpoint fork")

        checkpoint_tuple = await self._get_checkpoint_tuple(thread_id, checkpoint_id)
        if checkpoint_tuple is None:
            raise ValueError(f"Checkpoint {checkpoint_id} not found")

        source_state = await self._get_state_snapshot(thread_id, checkpoint_id)
        if not self.is_restorable(checkpoint_tuple, state=source_state):
            raise ValueError("Checkpoint is not restorable")
        source_values = source_state.values if source_state is not None else self._checkpoint_values(checkpoint_tuple)

        new_thread_id = str(uuid4())
        seed_config = await self.graph.aupdate_state(
            RunnableConfig(
                configurable={
                    "thread_id": new_thread_id,
                    "assistant_id": source_thread.assistant_id if source_thread else None,
                    "project_id": source_thread.project_id if source_thread else None,
                }
            ),
            source_values,
        )

        new_head_checkpoint_id = self._checkpoint_id_from_config(seed_config)
        detail = await self._build_checkpoint_detail(thread_id, checkpoint_tuple, state=source_state)
        source_metadata = source_thread.metadata if source_thread and source_thread.metadata else {}

        await self.thread_service.update(
            new_thread_id,
            {
                "thread_id": new_thread_id,
                "title": title or getattr(source_thread, "title", None),
                "messages": source_values.get("messages", []),
                "files": detail.files,
                "todos": detail.todos,
                "assistant_id": source_thread.assistant_id if source_thread else None,
                "project_id": source_thread.project_id if source_thread else None,
                "checkpoint_id": new_head_checkpoint_id,
                "head_checkpoint_id": new_head_checkpoint_id,
                "checkpoint_count": 1,
                "metadata": {
                    **source_metadata,
                    "forked_from_thread_id": thread_id,
                    "forked_from_checkpoint_id": checkpoint_id,
                    "forked_by_user_id": user_id,
                },
            },
        )

        return ForkCheckpointResponse(
            thread_id=new_thread_id,
            head_checkpoint_id=new_head_checkpoint_id,
            source_thread_id=thread_id,
            source_checkpoint_id=checkpoint_id,
        )

    async def list_checkpoints_from_graph(self, thread_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id})
        checkpoints = []
        async for checkpoint in self.graph.aget_state_history(config):
            checkpoint = checkpoint._asdict()
            del checkpoint["tasks"]
            checkpoints.append(checkpoint)
        return checkpoints

    @retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,))
    async def list_checkpoints(self, thread_id: str, limit: int = 3) -> list[StateSnapshot]:
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

    @retry_db_operation(
        tries=3,
        delay=1,
        backoff=2,
        exceptions=CHECKPOINT_EXCEPTIONS,
        classify_error=is_retryable_error,
    )
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

    @retry_db_operation(
        tries=3,
        delay=1,
        backoff=2,
        exceptions=CHECKPOINT_EXCEPTIONS,
        classify_error=is_retryable_error,
    )
    async def get_checkpoint(
        self,
        thread_id: str,
        checkpoint_id: str | None = None,
    ) -> Checkpoint | None:
        config = RunnableConfig(configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id})
        checkpoint = await self.checkpointer.aget(config)
        return checkpoint

    async def get_checkpoint_state(self, thread_id: str, checkpoint_id: str):
        config = RunnableConfig(configurable={"thread_id": thread_id, "checkpoint_id": checkpoint_id})
        checkpoint = await self.graph.aget_state(config)
        return checkpoint._asdict()
        # return {**checkpoint.values, **checkpoint.config, **checkpoint.parent_config}

    async def update_checkpoint_state(self, config: RunnableConfig, values: dict):
        return await self.graph.aupdate_state(config=config, values=values)

    @retry_db_operation(
        tries=3,
        delay=1,
        backoff=2,
        exceptions=CHECKPOINT_EXCEPTIONS,
        classify_error=is_retryable_error,
    )
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
            logger.debug(f"No graph configured for interrupt detection on thread {thread_id}")
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

    async def resume_with_decision(self, thread_id: str, decisions: list[HumanDecision]) -> ResumeResponse:
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
            raise ValueError(f"No graph configured for resume operation on thread {thread_id}")

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
                resume_values.append({"type": "edit", "args": {"args": decision.edited_args}})
            elif decision.decision_type == DecisionType.RESPONSE:
                resume_values.append({"type": "response", "args": decision.response_content})
            elif decision.decision_type == DecisionType.REJECT:
                # For reject, we respond with a rejection message
                resume_values.append({"type": "response", "args": "User rejected this action."})
            else:
                raise ValueError(f"Unsupported decision type: {decision.decision_type}")

        try:
            # Resume execution using Command with resume value
            # For single interrupt, pass single value; for multiple, pass list
            resume_value = resume_values[0] if len(resume_values) == 1 else resume_values

            # Execute the resumed graph
            _result = await self.graph.ainvoke(
                Command(resume=resume_value),
                config=config,
            )

            # Get the new state to extract checkpoint_id
            new_state: StateSnapshot = await self.graph.aget_state(config)
            new_checkpoint_id = new_state.config.get("configurable", {}).get("checkpoint_id")

            logger.info(f"Thread {thread_id} resumed successfully with checkpoint {new_checkpoint_id}")

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
