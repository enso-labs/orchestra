from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import Settings

class SettingsRepo:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self, settings_id: str) -> Optional[Settings]:
        """Get setting by ID."""
        query = select(Settings).filter(
            Settings.id == settings_id,
            Settings.user_id == self.user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Settings]:
        """Get setting by slug."""
        query = select(Settings).filter(
            Settings.slug == slug,
            Settings.user_id == self.user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_all(self) -> List[Settings]:
        """Get all settings."""
        query = select(Settings).filter(
            Settings.user_id == self.user_id
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def create(self, name: str, value: dict) -> Settings:
        try:
            setting = Settings(name=name, value=value, user_id=self.user_id)
            self.db.add(setting)
            await self.db.commit()
            await self.db.refresh(setting)
            return setting
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def update(self, settings_id: str, data: dict) -> Optional[Settings]:
        """Update setting data."""
        setting = await self.get_by_id(settings_id)
        if setting:
            try:
                for key, value in data.items():
                    if hasattr(setting, key):
                        setattr(setting, key, value)
                # If name is updated, regenerate slug
                if 'name' in data:
                    setting.slug = Settings.generate_slug(data['name'])
                await self.db.commit()
                await self.db.refresh(setting)
            except Exception as e:
                await self.db.rollback()
                raise e
        return setting

    async def delete(self, settings_id: str) -> bool:
        """Delete a setting."""
        setting = await self.get_by_id(settings_id)
        if setting:
            try:
                await self.db.delete(setting)
                await self.db.commit()
                return True
            except Exception as e:
                await self.db.rollback()
                raise e
        return False

    async def upsert_by_slug(self, name: str, value: dict) -> Settings:
        """Create or update a setting by its slug."""
        slug = Settings.generate_slug(name)
        setting = await self.get_by_slug(slug)
        if setting:
            try:
                setting.name = name
                setting.value = value
                await self.db.commit()
                await self.db.refresh(setting)
            except Exception as e:
                await self.db.rollback()
                raise e
        else:
            setting = await self.create(name=name, value=value)
        return setting