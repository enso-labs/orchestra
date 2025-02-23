from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.models import Agent

class AgentRepo:
    def __init__(self, db: Session, user_id: str = None):
        self.db = db
        self.user_id = user_id

    def get_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID."""
        return self.db.query(Agent).filter(Agent.id == agent_id).first()

    def get_user_agents(self, include_public: bool = False) -> List[Agent]:
        """Get all agents owned by user."""
        query = self.db.query(Agent)
        if include_public:
            query = query.filter(
                or_(
                    Agent.owner_id == self.user_id,
                    Agent.is_public == True
                )
            )
        else:
            query = query.filter(Agent.owner_id == self.user_id)
        return query.all()

    def create(self, name: str, is_public: bool = False) -> Agent:
        """Create a new agent."""
        agent = Agent(
            owner_id=self.user_id,
            name=name,
            is_public=is_public
        )
        self.db.add(agent)
        self.db.commit()
        self.db.refresh(agent)
        return agent

    def update(self, agent_id: str, data: dict) -> Optional[Agent]:
        """Update agent."""
        agent = self.get_by_id(agent_id)
        if agent and agent.owner_id == UUID(self.user_id):
            for key, value in data.items():
                setattr(agent, key, value)
            self.db.commit()
            self.db.refresh(agent)
        return agent

    def delete(self, agent_id: str) -> bool:
        """Delete agent."""
        agent = self.get_by_id(agent_id)
        if agent and agent.owner_id == UUID(self.user_id):
            self.db.delete(agent)
            self.db.commit()
            return True
        return False