import contextlib
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from psycopg_pool import ConnectionPool
from supabase import create_client
from supabase._sync.client import SyncClient

from src.utils.logger import logger
from src.constants import DB_URI, CONNECTION_POOL_KWARGS, Config

MAX_CONNECTION_POOL_SIZE = None

# SQLAlchemy engines
engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(ASYNC_DB_URI)
AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession)

def get_supabase_client() -> SyncClient:
    try:
        return create_client(
            supabase_url=Config.SUPABASE_URL,
            supabase_key=Config.SUPABASE_KEY,
        )
    except Exception as e:
        logger.error(f"Error creating supabase client: {e}")
        raise e

def get_checkpoint_db():
    return AsyncPostgresSaver.from_conn_string(DB_URI)

# Session context managers
def get_db() -> Generator[SessionLocal, None, None]: # type: ignore
    """Get a SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db() -> AsyncGenerator[AsyncSessionLocal, None]: # type: ignore
    """Get an async SQLAlchemy database session."""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()

# Connection pool context managers
@contextlib.contextmanager
def get_connection_pool(max_size: int = MAX_CONNECTION_POOL_SIZE) -> Generator[ConnectionPool, None, None]:
    """Get a psycopg connection pool with proper cleanup."""
    pool = ConnectionPool(
        conninfo=DB_URI,
        max_size=max_size,
        kwargs=CONNECTION_POOL_KWARGS,
    )
    try:
        yield pool
    finally:
        if not pool.closed:
            pool.close()