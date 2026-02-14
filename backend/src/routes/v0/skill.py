from fastapi import APIRouter, Depends, HTTPException, Response, status
from langgraph.store.base import BaseStore

from src.schemas.entities import SearchFilter
from src.schemas.entities.skill import (
    SavedSkill,
    SkillCreate,
    SkillListResponse,
    SkillUpdate,
)
from src.schemas.models import ProtectedUser
from src.services.db import get_store
from src.services.skill import SkillService
from src.utils.auth import verify_credentials
from src.utils.logger import logger

router = APIRouter(tags=["Skill"], prefix="/skills")


def _get_service(user: ProtectedUser, store: BaseStore) -> SkillService:
    return SkillService(str(user.id), store)


@router.post("/search", response_model=SkillListResponse)
async def search_skills(
    body: SearchFilter,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> SkillListResponse:
    try:
        service = _get_service(user, store)
        skills, total = await service.search(
            limit=body.limit, offset=body.offset, query=body.query
        )
        return SkillListResponse(
            skills=skills, total=total, limit=body.limit, offset=body.offset
        )
    except Exception as e:
        logger.exception(f"Error searching skills: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.post("", response_model=SavedSkill, status_code=status.HTTP_201_CREATED)
async def create_skill(
    body: SkillCreate,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> SavedSkill:
    try:
        service = _get_service(user, store)
        return await service.create(body)
    except Exception as e:
        logger.exception(f"Error creating skill: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.get("/{skill_name}", response_model=SavedSkill)
async def get_skill(
    skill_name: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> SavedSkill:
    service = _get_service(user, store)
    skill = await service.get(skill_name)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return skill


@router.put("/{skill_name}", response_model=SavedSkill)
async def update_skill(
    skill_name: str,
    body: SkillUpdate,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> SavedSkill:
    service = _get_service(user, store)
    skill = await service.update(skill_name, body)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return skill


@router.patch("/{skill_name}/toggle", response_model=SavedSkill)
async def toggle_skill(
    skill_name: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> SavedSkill:
    service = _get_service(user, store)
    skill = await service.toggle(skill_name)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return skill


@router.delete("/{skill_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_name: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Response:
    service = _get_service(user, store)
    success = await service.delete(skill_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
