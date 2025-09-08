from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from src.schemas.models import Agent, Revision
from src.utils.logger import logger


class AgentRepo:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID with revisions and settings included."""
        stmt = (
            select(Agent)
            .options(selectinload(Agent.revisions).selectinload(Revision.setting))
            .where(Agent.id == agent_id, Agent.user_id == self.user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    def get_by_slug(self, slug: str) -> Optional[Agent]:
        """Get agent by slug with settings included."""
        return (
            self.db.query(Agent)
            .filter(Agent.slug == slug and Agent.user_id == self.user_id)
            .first()
        )

    async def get_all_user_agents(
        self, public: Optional[bool] = None, include_relations: bool = True
    ) -> List[Agent]:
        """Get all user agents with optional relation loading."""
        query = select(Agent)

        if include_relations:
            query = query.options(
                selectinload(Agent.revisions).selectinload(Revision.setting)
            )

        if public is True:
            query = query.filter(Agent.public == True)
        elif public is False:
            query = query.filter(Agent.public == False)
        else:  # public is None
            query = query.filter(Agent.user_id == self.user_id)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def create(
        self, name: str, description: str, settings_id: str, public: bool = False
    ) -> Agent:
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
                revision_number=1,  # Start with revision 1
            )

            self.db.add(agent)
            await self.db.flush()

            # Now create the first revision for this agent
            from src.repos.revision_repo import RevisionRepo

            revision_repo = RevisionRepo(db=self.db, user_id=self.user_id)
            revision = await revision_repo.create(
                agent_id=str(agent.id),
                settings_id=settings_id,
                name="Initial version",
                description="Initial agent configuration",
            )

            await self.db.commit()
            await self.db.refresh(agent)
            return await self.get_by_id(str(agent.id))
        except IntegrityError as e:
            logger.error(f"IntegrityError: {str(e)}")
            await self.db.rollback()
            raise ValueError(f"Agent with name '{name}' already exists")
        except Exception as e:
            logger.exception(f"Failed to create agent: {str(e)}")
            await self.db.rollback()
            raise e

    async def update(self, agent_id: str, data: dict) -> Optional[Agent]:
        """Update agent data."""
        agent = await self.get_by_id(agent_id)
        if agent:
            for key, value in data.items():
                if hasattr(agent, key):
                    setattr(agent, key, value)
            # If name is updated, regenerate slug
            if "name" in data:
                agent.slug = Agent.generate_slug(data["name"])
            self.db.commit()
            self.db.refresh(agent)
        return agent

    async def delete(self, agent_id: str) -> bool:
        """Delete an agent."""
        try:
            agent = await self.get_by_id(agent_id)
            if agent:
                await self.db.delete(agent)
                await self.db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete agent: {str(e)}")
            return False

    def get_by_setting_id(self, settings_id: str) -> List[Agent]:
        """Get all agents for a specifics setting."""
        return self.db.query(Agent).filter(Agent.settings_id == settings_id).all()

    def get_public_agents(self) -> List[Agent]:
        """Get all public agents."""
        return self.db.query(Agent).filter(Agent.public == True).all()
