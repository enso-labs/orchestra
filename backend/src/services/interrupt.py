"""Human-In-The-Loop Interrupt Service.

This service handles interrupt state management, validation, and decision processing
using the Strategy pattern for different decision types.
"""

import hashlib
import json
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from langchain_core.runnables import RunnableConfig
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from pydantic import ValidationError

from src.schemas.entities.interrupt import (
    DecisionType,
    Interrupt,
    InterruptConfig,
    InterruptRequest,
    InterruptStatus,
)
from src.utils.logger import logger


class InterruptValidationError(Exception):
    """Raised when interrupt validation fails."""

    pass


class InterruptAuthorizationError(Exception):
    """Raised when interrupt authorization fails."""

    pass


class InterruptNotFoundError(Exception):
    """Raised when an interrupt is not found."""

    pass


class InterruptExpiredError(Exception):
    """Raised when an interrupt has expired."""

    pass


# -----------------------------------------------------------------------------
# Strategy Pattern: Interrupt Handlers
# -----------------------------------------------------------------------------


class InterruptHandler(ABC):
    """Abstract base class for interrupt decision handlers."""

    @abstractmethod
    async def handle(
        self,
        interrupt: Interrupt,
        request: InterruptRequest,
        graph: CompiledStateGraph,
        config: RunnableConfig,
    ) -> Dict[str, Any]:
        """Handle the interrupt decision and return the state update."""
        pass


class ApproveHandler(InterruptHandler):
    """Handler for approving tool calls."""

    async def handle(
        self,
        interrupt: Interrupt,
        request: InterruptRequest,
        graph: CompiledStateGraph,
        config: RunnableConfig,
    ) -> Dict[str, Any]:
        """Approve the tool call and proceed with original arguments."""
        logger.info(
            f"Approving interrupt {interrupt.id} for tool {interrupt.tool_name}"
        )
        # Use Command(resume=...) to provide the response back to the interrupt() call
        # Note: interrupt() was called with a list, so resume must also be a list
        result = await graph.ainvoke(
            Command(resume=[{"type": "accept"}]), config=config
        )
        return {"status": "approved", "result": result}


class EditHandler(InterruptHandler):
    """Handler for editing tool call arguments before execution."""

    def __init__(self, tool_schema: Optional[type] = None):
        self.tool_schema = tool_schema

    async def handle(
        self,
        interrupt: Interrupt,
        request: InterruptRequest,
        graph: CompiledStateGraph,
        config: RunnableConfig,
    ) -> Dict[str, Any]:
        """Edit the tool call arguments and proceed."""
        if not request.edited_args:
            raise InterruptValidationError("edited_args is required for edit action")

        # Validate edited args against tool schema if available
        if self.tool_schema:
            try:
                validated_args = self.tool_schema(**request.edited_args).model_dump()
            except ValidationError as e:
                raise InterruptValidationError(
                    f"Edited arguments failed validation: {e.errors()}"
                )
        else:
            validated_args = request.edited_args

        logger.info(
            f"Editing interrupt {interrupt.id} for tool {interrupt.tool_name} "
            f"with args: {validated_args}"
        )
        # Use Command(resume=...) to provide the response back to the interrupt() call
        # Note: interrupt() was called with a list, so resume must also be a list
        result = await graph.ainvoke(
            Command(resume=[{"type": "edit", "args": {"args": validated_args}}]),
            config=config,
        )
        return {"status": "edited", "result": result}


class RejectHandler(InterruptHandler):
    """Handler for rejecting tool calls."""

    async def handle(
        self,
        interrupt: Interrupt,
        request: InterruptRequest,
        graph: CompiledStateGraph,
        config: RunnableConfig,
    ) -> Dict[str, Any]:
        """Reject the tool call and return feedback to the LLM."""
        feedback = request.reason or "Tool call was rejected by user"
        logger.info(
            f"Rejecting interrupt {interrupt.id} for tool {interrupt.tool_name}: {feedback}"
        )
        # Use Command(resume=...) to provide the response back to the interrupt() call
        # Note: interrupt() was called with a list, so resume must also be a list
        result = await graph.ainvoke(
            Command(resume=[{"type": "response", "args": feedback}]),
            config=config,
        )
        return {"status": "rejected", "result": result}


class RespondHandler(InterruptHandler):
    """Handler for responding with custom feedback."""

    async def handle(
        self,
        interrupt: Interrupt,
        request: InterruptRequest,
        graph: CompiledStateGraph,
        config: RunnableConfig,
    ) -> Dict[str, Any]:
        """Respond with custom feedback to the LLM."""
        feedback = request.reason or "User provided feedback"
        logger.info(
            f"Responding to interrupt {interrupt.id} for tool {interrupt.tool_name}: {feedback}"
        )
        # Use Command(resume=...) to provide the response back to the interrupt() call
        # Note: interrupt() was called with a list, so resume must also be a list
        result = await graph.ainvoke(
            Command(resume=[{"type": "response", "args": feedback}]),
            config=config,
        )
        return {"status": "responded", "result": result}


# -----------------------------------------------------------------------------
# Interrupt Service
# -----------------------------------------------------------------------------


class InterruptService:
    """Service for managing human-in-the-loop interrupts.

    Handles:
    - Interrupt creation and state management
    - Nonce validation for replay protection
    - Thread ownership verification
    - Decision processing via strategy handlers
    """

    # Handler registry
    _handlers: Dict[DecisionType, type] = {
        DecisionType.APPROVE: ApproveHandler,
        DecisionType.EDIT: EditHandler,
        DecisionType.REJECT: RejectHandler,
        DecisionType.RESPOND: RespondHandler,
    }

    # In-memory cache for pending interrupts (could be replaced with Redis)
    _pending_interrupts: Dict[str, Interrupt] = {}
    _used_nonces: set = set()

    def __init__(
        self,
        user_id: str,
        graph: Optional[CompiledStateGraph] = None,
    ):
        self.user_id = user_id
        self.graph = graph

    @staticmethod
    def generate_nonce() -> str:
        """Generate a unique nonce for replay protection."""
        import uuid

        return uuid.uuid4().hex

    @staticmethod
    def hash_args(args: Dict[str, Any]) -> str:
        """Generate a hash of tool arguments for integrity verification."""
        args_json = json.dumps(args, sort_keys=True)
        return hashlib.sha256(args_json.encode()).hexdigest()

    def create_interrupt(
        self,
        thread_id: str,
        checkpoint_id: str,
        tool_name: str,
        tool_args: Dict[str, Any],
        tool_call_id: str,
        tool_description: Optional[str] = None,
        timeout_seconds: int = 300,
        reason: str = "Requires human approval",
    ) -> Interrupt:
        """Create a new pending interrupt.

        Args:
            thread_id: The thread where the interrupt occurred
            checkpoint_id: The checkpoint at the time of interrupt
            tool_name: Name of the tool requiring approval
            tool_args: Arguments the tool was called with
            tool_call_id: The LangChain tool call ID
            tool_description: Optional description of the tool
            timeout_seconds: How long the interrupt is valid (default 5 min)
            reason: Why the interrupt was triggered

        Returns:
            The created Interrupt object
        """
        now = datetime.now(timezone.utc)
        interrupt = Interrupt(
            thread_id=thread_id,
            user_id=self.user_id,
            checkpoint_id=checkpoint_id,
            tool_name=tool_name,
            tool_args=tool_args,
            tool_call_id=tool_call_id,
            tool_description=tool_description,
            reason=reason,
            status=InterruptStatus.PENDING,
            nonce=self.generate_nonce(),
            created_at=now,
            expires_at=now + timedelta(seconds=timeout_seconds),
        )

        # Store in pending interrupts cache
        self._pending_interrupts[interrupt.id] = interrupt
        logger.info(f"Created interrupt {interrupt.id} for thread {thread_id}")

        return interrupt

    def get_interrupt(self, interrupt_id: str) -> Optional[Interrupt]:
        """Get an interrupt by ID."""
        return self._pending_interrupts.get(interrupt_id)

    def get_pending_interrupts(self, thread_id: str) -> list[Interrupt]:
        """Get all pending interrupts for a thread."""
        return [
            i
            for i in self._pending_interrupts.values()
            if i.thread_id == thread_id and i.is_pending()
        ]

    def check_nonce(self, interrupt_id: str, nonce: str) -> bool:
        """Check if a nonce has been used before (without consuming it)."""
        nonce_key = f"{interrupt_id}:{nonce}"
        return nonce_key not in self._used_nonces

    def consume_nonce(self, interrupt_id: str, nonce: str) -> None:
        """Mark a nonce as used after successful operation."""
        nonce_key = f"{interrupt_id}:{nonce}"
        self._used_nonces.add(nonce_key)

    def validate_ownership(self, interrupt: Interrupt) -> bool:
        """Validate that the current user owns the interrupt's thread."""
        return interrupt.user_id == self.user_id

    def validate_args_schema(
        self,
        edited_args: Dict[str, Any],
        tool_schema: Optional[type],
    ) -> Dict[str, Any]:
        """Validate edited arguments against a tool's schema.

        Args:
            edited_args: The edited arguments to validate
            tool_schema: The Pydantic model class for the tool's args

        Returns:
            The validated and normalized arguments

        Raises:
            InterruptValidationError: If validation fails
        """
        if not tool_schema:
            return edited_args

        try:
            return tool_schema(**edited_args).model_dump()
        except ValidationError as e:
            raise InterruptValidationError(
                f"Edited arguments failed validation: {e.errors()}"
            )

    async def _get_interrupt_from_graph_state(
        self,
        thread_id: str,
    ) -> Optional[Interrupt]:
        """Extract interrupt info from the graph's current state.

        This is used as a fallback when the interrupt is not found in
        _pending_interrupts (e.g., distributed worker scenario).

        Args:
            thread_id: The thread ID to get state for

        Returns:
            Interrupt object if a pending interrupt is found, None otherwise
        """
        if not self.graph:
            return None

        try:
            config = RunnableConfig(configurable={"thread_id": thread_id})
            state = await self.graph.aget_state(config)

            if not state or not state.values:
                return None

            # Check state.tasks for active interrupts (the proper way to detect pending interrupts)
            # StateSnapshot.tasks contains PregelTask objects with 'interrupts' attribute
            has_pending_interrupt = False
            interrupt_value = None

            if hasattr(state, "tasks") and state.tasks:
                for task in state.tasks:
                    task_interrupts = getattr(task, "interrupts", None)
                    if task_interrupts:
                        has_pending_interrupt = True
                        # Get the first interrupt's value
                        if task_interrupts:
                            interrupt_value = getattr(task_interrupts[0], "value", None)
                        break

            if not has_pending_interrupt:
                logger.debug(
                    f"No pending interrupts found in graph state for thread {thread_id}"
                )
                return None

            # Get messages from state to find the tool call info
            messages = state.values.get("messages", [])
            if not messages:
                return None

            # Find the last AI message with tool_calls
            last_ai_message = None
            for msg in reversed(messages):
                msg_type = (
                    msg.get("type")
                    if isinstance(msg, dict)
                    else getattr(msg, "type", None)
                )
                if msg_type in ("ai", "AIMessage", "AIMessageChunk"):
                    last_ai_message = msg
                    break

            if not last_ai_message:
                return None

            # Extract tool_calls
            tool_calls = (
                last_ai_message.get("tool_calls", [])
                if isinstance(last_ai_message, dict)
                else getattr(last_ai_message, "tool_calls", [])
            )

            if not tool_calls:
                return None

            # Use the first pending tool call
            tool_call = tool_calls[0]
            tool_name = (
                tool_call.get("name")
                if isinstance(tool_call, dict)
                else getattr(tool_call, "name", "")
            )
            tool_args = (
                tool_call.get("args", {})
                if isinstance(tool_call, dict)
                else getattr(tool_call, "args", {})
            )
            tool_call_id = (
                tool_call.get("id")
                if isinstance(tool_call, dict)
                else getattr(tool_call, "id", "")
            )

            # Get checkpoint_id from state config
            checkpoint_id = state.config.get("configurable", {}).get(
                "checkpoint_id", ""
            )

            # Construct an Interrupt object
            now = datetime.now(timezone.utc)
            return Interrupt(
                id=f"synth_{thread_id}_{tool_call_id}",
                thread_id=thread_id,
                user_id=self.user_id,
                checkpoint_id=checkpoint_id,
                tool_name=tool_name or "",
                tool_args=tool_args,
                tool_call_id=tool_call_id or "",
                tool_description=None,
                reason="Reconstructed from graph state",
                status=InterruptStatus.PENDING,
                nonce="",
                created_at=now,
                expires_at=now + timedelta(seconds=300),
            )
        except Exception as e:
            logger.warning(f"Failed to get interrupt from graph state: {e}")
            return None

    async def handle_decision(
        self,
        request: InterruptRequest,
        tool_schema: Optional[type] = None,
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Handle a user's decision on a pending interrupt.

        Args:
            request: The interrupt decision request
            tool_schema: Optional Pydantic schema for validating edited args
            thread_id: Optional thread_id for fallback interrupt lookup from graph state

        Returns:
            The result of the state update

        Raises:
            InterruptNotFoundError: If the interrupt doesn't exist
            InterruptExpiredError: If the interrupt has expired
            InterruptAuthorizationError: If the user doesn't own the thread
            InterruptValidationError: If nonce or args validation fails
        """
        if not self.graph:
            raise ValueError("Graph is required to handle interrupt decisions")

        # Get the interrupt from in-memory cache
        interrupt = self.get_interrupt(request.interrupt_id)

        # Fallback: try to reconstruct from graph state (for distributed workers)
        if not interrupt and thread_id:
            logger.info(
                f"Interrupt {request.interrupt_id} not in cache, "
                f"reconstructing from graph state for thread {thread_id}"
            )
            interrupt = await self._get_interrupt_from_graph_state(thread_id)

        if not interrupt:
            raise InterruptNotFoundError(f"Interrupt {request.interrupt_id} not found")

        # Check expiration
        if interrupt.is_expired():
            interrupt.status = InterruptStatus.EXPIRED
            raise InterruptExpiredError(f"Interrupt {request.interrupt_id} has expired")

        # Validate ownership
        if not self.validate_ownership(interrupt):
            raise InterruptAuthorizationError(
                f"User {self.user_id} does not own interrupt {request.interrupt_id}"
            )

        # Check nonce for replay protection (don't consume yet - only after success)
        if request.nonce and not self.check_nonce(request.interrupt_id, request.nonce):
            raise InterruptValidationError(
                f"Nonce for interrupt {request.interrupt_id} has already been used"
            )

        # Build config for graph update
        config = RunnableConfig(
            configurable={
                "thread_id": interrupt.thread_id,
                "checkpoint_id": interrupt.checkpoint_id,
            }
        )

        # Get the appropriate handler
        handler_class = self._handlers.get(request.action)
        if not handler_class:
            raise InterruptValidationError(f"Unknown action type: {request.action}")

        # Instantiate handler (EditHandler needs the schema)
        if request.action == DecisionType.EDIT:
            handler = handler_class(tool_schema=tool_schema)
        else:
            handler = handler_class()

        # Handle the decision
        result = await handler.handle(interrupt, request, self.graph, config)

        # Only consume nonce after successful operation
        if request.nonce:
            self.consume_nonce(request.interrupt_id, request.nonce)

        # Update interrupt status - map DecisionType to InterruptStatus
        decision_to_status = {
            DecisionType.APPROVE: InterruptStatus.APPROVED,
            DecisionType.EDIT: InterruptStatus.EDITED,
            DecisionType.REJECT: InterruptStatus.REJECTED,
            DecisionType.RESPOND: InterruptStatus.REJECTED,  # RESPOND maps to REJECTED
        }
        interrupt.status = decision_to_status.get(
            request.action, InterruptStatus.APPROVED
        )
        interrupt.resolved_at = datetime.now(timezone.utc)
        interrupt.decision = {
            "action": request.action.value,
            "edited_args": request.edited_args,
            "reason": request.reason,
        }

        logger.info(
            f"Resolved interrupt {interrupt.id} with action {request.action.value}"
        )

        return result

    def cleanup_expired(self) -> int:
        """Remove expired interrupts from the cache.

        Returns:
            Number of interrupts cleaned up
        """
        now = datetime.now(timezone.utc)
        expired_ids = [
            i.id for i in self._pending_interrupts.values() if i.expires_at < now
        ]
        for interrupt_id in expired_ids:
            del self._pending_interrupts[interrupt_id]
        return len(expired_ids)


def should_interrupt_tool(
    tool_name: str,
    hitl_config: Optional[InterruptConfig],
) -> bool:
    """Check if a tool should trigger a human-in-the-loop interrupt.

    Args:
        tool_name: The name of the tool being called
        hitl_config: The HITL configuration for the assistant

    Returns:
        True if the tool should be interrupted for human review
    """
    if not hitl_config or not hitl_config.enabled:
        return False

    # Check if this tool is in the list requiring approval
    if hitl_config.tools_requiring_approval:
        return tool_name in hitl_config.tools_requiring_approval

    # If no specific tools listed, all tools require approval when enabled
    return True
