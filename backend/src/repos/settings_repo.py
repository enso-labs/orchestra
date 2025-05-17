from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import Settings

class SettingsRepo:
    _instance = None
    _db = None
    _user_id = None

    def __new__(cls, db: AsyncSession, user_id: str):
        if cls._instance is None:
            cls._instance = super(SettingsRepo, cls).__new__(cls)
            cls._db = db
            cls._user_id = user_id
        return cls._instance

    @classmethod
    async def get_by_id(cls, settings_id: str) -> Optional[Settings]:
        """Get setting by ID."""
        query = select(Settings).filter(
            Settings.id == settings_id,
            Settings.user_id == cls._user_id
        ).first()
        result = await cls._db.execute(query)
        return result.scalar_one_or_none()

    def get_by_slug(self, slug: str) -> Optional[Settings]:
        """Get setting by slug."""
        return self.db.query(Settings).filter(
            Settings.slug == slug,
            Settings.user_id == self.user_id
        ).first()

    @classmethod
    async def get_all(cls) -> List[Settings]:
        """Get all settings."""
        query = select(Settings).filter(
            Settings.user_id == cls._user_id
        )
        result = await cls._db.execute(query)
        return result.scalars().all()

    def create(self, name: str, value: dict) -> Settings:
        try:
            setting = Settings(name=name, value=value, user_id=self.user_id)
            self.db.add(setting)
            self.db.commit()
            self.db.refresh(setting)
            return setting
        except Exception as e:
            raise e
        
    def update(self, settings_id: str, data: dict) -> Optional[Settings]:
        """Update setting data."""
        setting = self.get_by_id(settings_id)
        if setting:
            for key, value in data.items():
                if hasattr(setting, key):
                    setattr(setting, key, value)
            # If name is updated, regenerate slug
            if 'name' in data:
                setting.slug = Settings.generate_slug(data['name'])
            self.db.commit()
            self.db.refresh(setting)
        return setting

    def delete(self, settings_id: str) -> bool:
        """Delete a setting."""
        setting = self.get_by_id(settings_id)
        if setting:
            self.db.delete(setting)
            self.db.commit()
            return True
        return False

    def upsert_by_slug(self, name: str, value: dict) -> Settings:
        """Create or update a setting by its slug."""
        slug = Settings.generate_slug(name)
        setting = self.get_by_slug(slug)
        if setting:
            setting.name = name
            setting.value = value
            self.db.commit()
            self.db.refresh(setting)
        else:
            setting = self.create(name=name, value=value)
        return setting