from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from src.models import Thread
from sqlalchemy import delete
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
    
    async def delete(self, thread_id: str) -> bool:
        query = delete(Thread).filter(Thread.thread == thread_id and Thread.user == self.user_id)
        await self.db.execute(query)
        return True
    
    async def wipe(self, query: str) -> List[Thread]:
        query = select(Thread).filter(Thread.thread.like(f"%{query}%") and Thread.user == self.user_id)
        result = await self.db.execute(query)
        return result.scalars().all()