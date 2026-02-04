"""Skill template schema for pre-configured agent skills."""

from typing import Optional
from pydantic import BaseModel, Field, computed_field
from src.utils.format import slugify


class SkillTemplate(BaseModel):
    """Schema for a pre-configured skill template that can be converted to a SubAgent."""

    name: str = Field(..., description="Display name of the skill")
    description: str = Field(
        ..., description="Description used for supervisor routing decisions"
    )
    category: str = Field(default="general", description="Skill category for filtering")
    system_prompt: str = Field(..., description="System prompt for the skill agent")
    tools: list[str] = Field(
        default_factory=list, description="List of tool names available to this skill"
    )
    model: Optional[str] = Field(
        default=None, description="Optional model override for this skill"
    )
    enabled: bool = Field(default=True, description="Whether the skill is enabled")

    @computed_field
    @property
    def slug(self) -> str:
        """Generate URL-friendly slug from name."""
        return slugify(self.name)

    def to_subagent_dict(self) -> dict:
        """Convert to SubAgent dictionary format expected by deepagents."""
        result = {
            "name": self.slug,
            "description": self.description,
            "system_prompt": self.system_prompt,
            "tools": self.tools,
        }
        if self.model:
            result["model"] = self.model
        return result


class SkillsResponse(BaseModel):
    """Response model for skills list endpoint."""

    skills: list[SkillTemplate] = Field(default_factory=list)

    @computed_field
    @property
    def total(self) -> int:
        """Total number of skills in the response."""
        return len(self.skills)
