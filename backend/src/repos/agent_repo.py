from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc
from uuid import UUID

from src.models import Agent, AgentRevision, Settings

class AgentRepo:
    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    def get_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID."""
        return self.db.query(Agent).filter(Agent.id == agent_id).first()

    def get_by_slug(self, slug: str) -> Optional[Agent]:
        """Get agent by slug for the current user."""
        return self.db.query(Agent).filter(
            Agent.user_id == self.user_id,
            Agent.slug == slug
        ).first()

    def get_all(self) -> List[Agent]:
        """Get all agents for the current user."""
        return self.db.query(Agent).filter(Agent.user_id == self.user_id).all()
    
    def get_public(self) -> List[Agent]:
        """Get all public agents."""
        return self.db.query(Agent).filter(
            Agent.visibility == 'public',
            Agent.is_active == True
        ).all()

    def create(self, name: str, description: str = None, visibility: str = 'private') -> Agent:
        """Create a new agent."""
        agent = Agent(
            name=name,
            user_id=self.user_id,
            description=description,
            visibility=visibility
        )
        self.db.add(agent)
        self.db.commit()
        self.db.refresh(agent)
        return agent

    def update(self, agent_id: str, data: dict) -> Optional[Agent]:
        """Update agent data."""
        agent = self.get_by_id(agent_id)
        
        # Check if the agent belongs to the current user
        if agent and str(agent.user_id) == self.user_id:
            for key, value in data.items():
                if hasattr(agent, key) and key != 'user_id':  # Prevent changing user_id
                    setattr(agent, key, value)
            
            # If name is updated, regenerate slug
            if 'name' in data:
                agent.slug = Agent.generate_slug(data['name'])
                
            self.db.commit()
            self.db.refresh(agent)
            return agent
            
        return None

    def delete(self, agent_id: str) -> bool:
        """Delete an agent."""
        agent = self.get_by_id(agent_id)
        
        # Check if the agent belongs to the current user
        if agent and str(agent.user_id) == self.user_id:
            self.db.delete(agent)
            self.db.commit()
            return True
            
        return False
    
    # Revision management methods
    def create_revision(self, agent_id: str, settings_id: str, revision_name: str = None, 
                        change_notes: str = None) -> Optional[AgentRevision]:
        """Create a new revision for an agent."""
        agent = self.get_by_id(agent_id)
        
        # Check if the agent belongs to the current user
        if not agent or str(agent.user_id) != self.user_id:
            return None
            
        # Get the latest version number for this agent
        latest_revision = self.db.query(AgentRevision).filter(
            AgentRevision.agent_id == agent_id
        ).order_by(desc(AgentRevision.version_number)).first()
        
        version_number = 1
        if latest_revision:
            version_number = latest_revision.version_number + 1
            
        # Create the new revision
        revision = AgentRevision(
            agent_id=agent_id,
            settings_id=settings_id,
            version_number=version_number,
            revision_name=revision_name,
            change_notes=change_notes
        )
        self.db.add(revision)
        
        # Set this as the current revision for the agent
        agent.current_revision_id = revision.id
        
        self.db.commit()
        self.db.refresh(revision)
        return revision
        
    def get_revisions(self, agent_id: str) -> List[AgentRevision]:
        """Get all revisions for an agent."""
        agent = self.get_by_id(agent_id)
        
        # Check if the agent belongs to the current user or is public
        if not agent or (str(agent.user_id) != self.user_id and agent.visibility != 'public'):
            return []
            
        return self.db.query(AgentRevision).filter(
            AgentRevision.agent_id == agent_id
        ).order_by(desc(AgentRevision.version_number)).all()
        
    def get_revision(self, revision_id: str) -> Optional[AgentRevision]:
        """Get a specific revision."""
        revision = self.db.query(AgentRevision).filter(
            AgentRevision.id == revision_id
        ).first()
        
        if not revision:
            return None
            
        # Check if the agent for this revision belongs to the current user or is public
        agent = self.get_by_id(str(revision.agent_id))
        if not agent or (str(agent.user_id) != self.user_id and agent.visibility != 'public'):
            return None
            
        return revision
        
    def set_current_revision(self, agent_id: str, revision_id: str) -> Optional[Agent]:
        """Set the current revision for an agent."""
        agent = self.get_by_id(agent_id)
        
        # Check if the agent belongs to the current user
        if not agent or str(agent.user_id) != self.user_id:
            return None
            
        # Check if the revision belongs to this agent
        revision = self.get_revision(revision_id)
        if not revision or str(revision.agent_id) != agent_id:
            return None
            
        agent.current_revision_id = revision_id
        self.db.commit()
        self.db.refresh(agent)
        return agent 