from typing import Optional, List
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from src.schemas.models import Revision, Agent
from sqlalchemy import select

class RevisionRepo:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self, revision_id: str) -> Optional[Revision]:
        """Get revision by ID with settings included."""
        stmt = select(Revision).options(
            joinedload(Revision.setting)
        ).where(Revision.id == revision_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_revision_number(self, agent_id: str, revision_number: int) -> Optional[Revision]:
        """Get revision by agent_id and revision number with settings included."""
        stmt = select(Revision).options(
            joinedload(Revision.setting)
        ).where(
            Revision.agent_id == agent_id,
            Revision.revision_number == revision_number
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_latest_revision(self, agent_id: str) -> Optional[Revision]:
        """Get the latest revision for an agent."""
        stmt = select(Revision).where(
            Revision.agent_id == agent_id
        ).order_by(Revision.revision_number.desc())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all_for_agent(self, agent_id: str) -> List[Revision]:
        """Get all revisions for an agent."""
        stmt = select(Revision).where(
            Revision.agent_id == agent_id
        ).order_by(Revision.revision_number.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def create(self, agent_id: str, settings_id: str, name: str = None, description: str = None) -> Revision:
        """Create a new revision for an agent."""
        try:
            # Verify agent belongs to the user
            stmt = select(Agent).where(
                Agent.id == agent_id,
                Agent.user_id == self.user_id
            )
            result = await self.db.execute(stmt)
            agent = result.scalars().first()
            
            if not agent:
                raise ValueError(f"Agent with ID {agent_id} not found or doesn't belong to user")
            
            # Get the latest revision number and increment
            latest_revision = await self.get_latest_revision(agent_id)
            revision_number = 1
            if latest_revision:
                revision_number = latest_revision.revision_number + 1
            
            # Create new revision
            revision = Revision(
                agent_id=agent_id,
                user_id=self.user_id,
                settings_id=settings_id,
                revision_number=revision_number,
                name=name,
                description=description
            )
            
            self.db.add(revision)
            
            # Update agent's revision_number to match the new revision
            agent.revision_number = revision_number
            
            await self.db.commit()
            await self.db.refresh(revision)
            return revision
        except IntegrityError:
            await self.db.rollback()
            raise ValueError(f"Error creating revision for agent {agent_id}")
        except Exception as e:
            await self.db.rollback()
            raise e

    async def set_active_revision(self, agent_id: str, revision_number: int) -> Optional[Agent]:
        """Set a specific revision as the active one for an agent."""
        # Verify agent belongs to the user
        stmt = select(Agent).where(
            Agent.id == agent_id,
            Agent.user_id == self.user_id
        )
        result = await self.db.execute(stmt)
        agent = result.scalars().first()
        
        if not agent:
            raise ValueError(f"Agent with ID {agent_id} not found or doesn't belong to user")
        
        # Verify revision exists
        revision = await self.get_by_revision_number(agent_id, revision_number)
        if not revision:
            raise ValueError(f"Revision {revision_number} not found for agent {agent_id}")
        
        # Update agent's revision_number only (no need to update settings_id)
        agent.revision_number = revision.revision_number
        
        await self.db.commit()
        await self.db.refresh(agent)
        return agent
    
    async def delete(self, revision_id: str) -> bool:
        """Delete a revision."""
        revision = await self.get_by_id(revision_id)
        if not revision:
            return False
            
        # Check if this is the active revision for the agent
        stmt = select(Agent).where(Agent.id == revision.agent_id)
        result = await self.db.execute(stmt)
        agent = result.scalars().first()
        
        if agent and agent.revision_number == revision.revision_number:
            raise ValueError("Cannot delete the active revision")
            
        self.db.delete(revision)
        await self.db.commit()
        return True 