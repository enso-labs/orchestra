from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from src.models import Thread
from sqlalchemy import delete
from src.utils.logger import logger

class ThreadRepo:
    _instance = None
    
    def __new__(cls, db: AsyncSession, user_id: str = None):
        if cls._instance is None:
            cls._instance = super(ThreadRepo, cls).__new__(cls)
            cls._instance.db = None
            cls._instance.user_id = None
        return cls._instance
    
    def __init__(self, db: AsyncSession, user_id: str = None):
        # Update attributes if they've changed
        self.db = db
        self.user_id = user_id
        
    async def find_by_id(self, thread_id: str) -> Optional[Thread]:
        if self.user_id:
            query = select(Thread).filter(Thread.thread == thread_id and Thread.user == self.user_id)
        else:
            query = select(Thread).filter(Thread.thread == thread_id)
        result = await self.db.execute(query)
        return result.scalars().first()
    
    async def create(self, thread: Thread) -> Thread:
        try:
            # Check if thread already exists
            existing_thread = await self.find_by_id(thread.thread)
            if existing_thread:
                return existing_thread
                
            self.db.add(thread)
            await self.db.commit()
            await self.db.refresh(thread)
            return thread
        except Exception as e:
            # ensure the failed transaction is rolled back
            await self.db.rollback()
            logger.error(f"Failed to create thread: {e}")
            return None      # make the control flow explicit
    async def delete(self, thread_id: str) -> bool:
        try:
            query = delete(Thread).filter(
                (Thread.thread == thread_id) & (Thread.user == self.user_id)
            )
            await self.db.execute(query)
            await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to delete thread: {str(e)}")
            return False
    
    async def wipe(self, query: str) -> List[Thread]:
        query = select(Thread).filter(Thread.thread.like(f"%{query}%") and Thread.user == self.user_id)
        result = await self.db.execute(query)
        return result.scalars().all()