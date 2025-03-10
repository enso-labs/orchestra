from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from src.models import Agent

class AgentRepo:
    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    def get_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID with settings included."""
        return self.db.query(Agent).filter(Agent.id == agent_id and Agent.user_id == self.user_id).first()

    def get_by_slug(self, slug: str) -> Optional[Agent]:
        """Get agent by slug with settings included."""
        return self.db.query(Agent).filter(Agent.slug == slug and Agent.user_id == self.user_id).first()
        
    def get_all_user_agents(self, public: bool = False) -> List[Agent]:
        if public:
            return self.db.query(Agent).filter(Agent.public == True).all()
        else:
            return self.db.query(Agent).filter(Agent.user_id == self.user_id).all()

    def get_all(self) -> List[Agent]:
        """Get all agents without settings included."""
        return self.db.query(Agent).all()

    def create(self, name: str, description: str, settings_id: str, public: bool = False) -> Agent:
        """Create a new agent."""
        try:
            # Generate a slug for the agent name
            slug = Agent.generate_slug(name)
            
            # Create a new agent with revision_number=1 (initial version)
            agent = Agent(
                user_id=self.user_id,
                name=name,
                description=description,
                public=public,
                slug=slug,
                revision_number=1  # Start with revision 1
            )
            
            self.db.add(agent)
            self.db.flush()  # This assigns an ID to the agent
            
            # Now create the first revision for this agent
            from src.repos.revision_repo import RevisionRepo
            revision_repo = RevisionRepo(db=self.db, user_id=self.user_id)
            revision = revision_repo.create(
                agent_id=str(agent.id),
                settings_id=settings_id,
                name="Initial version",
                description="Initial agent configuration"
            )
            
            self.db.commit()
            self.db.refresh(agent)
            return agent
        except IntegrityError:
            self.db.rollback()
            raise ValueError(f"Agent with name '{name}' already exists")
        except Exception as e:
            self.db.rollback()
            raise e

    def update(self, agent_id: str, data: dict) -> Optional[Agent]:
        """Update agent data."""
        agent = self.get_by_id(agent_id)
        if agent:
            for key, value in data.items():
                if hasattr(agent, key):
                    setattr(agent, key, value)
            # If name is updated, regenerate slug
            if 'name' in data:
                agent.slug = Agent.generate_slug(data['name'])
            self.db.commit()
            self.db.refresh(agent)
        return agent

    def delete(self, agent_id: str) -> bool:
        """Delete an agent."""
        agent = self.get_by_id(agent_id)
        if agent:
            self.db.delete(agent)
            self.db.commit()
            return True
        return False

    def get_by_setting_id(self, settings_id: str) -> List[Agent]:
        """Get all agents for a specifics setting."""
        return self.db.query(Agent).filter(Agent.settings_id == settings_id).all()

    def get_public_agents(self) -> List[Agent]:
        """Get all public agents."""
        return self.db.query(Agent).filter(Agent.public == True).all()
