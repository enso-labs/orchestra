"""
StreamingService - Centralized service for LLM streaming orchestration.

This service consolidates shared logic between LLMController and stream_generator,
providing a single source of truth for:
- Runtime initialization (ToolRuntime)
- Backend initialization (CompositeBackend)
- Agent construction orchestration
- Store update logic for persisting thread state
"""

from typing import Any, Dict, List, Optional
from deepagents.backends import CompositeBackend, StoreBackend
from langchain.tools import ToolRuntime
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore
from deepagents import SubAgent
import ujson

from src.contexts.service import ServiceContext
from src.flows import construct_agent as _construct_agent, init_backend as _init_backend
from src.flows import Orchestra
from src.schemas.contexts import ContextSchema
from src.schemas.entities import LLMRequest
from src.utils.format import get_time
from src.utils.logger import logger


class StreamingService:
    """
    Centralized service for streaming orchestration.

    Provides unified methods for runtime/backend initialization and store updates
    that both LLMController and stream_generator can use.
    """

    def __init__(
        self,
        user_id: str = None,
        store: BaseStore = None,
        config: RunnableConfig = None,
        service_context: Optional[ServiceContext] = None,
    ):
        self.user_id = user_id
        self.store = store
        self.config = config
        self.service_context = service_context or ServiceContext(
            user_id=user_id, store=store, config=config
        )

    def init_context(
        self,
        model: str,
        user_id: str = None,
    ) -> ContextSchema:
        """Initialize the context schema for the agent."""
        return ContextSchema(
            model=model,
            user_id=user_id or self.user_id,
        )

    def init_runtime(
        self,
        model: str,
        files: Optional[Dict[str, Any]] = None,
        tool_call_id: str = "tc_runtime_init",
    ) -> ToolRuntime:
        """
        Initialize a ToolRuntime for agent execution.

        Args:
            model: The chat model name/identifier being used
            files: Optional file system state
            tool_call_id: Identifier for tool calls

        Returns:
            Configured ToolRuntime instance
        """
        return ToolRuntime(
            state={"messages": [], "files": files or {}},
            context=self.init_context(model),
            tool_call_id=tool_call_id,
            store=self.store,
            stream_writer=lambda _: None,
            config=self.config,
        )

    def init_backend(
        self,
        runtime: ToolRuntime,
        routes: Optional[Dict[str, Any]] = None,
    ) -> CompositeBackend:
        """
        Initialize a CompositeBackend with store routes.

        Args:
            runtime: The ToolRuntime to use for backends
            routes: Optional custom routes (defaults to user memory/config routes)

        Returns:
            Configured CompositeBackend instance
        """
        if routes is None:
            store_backend = StoreBackend(runtime)
            routes = {
                f"/users/{self.user_id}/memories/": store_backend,
                f"/users/{self.user_id}/config/": store_backend,
            }
        return _init_backend(runtime, routes=routes)

    async def construct_agent(
        self,
        instructions: str,
        system_prompt: str,
        model: str,
        tools: List[BaseTool],
        subagents: List[SubAgent],
        checkpointer: BaseCheckpointSaver,
        backend: CompositeBackend,
    ) -> Orchestra:
        """
        Construct an Orchestra agent for streaming.

        Args:
            instructions: Additional instructions for the agent
            system_prompt: The system prompt for the agent
            model: The chat model name to use
            tools: List of tools available to the agent
            subagents: List of subagents for delegation
            checkpointer: Checkpoint saver for state persistence
            backend: The composite backend for state management

        Returns:
            Configured Orchestra agent instance
        """
        return await _construct_agent(
            instructions=instructions,
            system_prompt=system_prompt,
            model=model,
            tools=tools,
            subagents=subagents,
            checkpointer=checkpointer,
            backend=backend,
            service_context=self.service_context,
        )

    async def update_store(
        self,
        agent: Orchestra,
        config: RunnableConfig,
        files: Optional[Dict[str, Any]] = None,
        todos: Optional[List[Any]] = None,
    ) -> None:
        """
        Update the store with final thread state after streaming completes.

        This persists the final messages, files, and todos to the thread store,
        ensuring state is preserved even if the client disconnects.

        Args:
            agent: The Orchestra agent that was running
            config: The runnable config with thread metadata
            files: Optional file system state to persist
            todos: Optional todos list to persist
        """
        if not self.user_id:
            return

        try:
            final_state = await agent.graph.aget_state(config)
            configurable = {
                **final_state.config.get("configurable", {}),
                **config["configurable"],
            }
            messages = final_state.values.get("messages", [])

            self.service_context.store.fields = ["messages", "files"]

            update_data = {
                "thread_id": configurable.get("thread_id"),
                "checkpoint_id": configurable.get("checkpoint_id"),
                "assistant_id": configurable.get("assistant_id"),
                "project_id": configurable.get("project_id"),
                "messages": messages,
                "updated_at": get_time(),
            }

            if files is not None:
                update_data["files"] = files
            if todos is not None:
                update_data["todos"] = todos

            await self.service_context.thread_service.update(
                thread_id=configurable.get("thread_id"),
                data=update_data,
            )
            logger.info(f"checkpoint: {ujson.dumps(configurable)}")
        except Exception as e:
            logger.error(f"Error updating store: {e}")
            raise

    @classmethod
    def from_request(
        cls,
        request: LLMRequest,
        user_id: Optional[str],
        store: BaseStore,
        config: RunnableConfig,
    ) -> "StreamingService":
        """
        Factory method to create a StreamingService from an LLMRequest.

        Args:
            request: The LLM request with model and input configuration
            user_id: Optional user ID for the session
            store: The base store for state management
            config: The runnable configuration

        Returns:
            Configured StreamingService instance
        """
        return cls(
            user_id=user_id,
            store=store,
            config=config,
        )
