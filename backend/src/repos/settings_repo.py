from typing import Optional, List
from sqlalchemy.orm import Session
from src.models import Settings

class SettingsRepo:
    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    def get_by_id(self, settings_id: str) -> Optional[Settings]:
        """Get setting by ID."""
        return self.db.query(Settings).filter(Settings.id == settings_id).first()

    def get_by_slug(self, slug: str) -> Optional[Settings]:
        """Get setting by slug."""
        return self.db.query(Settings).filter(Settings.slug == slug).first()

    def get_all(self) -> List[Settings]:
        """Get all settings."""
        return self.db.query(Settings).all()

    def create(self, name: str, value: dict) -> Settings:
        """Create a new setting."""
        setting = Settings(name=name, value=value)
        self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

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