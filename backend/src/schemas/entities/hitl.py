"""
Human-in-the-Loop (HITL) schemas for interrupt handling and decision processing.

These schemas support the HITL workflow where agents can be paused at security-sensitive
operations and await human approval before continuing.
"""

from enum import Enum
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, model_validator


class DecisionType(str, Enum):
    """Types of human decisions for interrupted agent operations."""

    ACCEPT = "accept"
    EDIT = "edit"
    RESPONSE = "response"
    REJECT = "reject"


class HumanDecision(BaseModel):
    """
    A human decision for resuming an interrupted agent operation.

    Validation rules:
    - EDIT decision requires edited_args to be provided
    - RESPONSE decision requires response_content to be provided
    - ACCEPT and REJECT decisions don't require additional fields
    """

    decision_type: DecisionType = Field(..., description="The type of decision made by the human")
    edited_args: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Modified tool arguments when decision_type is EDIT",
    )
    response_content: Optional[str] = Field(
        default=None,
        description="Response content when decision_type is RESPONSE",
    )

    @model_validator(mode="after")
    def validate_decision_fields(self) -> "HumanDecision":
        """Validate that required fields are present based on decision_type."""
        if self.decision_type == DecisionType.EDIT and self.edited_args is None:
            raise ValueError("edited_args is required when decision_type is EDIT")
        if self.decision_type == DecisionType.RESPONSE and self.response_content is None:
            raise ValueError("response_content is required when decision_type is RESPONSE")
        return self

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"decision_type": "accept"},
                {
                    "decision_type": "edit",
                    "edited_args": {"url": "https://safe-api.example.com/data"},
                },
                {
                    "decision_type": "response",
                    "response_content": "Please proceed with caution",
                },
                {"decision_type": "reject"},
            ]
        }
    }


class InterruptConfig(BaseModel):
    """Configuration for an interrupt, including allowed actions."""

    allowed_actions: List[DecisionType] = Field(
        default_factory=lambda: [
            DecisionType.ACCEPT,
            DecisionType.EDIT,
            DecisionType.RESPONSE,
            DecisionType.REJECT,
        ],
        description="List of decision types allowed for this interrupt",
    )


class InterruptInfo(BaseModel):
    """Information about a pending interrupt."""

    tool_name: str = Field(..., description="The name of the tool that was interrupted")
    tool_args: Dict[str, Any] = Field(default_factory=dict, description="The arguments passed to the tool")
    description: Optional[str] = Field(
        default=None,
        description="Human-readable description of what the tool is trying to do",
    )
    config: InterruptConfig = Field(
        default_factory=InterruptConfig,
        description="Configuration for this interrupt including allowed actions",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "tool_name": "http_request",
                "tool_args": {
                    "method": "POST",
                    "url": "https://api.example.com/data",
                    "body": {"key": "value"},
                },
                "description": "Make an HTTP POST request to external API",
                "config": {"allowed_actions": ["accept", "edit", "response", "reject"]},
            }
        }
    }


class InterruptListResponse(BaseModel):
    """Response for listing pending interrupts on a thread."""

    thread_id: str = Field(..., description="The ID of the thread")
    has_interrupts: bool = Field(..., description="Whether the thread has pending interrupts")
    interrupts: List[InterruptInfo] = Field(default_factory=list, description="List of pending interrupts")

    model_config = {
        "json_schema_extra": {
            "example": {
                "thread_id": "thread-123",
                "has_interrupts": True,
                "interrupts": [
                    {
                        "tool_name": "http_request",
                        "tool_args": {
                            "method": "GET",
                            "url": "https://api.example.com",
                        },
                        "description": "Fetch data from external API",
                        "config": {"allowed_actions": ["accept", "reject"]},
                    }
                ],
            }
        }
    }


class ResumeRequest(BaseModel):
    """Request body for resuming an interrupted thread."""

    decisions: List[HumanDecision] = Field(
        ...,
        min_length=1,
        description="List of decisions for pending interrupts (typically one)",
    )

    model_config = {"json_schema_extra": {"example": {"decisions": [{"decision_type": "accept"}]}}}


class ResumeResponse(BaseModel):
    """Response after resuming an interrupted thread."""

    success: bool = Field(..., description="Whether the resume operation succeeded")
    thread_id: str = Field(..., description="The ID of the thread")
    message: str = Field(..., description="Human-readable status message")
    checkpoint_id: Optional[str] = Field(default=None, description="The new checkpoint ID after resuming")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "thread_id": "thread-123",
                "message": "Thread resumed successfully",
                "checkpoint_id": "checkpoint-456",
            }
        }
    }
