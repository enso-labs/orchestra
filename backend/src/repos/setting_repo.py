from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from src.models import Setting

class SettingRepo:
    def __init__(self, db: Session, user_id: str = None):
        self.db = db
        self.user_id = user_id

    def get_agent_settings(self, agent_id: str) -> List[Setting]:
        """Get all settings for an agent."""
        return self.db.query(Setting).filter(
            and_(
                Setting.agent_id == agent_id,
                Setting.user_id == self.user_id
            )
        ).all()

    def get_setting(self, agent_id: str, key: str) -> Optional[Setting]:
        """Get specific setting for an agent."""
        return self.db.query(Setting).filter(
            and_(
                Setting.agent_id == agent_id,
                Setting.user_id == self.user_id,
                Setting.key == key
            )
        ).first()

    def create_or_update(self, agent_id: str, key: str, value: str) -> Setting:
        """Create or update a setting."""
        setting = self.get_setting(agent_id, key)
        if setting:
            setting.value = value
        else:
            setting = Setting(
                user_id=self.user_id,
                agent_id=agent_id,
                key=key,
                value=value
            )
            self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def delete(self, agent_id: str, key: str) -> bool:
        """Delete a setting."""
        setting = self.get_setting(agent_id, key)
        if setting:
            self.db.delete(setting)
            self.db.commit()
            return True
        return False

    def delete_all(self, agent_id: str) -> bool:
        """Delete all settings for an agent."""
        settings = self.get_agent_settings(agent_id)
        for setting in settings:
            self.db.delete(setting)
        self.db.commit()
        return True