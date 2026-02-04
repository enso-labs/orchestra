"""Skills API endpoints for skill discovery."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from src.schemas.entities.skill import SkillTemplate, SkillsResponse
from src.services.skill import skill_service

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.get(
    "",
    response_model=SkillsResponse,
    responses={
        status.HTTP_200_OK: {
            "description": "List of available skill templates",
            "content": {
                "application/json": {
                    "example": {
                        "skills": [
                            {
                                "name": "Research Agent",
                                "description": "Performs comprehensive web research...",
                                "category": "research",
                                "slug": "research-agent",
                                "tools": ["web_search", "think_tool"],
                                "enabled": True,
                            }
                        ],
                        "total": 1,
                    }
                }
            },
        }
    },
)
async def list_skills(
    category: Optional[str] = Query(
        default=None, description="Filter skills by category"
    ),
):
    """List available skill templates."""
    categories = [category] if category else None
    skills = await skill_service.get_enabled_skills(categories=categories)
    return SkillsResponse(skills=skills)


@router.get(
    "/{slug}",
    response_model=SkillTemplate,
    responses={
        status.HTTP_200_OK: {
            "description": "Skill template details",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Skill not found",
            "content": {"application/json": {"example": {"detail": "Skill not found"}}},
        },
    },
)
async def get_skill(slug: str):
    """Get a skill template by slug."""
    skill = await skill_service.get_skill(slug)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return skill
