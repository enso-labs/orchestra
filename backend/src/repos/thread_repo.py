from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from src.models import Thread

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
        query = select(Thread).filter(Thread.thread == thread_id)
        result = await self.db.execute(query)
        return result.scalars().first()