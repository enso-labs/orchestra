import contextlib
import functools
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import AsyncGenerator, Generator, Callable
import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from psycopg_pool import ConnectionPool, AsyncConnectionPool

from src.constants import DB_URI, CONNECTION_POOL_KWARGS

MAX_CONNECTION_POOL_SIZE = None

# SQLAlchemy engines
Base = sa.orm.declarative_base()
engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(ASYNC_DB_URI)
AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession)

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

@contextlib.asynccontextmanager
async def get_async_connection_pool(max_size: int = MAX_CONNECTION_POOL_SIZE) -> AsyncGenerator[AsyncConnectionPool, None]:
    """Get an async psycopg connection pool with proper cleanup."""
    pool = AsyncConnectionPool(
        conninfo=DB_URI,
        max_size=max_size,
        kwargs=CONNECTION_POOL_KWARGS,
        # open=False  # Ensure pool is not opened in constructor
    )
    try:
        # await pool.open()  # Explicitly open the pool
        yield pool
    finally:
        if not pool.closed:
            await pool.close()

# Direct pool creation for existing code that needs to be updated later
def create_async_pool(max_size: int = MAX_CONNECTION_POOL_SIZE) -> AsyncConnectionPool:
    """Create an async connection pool (use within a try-finally block)."""
    return AsyncConnectionPool(
        conninfo=DB_URI,
        max_size=max_size,
        kwargs=CONNECTION_POOL_KWARGS,
        open=False  # Ensure pool is not opened in constructor
    )

def keep_pool_alive(func: Callable) -> Callable:
    """Decorator to ensure the pool stays alive during streaming."""
    
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        # Create a pool that will be kept alive for the entire streaming duration
        pool = create_async_pool()
        await pool.open()
        
        try:
            # Replace the pool in Agent instance (assuming first arg is self)
            if args and hasattr(args[0], 'pool'):
                original_pool = args[0].pool
                args[0].pool = pool
                
            # Call the original function with our long-lived pool
            result = await func(*args, **kwargs)
            return result
        finally:
            # Only close the pool when the entire response is done
            # if not pool.closed:
            #     await pool.close()
            pass
    
    return wrapper 