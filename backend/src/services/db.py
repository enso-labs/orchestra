from contextlib import asynccontextmanager
from typing import AsyncGenerator, AsyncIterator

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

try:
    from fastapi import Request
except ImportError:
    Request = object
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import IndexConfig
from langgraph.store.postgres.base import PostgresIndexConfig
from langchain.embeddings import init_embeddings
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import async_sessionmaker
from src.constants import (
    CHECKPOINT_ENABLE_FALLBACK,
    CHECKPOINT_HEALTH_CHECK_INTERVAL,
    CHECKPOINT_JITTER,
    CHECKPOINT_MAX_DELAY,
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_RETRY_DELAY,
    CHECKPOINT_USE_RESILIENT,
    DB_KEEPALIVE_COUNT,
    DB_KEEPALIVE_IDLE,
    DB_KEEPALIVE_INTERVAL,
    DB_POOL_MAX_LIFETIME,
    DB_POOL_MAX_SIZE,
    DB_POOL_MIN_SIZE,
    DB_SQLA_POOL_MAX_OVERFLOW,
    DB_SQLA_POOL_RECYCLE,
    DB_SQLA_POOL_SIZE,
    DB_SQLA_POOL_TIMEOUT,
    DB_URI,
    DB_URI_SESSION,
)
from src.utils.db import get_asyncpg_connect_args, get_asyncpg_url
from langgraph.store.postgres import AsyncPostgresStore, PoolConfig

MAX_CONNECTION_POOL_SIZE = None

# SQLAlchemy async engine
ASYNC_DB_URI = get_asyncpg_url(DB_URI)
# Disable statement cache for pgbouncer/connection pooler compatibility
# See: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#prepared-statement-cache
async_engine = create_async_engine(
    ASYNC_DB_URI,
    connect_args=get_asyncpg_connect_args(DB_URI),
    pool_size=DB_SQLA_POOL_SIZE,
    max_overflow=DB_SQLA_POOL_MAX_OVERFLOW,
    pool_timeout=DB_SQLA_POOL_TIMEOUT,
    pool_recycle=DB_SQLA_POOL_RECYCLE,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)

# Create a single shared base instance
_Base = declarative_base()


########################################################
## SQLAlchemy
########################################################
def get_db_base():
    return _Base


def load_models():
    """Import all models to ensure they are registered with SQLAlchemy"""

    return _Base


DEFAULT_EMBED = "openai:text-embedding-3-small"
DEFAULT_FIELDS = ["page_content", "metadata"]


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Get an async SQLAlchemy database session."""
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()


########################################################
## Langgraph Stores (Memory, Postgres)
########################################################
def get_store(req: Request) -> AsyncPostgresStore:
    return req.app.state.store


def get_store_in_memory(
    embed: str = "openai:text-embedding-3-small",
    fields: list[str] = [],
    dims: int = 1536,
) -> InMemoryStore:
    if fields:
        index = IndexConfig(
            dims=dims,
            embed=init_embeddings(embed),
            fields=fields,
        )
        return InMemoryStore(index=index)
    return InMemoryStore()


def get_checkpoint_connection_kwargs() -> dict:
    """Generate connection kwargs optimized for checkpointing.

    Returns kwargs compatible with psycopg.AsyncConnection.connect()
    that ensure:
    - Prepared statements disabled (pooler compatibility)
    - TCP keepalives enabled (stale connection detection)
    - Autocommit mode (required by AsyncPostgresSaver)
    """
    return {
        "autocommit": True,
        "prepare_threshold": None,  # Disable prepared statements for pooler
        "row_factory": dict_row,
        "keepalives": 1,
        "keepalives_idle": DB_KEEPALIVE_IDLE,
        "keepalives_interval": DB_KEEPALIVE_INTERVAL,
        "keepalives_count": DB_KEEPALIVE_COUNT,
    }


@asynccontextmanager
async def get_resilient_checkpoint_db():
    """
    Create a ResilientAsyncPostgresSaver with connection resilience.

    Uses DB_URI_SESSION (session-mode connection) for better stability
    with long-running checkpoint operations.

    Features:
    - TCP keepalive for connection health
    - Auto-reconnection on connection loss
    - Exponential backoff retry on transient failures
    - Optional fallback to in-memory storage
    """
    from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver

    saver = ResilientAsyncPostgresSaver(
        connection_string=DB_URI_SESSION,
        max_retries=CHECKPOINT_MAX_RETRIES,
        base_delay=CHECKPOINT_RETRY_DELAY,
        max_delay=CHECKPOINT_MAX_DELAY,
        jitter=CHECKPOINT_JITTER,
        enable_fallback=CHECKPOINT_ENABLE_FALLBACK,
        health_check_interval=CHECKPOINT_HEALTH_CHECK_INTERVAL,
        keepalives=1,
        keepalives_idle=DB_KEEPALIVE_IDLE,
        keepalives_interval=DB_KEEPALIVE_INTERVAL,
        keepalives_count=DB_KEEPALIVE_COUNT,
    )
    try:
        await saver.connect()
        yield saver
    finally:
        await saver.close()


@asynccontextmanager
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    """
    Create an AsyncPostgresSaver with explicit connection kwargs.

    If CHECKPOINT_USE_RESILIENT is enabled, returns a ResilientAsyncPostgresSaver
    instead, which provides automatic retry and reconnection capabilities.

    Uses the solution from: https://github.com/langchain-ai/langgraph/issues/2755
    - autocommit=True: Required for checkpoint operations
    - prepare_threshold=0: Disables prepared statements for connection pooler compatibility
    - row_factory=dict_row: Required by AsyncPostgresSaver
    """
    if CHECKPOINT_USE_RESILIENT:
        async with get_resilient_checkpoint_db() as saver:
            yield saver
    else:
        async with await AsyncConnection.connect(
            DB_URI,
            autocommit=True,
            prepare_threshold=None,  # MUST be 0 for pgbouncer
            row_factory=dict_row,
        ) as conn:
            yield AsyncPostgresSaver(conn)


def get_store_db(
    embed: str = DEFAULT_EMBED,
    dims: int = 1536,
    fields: list[str] = [],
) -> AsyncIterator[AsyncPostgresStore]:
    """
    Create an AsyncPostgresStore with connection pooling.

    Note: Explicitly passing prepare_threshold=0 in kwargs to ensure
    prepared statements are disabled for pgbouncer compatibility.
    """
    return AsyncPostgresStore.from_conn_string(
        conn_string=DB_URI,
        pool_config=PoolConfig(
            min_size=DB_POOL_MIN_SIZE,
            max_size=DB_POOL_MAX_SIZE,
            max_lifetime=DB_POOL_MAX_LIFETIME,
            kwargs={
                "prepare_threshold": None,
            },
        ),
        index=PostgresIndexConfig(
            embed=init_embeddings(embed),
            dims=dims,
            fields=fields,
        ),
    )
