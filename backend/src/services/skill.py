from typing import Optional

from langgraph.store.base import BaseStore

from src.repos.skill_repo import SkillRepo
from src.schemas.entities.skill import SavedSkill, SkillCreate, SkillUpdate


class SkillService:
    def __init__(self, user_id: str, store: BaseStore):
        self.repo = SkillRepo(user_id=user_id, store=store)

    async def create(self, data: SkillCreate) -> SavedSkill:
        skill = SavedSkill(
            name=data.name,
            description=data.description,
            content=data.content,
            tags=data.tags,
            allowed_tools=data.allowed_tools,
            license=data.license,
            compatibility=data.compatibility,
        )
        return await self.repo.create(skill)

    async def get(self, skill_name: str) -> Optional[SavedSkill]:
        return await self.repo.get(skill_name)

    async def update(self, skill_name: str, data: SkillUpdate) -> Optional[SavedSkill]:
        update_data = data.model_dump(exclude_none=True)
        return await self.repo.update(skill_name, **update_data)

    async def toggle(self, skill_name: str) -> Optional[SavedSkill]:
        existing = await self.repo.get(skill_name)
        if existing is None:
            return None
        return await self.repo.update(skill_name, disabled=not existing.disabled)

    async def search(
        self, limit: int = 10, offset: int = 0, query: str = ""
    ) -> tuple[list[SavedSkill], int]:
        return await self.repo.list(limit=limit, offset=offset, query=query)

    async def search_enabled(
        self, limit: int = 10, offset: int = 0, query: str = ""
    ) -> tuple[list[SavedSkill], int]:
        skills, total = await self.repo.list(limit=1000, offset=0, query=query)
        enabled = [s for s in skills if not s.disabled]
        # Apply pagination to the filtered results
        paginated = enabled[offset : offset + limit]
        return paginated, len(enabled)

    async def delete(self, skill_name: str) -> bool:
        return await self.repo.delete(skill_name)
