from datetime import datetime
from typing import Optional

from langgraph.store.base import BaseStore, SearchItem

from src.repos.base_repo import BaseRepo
from src.services.db import get_store_in_memory
from src.schemas.entities.skill import SavedSkill
from src.schemas.entities import SearchFilter


class SkillRepo(BaseRepo):
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        store = store or get_store_in_memory()
        super().__init__(user_id=user_id, store=store, entity_type="skills")

    async def create(self, skill: SavedSkill) -> SavedSkill:
        now = datetime.now()
        skill.created_at = now
        skill.updated_at = now
        await self._set(key=skill.name, value=skill)
        return skill

    async def get(self, skill_name: str) -> Optional[SavedSkill]:
        item = await self._get(skill_name)
        if item is None:
            return None
        return SavedSkill.model_validate(item.value)

    async def update(self, skill_name: str, **kwargs) -> Optional[SavedSkill]:
        existing = await self.get(skill_name)
        if existing is None:
            return None
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        updated = existing.model_copy(update=update_data)
        updated.updated_at = datetime.now()
        await self._set(key=skill_name, value=updated)
        return updated

    async def delete(self, skill_name: str) -> bool:
        existing = await self.get(skill_name)
        if existing is None:
            return False
        await self._delete(skill_name)
        return True

    async def list(
        self, limit: int = 10, offset: int = 0, query: str = ""
    ) -> tuple[list[SavedSkill], int]:
        search_filter = SearchFilter(
            query=query,
            limit=limit,
            offset=offset,
        )
        items: list[SearchItem] = await self._search(search_filter)
        skills = [SavedSkill.model_validate(item.value) for item in items]
        skills.sort(key=lambda s: s.updated_at or datetime.min, reverse=True)
        # Get total count with a large limit search
        total_filter = SearchFilter(query=query, limit=1000, offset=0)
        total_items = await self._search(total_filter)
        total = len(total_items)
        return skills, total
