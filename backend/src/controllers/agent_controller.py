from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from src.models import Agent, AgentRevision
from src.repos.agent_repo import AgentRepo
from src.repos.settings_repo import SettingsRepo
from src.utils.logger import logger

class AgentController:
    """
    Controller for managing agents and their revisions.
    
    This controller serves as an intermediary between the API routes and
    the database repositories, handling business logic and validation.
    """
    
    def __init__(self, db: Session, user_id: str):
        """Initialize the agent controller with database session and user ID."""
        self.db = db
        self.user_id = user_id
        self.agent_repo = AgentRepo(db, user_id)
        self.settings_repo = SettingsRepo(db, user_id)
    
    # Agent Management
    
    def list_agents(self, include_public: bool = False) -> List[Agent]:
        """
        List all agents for the current user.
        
        Args:
            include_public: If True, also include public agents created by other users
            
        Returns:
            List of Agent objects
        """
        user_agents = self.agent_repo.get_all()
        
        if include_public:
            public_agents = self.agent_repo.get_public()
            # Filter out user's own agents to avoid duplicates
            other_public_agents = [
                agent for agent in public_agents 
                if str(agent.user_id) != self.user_id
            ]
            return user_agents + other_public_agents
            
        return user_agents
    
    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """
        Get an agent by ID.
        
        Args:
            agent_id: UUID of the agent
            
        Returns:
            Agent object if found and accessible, None otherwise
        """
        agent = self.agent_repo.get_by_id(agent_id)
        
        # Check if agent exists and user has access to it
        if not agent:
            return None
            
        # Return if it belongs to the user or is public
        if str(agent.user_id) == self.user_id or agent.visibility == 'public':
            return agent
            
        return None
    
    def get_agent_by_slug(self, slug: str) -> Optional[Agent]:
        """
        Get an agent by slug.
        
        Args:
            slug: URL-friendly identifier
            
        Returns:
            Agent object if found, None otherwise
        """
        # User's own agents are found by slug
        return self.agent_repo.get_by_slug(slug)
    
    def create_agent(self, 
                    name: str, 
                    description: Optional[str] = None, 
                    visibility: str = 'private', 
                    settings_id: Optional[str] = None,
                    settings_data: Optional[Dict[str, Any]] = None) -> Agent:
        """
        Create a new agent with optional initial settings.
        
        Args:
            name: Name of the agent
            description: Optional description
            visibility: 'public' or 'private'
            settings_id: Optional ID of existing settings to use
            settings_data: Optional settings data to create new settings
            
        Returns:
            Newly created Agent object
        """
        # Validate that either settings_id or settings_data is provided, but not both
        if settings_id and settings_data:
            raise ValueError("Cannot provide both settings_id and settings_data")
        
        # Create the agent
        agent = self.agent_repo.create(
            name=name,
            description=description,
            visibility=visibility
        )
        
        # If settings are provided, create initial revision
        if settings_id:
            # Validate the settings exist and user has access
            settings = self.settings_repo.get_by_id(settings_id)
            if not settings:
                raise ValueError(f"Settings with ID {settings_id} not found")
                
            # Create revision with existing settings
            self._create_revision(agent.id, settings_id, "Initial version", "Created with agent")
            
        elif settings_data:
            # Create new settings and revision
            settings_name = f"{name} Settings"
            settings = self.settings_repo.create(name=settings_name, value=settings_data)
            
            # Create revision with new settings
            self._create_revision(agent.id, str(settings.id), "Initial version", "Created with agent")
        
        return agent
    
    def update_agent(self, agent_id: str, data: Dict[str, Any]) -> Optional[Agent]:
        """
        Update an agent's properties.
        
        Args:
            agent_id: UUID of the agent
            data: Dictionary of fields to update
            
        Returns:
            Updated Agent object if successful, None otherwise
        """
        # Ensure the agent exists and user has access
        agent = self.get_agent(agent_id)
        if not agent or str(agent.user_id) != self.user_id:
            return None
            
        return self.agent_repo.update(agent_id, data)
    
    def delete_agent(self, agent_id: str) -> bool:
        """
        Delete an agent.
        
        Args:
            agent_id: UUID of the agent
            
        Returns:
            True if deletion was successful, False otherwise
        """
        # The repo method already checks ownership
        return self.agent_repo.delete(agent_id)
    
    # Revision Management
    
    def list_revisions(self, agent_id: str) -> List[AgentRevision]:
        """
        List all revisions for an agent.
        
        Args:
            agent_id: UUID of the agent
            
        Returns:
            List of AgentRevision objects
        """
        # Ensure the agent exists and user has access
        agent = self.get_agent(agent_id)
        if not agent:
            return []
            
        return self.agent_repo.get_revisions(agent_id)
    
    def get_revision(self, revision_id: str) -> Optional[AgentRevision]:
        """
        Get a specific revision.
        
        Args:
            revision_id: UUID of the revision
            
        Returns:
            AgentRevision object if found and accessible, None otherwise
        """
        return self.agent_repo.get_revision(revision_id)
    
    def create_revision(self, 
                        agent_id: str, 
                        settings_id: Optional[str] = None,
                        settings_data: Optional[Dict[str, Any]] = None,
                        revision_name: Optional[str] = None,
                        change_notes: Optional[str] = None) -> Optional[AgentRevision]:
        """
        Create a new revision for an agent.
        
        Args:
            agent_id: UUID of the agent
            settings_id: Optional ID of existing settings to use
            settings_data: Optional settings data to create new settings
            revision_name: Optional name for the revision
            change_notes: Optional description of changes
            
        Returns:
            Newly created AgentRevision if successful, None otherwise
        """
        # Ensure the agent exists and user has access
        agent = self.get_agent(agent_id)
        if not agent or str(agent.user_id) != self.user_id:
            return None
            
        # Validate that either settings_id or settings_data is provided, but not both
        if settings_id and settings_data:
            raise ValueError("Cannot provide both settings_id and settings_data")
            
        if not settings_id and not settings_data:
            raise ValueError("Must provide either settings_id or settings_data")
            
        # If settings data is provided, create new settings
        if settings_data:
            settings_name = f"{agent.name} Settings v{self._get_next_version_number(agent_id)}"
            settings = self.settings_repo.create(name=settings_name, value=settings_data)
            settings_id = str(settings.id)
        
        return self._create_revision(
            agent_id, 
            settings_id, 
            revision_name, 
            change_notes
        )
    
    def set_current_revision(self, agent_id: str, revision_id: str) -> Optional[Agent]:
        """
        Set the current revision for an agent.
        
        Args:
            agent_id: UUID of the agent
            revision_id: UUID of the revision
            
        Returns:
            Updated Agent object if successful, None otherwise
        """
        # Ensure the agent exists and user owns it
        agent = self.get_agent(agent_id)
        if not agent or str(agent.user_id) != self.user_id:
            return None
            
        return self.agent_repo.set_current_revision(agent_id, revision_id)
    
    # Helper Methods
    
    def _create_revision(self, 
                        agent_id: str, 
                        settings_id: str,
                        revision_name: Optional[str] = None,
                        change_notes: Optional[str] = None) -> AgentRevision:
        """Internal method to create a revision with proper version numbering."""
        # Get appropriate version name if not provided
        if not revision_name:
            next_version = self._get_next_version_number(agent_id)
            revision_name = f"Version {next_version}"
            
        return self.agent_repo.create_revision(
            agent_id=agent_id,
            settings_id=settings_id,
            revision_name=revision_name,
            change_notes=change_notes
        )
    
    def _get_next_version_number(self, agent_id: str) -> int:
        """Calculate the next version number for an agent's revisions."""
        revisions = self.agent_repo.get_revisions(agent_id)
        if not revisions:
            return 1
        return max(r.version_number for r in revisions) + 1 