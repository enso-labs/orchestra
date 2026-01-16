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
        logger.info(f"Approving interrupt {interrupt.id} for tool {interrupt.tool_name}")
        return await graph.aupdate_state(
            config,
            values={"type": "accept"},
            as_node="__interrupt__",
        )


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
        return await graph.aupdate_state(
            config,
            values={"type": "edit", "args": {"args": validated_args}},
            as_node="__interrupt__",
        )


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
        return await graph.aupdate_state(
            config,
            values={"type": "response", "args": feedback},
            as_node="__interrupt__",
        )


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
        return await graph.aupdate_state(
            config,
            values={"type": "response", "args": feedback},
            as_node="__interrupt__",
        )


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

    def validate_nonce(self, interrupt_id: str, nonce: str) -> bool:
        """Validate that a nonce hasn't been used before (replay protection)."""
        nonce_key = f"{interrupt_id}:{nonce}"
        if nonce_key in self._used_nonces:
            return False
        self._used_nonces.add(nonce_key)
        return True

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

    async def handle_decision(
        self,
        request: InterruptRequest,
        tool_schema: Optional[type] = None,
    ) -> Dict[str, Any]:
        """Handle a user's decision on a pending interrupt.

        Args:
            request: The interrupt decision request
            tool_schema: Optional Pydantic schema for validating edited args

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

        # Get the interrupt
        interrupt = self.get_interrupt(request.interrupt_id)
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

        # Validate nonce for replay protection
        if request.nonce and not self.validate_nonce(request.interrupt_id, request.nonce):
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

        # Update interrupt status
        interrupt.status = InterruptStatus[request.action.value.upper()]
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
