"""Human-In-The-Loop (HITL) Interrupt Schemas.

This module defines the Pydantic schemas for configuring and handling
human-in-the-loop interrupts during agent tool execution.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class InterruptTrigger(str, Enum):
    """Types of events that can trigger a human-in-the-loop interrupt."""

    TOOL_CALL = "tool_call"
    SUBAGENT_HANDOFF = "subagent_handoff"
    HIGH_STAKES_ACTION = "high_stakes_action"


class DecisionType(str, Enum):
    """Types of decisions a human can make for an interrupt."""

    APPROVE = "approve"
    EDIT = "edit"
    REJECT = "reject"
    RESPOND = "respond"


class InterruptStatus(str, Enum):
    """Status of an interrupt."""

    PENDING = "pending"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    EXPIRED = "expired"


class InterruptConfig(BaseModel):
    """Configuration for human-in-the-loop interrupts on an assistant.

    This config determines which tools require human approval and what
    actions are allowed during the approval process.
    """

    enabled: bool = Field(
        default=False, description="Whether HITL is enabled for this assistant"
    )
    tools_requiring_approval: List[str] = Field(
        default_factory=list,
        description="List of tool names that require human approval before execution",
    )
    timeout_seconds: int = Field(
        default=300,
        ge=30,
        le=3600,
        description="Timeout in seconds for pending interrupts (30s to 1 hour)",
    )
    default_action: Literal["approve", "reject", "timeout"] = Field(
        default="timeout",
        description="Default action to take when an interrupt times out",
    )
    allow_approve: bool = Field(
        default=True, description="Whether approving tool calls is allowed"
    )
    allow_edit: bool = Field(
        default=True, description="Whether editing tool call arguments is allowed"
    )
    allow_reject: bool = Field(
        default=True, description="Whether rejecting tool calls is allowed"
    )


class InterruptRequest(BaseModel):
    """Request to resolve a pending interrupt.

    Sent by the frontend when a user makes a decision on a pending
    tool call approval request.
    """

    interrupt_id: str = Field(..., description="The unique ID of the interrupt")
    action: DecisionType = Field(
        ..., description="The decision: approve, edit, reject, or respond"
    )
    edited_args: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Modified tool arguments (required when action is 'edit')",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Optional reason for the decision (useful for reject/respond)",
    )
    nonce: Optional[str] = Field(
        default=None, description="One-time-use token for replay protection"
    )

    @field_validator("edited_args")
    @classmethod
    def validate_edited_args_required_for_edit(cls, v, info):
        """Ensure edited_args is provided when action is 'edit'."""
        if info.data.get("action") == DecisionType.EDIT and not v:
            raise ValueError("edited_args is required when action is 'edit'")
        return v


class InterruptResponse(BaseModel):
    """Response after resolving an interrupt."""

    status: Literal["resumed", "rejected", "error"] = Field(
        ..., description="The result status of the interrupt resolution"
    )
    interrupt_id: str = Field(..., description="The interrupt ID that was resolved")
    thread_id: str = Field(..., description="The thread ID the interrupt belongs to")
    message: Optional[str] = Field(
        default=None, description="Optional message about the resolution"
    )


class InterruptEventData(BaseModel):
    """Data payload for an interrupt SSE event.

    Sent to the frontend when a tool call requires human approval.
    """

    interrupt_id: str = Field(
        default_factory=lambda: f"int_{uuid4().hex[:12]}",
        description="Unique identifier for this interrupt",
    )
    thread_id: str = Field(
        ..., description="The thread ID where the interrupt occurred"
    )
    checkpoint_id: str = Field(
        ..., description="The checkpoint ID at the time of interrupt"
    )
    tool_name: str = Field(..., description="Name of the tool requiring approval")
    tool_args: Dict[str, Any] = Field(
        ..., description="Arguments the tool was called with"
    )
    tool_call_id: str = Field(..., description="The LangChain tool call ID")
    tool_description: Optional[str] = Field(
        default=None, description="Description of what the tool does"
    )
    reason: str = Field(
        default="Requires human approval",
        description="Reason for the interrupt",
    )
    timeout_at: datetime = Field(..., description="When this interrupt will expire")
    nonce: str = Field(
        default_factory=lambda: uuid4().hex,
        description="One-time-use token for replay protection",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this interrupt was created",
    )


class Interrupt(BaseModel):
    """Full interrupt entity with state tracking.

    Used for storing interrupt state in Redis and/or checkpoints.
    """

    id: str = Field(
        default_factory=lambda: f"int_{uuid4().hex[:12]}",
        description="Unique identifier for this interrupt",
    )
    thread_id: str = Field(
        ..., description="The thread ID where the interrupt occurred"
    )
    user_id: str = Field(..., description="The user ID who owns this thread")
    checkpoint_id: str = Field(
        ..., description="The checkpoint ID at the time of interrupt"
    )
    tool_name: str = Field(..., description="Name of the tool requiring approval")
    tool_args: Dict[str, Any] = Field(
        ..., description="Original arguments the tool was called with"
    )
    tool_call_id: str = Field(..., description="The LangChain tool call ID")
    tool_description: Optional[str] = Field(
        default=None, description="Description of what the tool does"
    )
    reason: str = Field(
        default="Requires human approval",
        description="Reason for the interrupt",
    )
    status: InterruptStatus = Field(
        default=InterruptStatus.PENDING,
        description="Current status of the interrupt",
    )
    nonce: str = Field(
        default_factory=lambda: uuid4().hex,
        description="One-time-use token for replay protection",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this interrupt was created",
    )
    expires_at: datetime = Field(..., description="When this interrupt will expire")
    resolved_at: Optional[datetime] = Field(
        default=None, description="When this interrupt was resolved"
    )
    decision: Optional[Dict[str, Any]] = Field(
        default=None,
        description="The decision data when resolved (action, edited_args, reason)",
    )

    def is_expired(self) -> bool:
        """Check if the interrupt has expired."""
        return datetime.now(timezone.utc) > self.expires_at

    def is_pending(self) -> bool:
        """Check if the interrupt is still pending."""
        return self.status == InterruptStatus.PENDING and not self.is_expired()


class InterruptList(BaseModel):
    """Response containing a list of interrupts."""

    interrupts: List[Interrupt] = Field(
        default_factory=list, description="List of interrupts"
    )
