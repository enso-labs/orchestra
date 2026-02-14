import re
from datetime import datetime
from typing import Optional

import yaml
from pydantic import BaseModel, Field, field_validator


class SavedSkill(BaseModel):
    name: str
    description: str = Field(max_length=1024)
    content: str
    tags: list[str] = Field(default_factory=list)
    disabled: bool = False
    metadata: dict = Field(default_factory=dict)
    allowed_tools: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    compatibility: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", v):
            raise ValueError(
                "Name must be kebab-case: lowercase alphanumeric with hyphens"
            )
        return v

    def to_skill_md(self) -> str:
        """Reconstructs full SKILL.md content with YAML frontmatter from model fields."""
        frontmatter = {
            "name": self.name,
            "description": self.description,
            "tags": self.tags,
            "disabled": self.disabled,
            "allowed_tools": self.allowed_tools,
        }
        if self.license:
            frontmatter["license"] = self.license
        if self.compatibility:
            frontmatter["compatibility"] = self.compatibility

        yaml_str = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
        return f"---\n{yaml_str}---\n\n{self.content}"


class SkillCreate(BaseModel):
    name: str
    description: str = Field(max_length=1024)
    content: str
    tags: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    license: Optional[str] = None
    compatibility: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", v):
            raise ValueError(
                "Name must be kebab-case: lowercase alphanumeric with hyphens"
            )
        return v


class SkillUpdate(BaseModel):
    description: Optional[str] = Field(default=None, max_length=1024)
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    allowed_tools: Optional[list[str]] = None
    license: Optional[str] = None
    compatibility: Optional[str] = None


class SkillListResponse(BaseModel):
    skills: list[SavedSkill]
    total: int
    limit: int
    offset: int
