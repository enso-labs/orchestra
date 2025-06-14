import contextlib
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from psycopg_pool import ConnectionPool
from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from langgraph.store.postgres import AsyncPostgresStore
from langchain.embeddings.base import init_embeddings

MAX_CONNECTION_POOL_SIZE = None

# SQLAlchemy engines
engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(ASYNC_DB_URI)
AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession)

# Create a single shared base instance
_Base = declarative_base()

def get_db_base() -> declarative_base:
    return _Base

def load_models():
    """Import all models to ensure they are registered with SQLAlchemy"""
    from src.schemas.models import User, Token, Agent, Revision, Settings, Thread, Server
    return _Base

def get_checkpoint_db() -> AsyncPostgresSaver:
    return AsyncPostgresSaver.from_conn_string(DB_URI)

def get_store_db() -> AsyncPostgresStore:
    return AsyncPostgresStore.from_conn_string(
        conn_string=DB_URI,
        index={
            "dims": 1536,
            "embed": init_embeddings("openai:text-embedding-3-small"),
            "fields": ["memory"]  # specify which fields to embed. Default is the whole serialized value
        }
    )

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