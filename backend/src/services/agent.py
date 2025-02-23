from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.repos.agent_repo import AgentRepo
from src.repos.setting_repo import SettingRepo
from src.entities import NewThread, ExistingThread
from src.utils.logger import logger

class AgentService:
    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id
        self.agent_repo = AgentRepo(db, user_id)
        self.setting_repo = SettingRepo(db, user_id)

    def create_agent(self, name: str, settings: NewThread, is_public: bool = False) -> Dict[str, Any]:
        """Create a new agent with initial settings"""
        try:
            # Create the agent first
            agent = self.agent_repo.create(name=name, is_public=is_public)
            
            # Store the settings as JSON
            setting_key = "default"  # Initial setting key
            self.setting_repo.create_or_update(
                agent_id=str(agent.id),
                key=setting_key,
                value=settings.model_dump_json()
            )
            
            # Update agent with current setting key
            self.agent_repo.update(
                agent_id=str(agent.id),
                data={"current_setting_key": setting_key}
            )
            
            return {
                "id": str(agent.id),
                "name": agent.name,
                "is_public": agent.is_public,
                "settings": settings.model_dump()
            }
        except Exception as e:
            logger.error(f"Failed to create agent: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create agent"
            )

    def get_agent_settings(self, agent_id: str) -> Dict[str, Any]:
        """Get agent with its current settings"""
        agent = self.agent_repo.get_by_id(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )

        # Get current settings
        setting = self.setting_repo.get_setting(
            agent_id=agent_id,
            key=agent.current_setting_key or "default"
        )
        
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent settings not found"
            )

        return {
            "id": str(agent.id),
            "name": agent.name,
            "is_public": agent.is_public,
            "settings": NewThread.model_validate_json(setting.value).model_dump()
        }

    def update_agent_settings(
        self, 
        agent_id: str, 
        settings: NewThread,
        setting_key: str = None
    ) -> Dict[str, Any]:
        """Update agent settings"""
        agent = self.agent_repo.get_by_id(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )

        # If no setting_key provided, use current or default
        setting_key = setting_key or agent.current_setting_key or "default"
        
        # Store new settings
        self.setting_repo.create_or_update(
            agent_id=agent_id,
            key=setting_key,
            value=settings.model_dump_json()
        )

        # Update agent's current setting key
        self.agent_repo.update(
            agent_id=agent_id,
            data={"current_setting_key": setting_key}
        )

        return {
            "id": str(agent.id),
            "name": agent.name,
            "is_public": agent.is_public,
            "settings": settings.model_dump()
        }

    def list_agent_settings(self, agent_id: str) -> List[Dict[str, Any]]:
        """List all settings for an agent"""
        agent = self.agent_repo.get_by_id(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )

        settings = self.setting_repo.get_agent_settings(agent_id)
        return [
            {
                "key": setting.key,
                "settings": NewThread.model_validate_json(setting.value).model_dump(),
                "is_current": setting.key == agent.current_setting_key
            }
            for setting in settings
        ]

    def delete_agent(self, agent_id: str) -> bool:
        """Delete agent and all its settings"""
        # Delete all settings first
        self.setting_repo.delete_all(agent_id)
        # Then delete the agent
        return self.agent_repo.delete(agent_id) 