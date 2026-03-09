from typing import Any, Optional

from pydantic import BaseModel, Field


class ThreadCheckpointSummary(BaseModel):
    checkpoint_id: str = Field(..., description="Checkpoint identifier")
    parent_checkpoint_id: Optional[str] = Field(default=None, description="Parent checkpoint identifier")
    created_at: Optional[str] = Field(default=None, description="Checkpoint creation timestamp")
    source: Optional[str] = Field(default=None, description="Checkpoint source metadata")
    message_preview: Optional[str] = Field(default=None, description="Short preview of the checkpoint contents")
    model: Optional[str] = Field(default=None, description="Model associated with the checkpoint, if available")
    has_files: bool = Field(default=False, description="Whether the checkpoint contains files")
    has_todos: bool = Field(default=False, description="Whether the checkpoint contains todos")
    has_interrupts: bool = Field(default=False, description="Whether the checkpoint has pending interrupts")
    is_restorable: bool = Field(default=False, description="Whether the checkpoint can be restored by forking")
    is_head: bool = Field(default=False, description="Whether this checkpoint is the current thread head")


class ThreadCheckpointListResponse(BaseModel):
    checkpoints: list[ThreadCheckpointSummary] = Field(default_factory=list)


class ThreadCheckpointDetail(BaseModel):
    thread_id: str = Field(..., description="Owning thread identifier")
    checkpoint_id: str = Field(..., description="Checkpoint identifier")
    parent_checkpoint_id: Optional[str] = Field(default=None, description="Parent checkpoint identifier")
    created_at: Optional[str] = Field(default=None, description="Checkpoint creation timestamp")
    source: Optional[str] = Field(default=None, description="Checkpoint source metadata")
    model: Optional[str] = Field(default=None, description="Model associated with the checkpoint, if available")
    messages: list[dict[str, Any]] = Field(default_factory=list, description="Normalized checkpoint messages")
    files: dict[str, Any] = Field(default_factory=dict, description="Checkpoint files")
    todos: list[Any] = Field(default_factory=list, description="Checkpoint todos")
    has_interrupts: bool = Field(default=False, description="Whether the checkpoint has pending interrupts")
    is_restorable: bool = Field(default=False, description="Whether the checkpoint can be restored by forking")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Raw checkpoint metadata")


class ThreadCheckpointDetailResponse(BaseModel):
    checkpoint: ThreadCheckpointDetail


class ForkCheckpointRequest(BaseModel):
    title: Optional[str] = Field(default=None, description="Optional title for the forked thread")


class ForkCheckpointResponse(BaseModel):
    thread_id: str = Field(..., description="New forked thread identifier")
    head_checkpoint_id: str = Field(..., description="Head checkpoint identifier for the forked thread")
    source_thread_id: str = Field(..., description="Source thread identifier")
    source_checkpoint_id: str = Field(..., description="Source checkpoint identifier")
