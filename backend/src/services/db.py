import asyncio
import contextlib
import inspect
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, AsyncIterator, Optional

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
)
from src.utils.db import get_asyncpg_connect_args, get_asyncpg_url
from src.utils.logger import logger
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
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    """
    Create an AsyncPostgresSaver with explicit connection kwargs.

    Uses the solution from: https://github.com/langchain-ai/langgraph/issues/2755
    - autocommit=True: Required for checkpoint operations
    - prepare_threshold=0: Disables prepared statements for connection pooler compatibility
    - row_factory=dict_row: Required by AsyncPostgresSaver
    """
    async with await AsyncConnection.connect(
        DB_URI,
        autocommit=True,
        prepare_threshold=None,  # MUST be 0 for pgbouncer
        row_factory=dict_row,
    ) as conn:
        yield AsyncPostgresSaver(conn)


def get_store_application_name(pid: int | None = None) -> str:
    """`application_name` stamped on this process's store connections.

    Makes #957's acceptance query attributable per process rather than a bare
    count::

        SELECT application_name, count(*) FROM pg_stat_activity
        WHERE datname = current_database() GROUP BY 1;

    Postgres truncates `application_name` at NAMEDATALEN (63 bytes); this is far
    under.
    """
    return f"orchestra-store-{os.getpid() if pid is None else pid}"


def get_store_db(
    embed: str = DEFAULT_EMBED,
    dims: int = 1536,
    fields: list[str] = [],
) -> AsyncIterator[AsyncPostgresStore]:
    """Create a NEW AsyncPostgresStore with its own psycopg connection pool.

    Every call opens another pool of at least ``DB_POOL_MIN_SIZE`` connections,
    which psycopg opens eagerly -- issue #957 traced Postgres backend growth to
    exactly that. This is **not** what request, task, or job code should call;
    use :func:`get_shared_store`, which enters this factory once per process and
    hands the same store to every caller.

    Reach for this directly only when you want an isolated pool whose lifetime
    you own: startup setup, one-shot scripts, seeders, and tests.

    Note: ``prepare_threshold`` is explicitly ``None`` so prepared statements are
    disabled for pgbouncer/Supavisor compatibility. TCP keepalives mirror
    :func:`get_checkpoint_connection_kwargs` -- a pool that lived for a single
    call did not need them, but a process-lifetime pool behind a NAT or pooler
    does, or a hoisted lifetime just converts a connection leak into a
    half-open-connection staleness bug.

    Do **not** pass ``ttl=`` here. `AsyncPostgresStore.__aexit__` only stops the
    TTL sweeper task, so with no TTL configured the store's context-manager exit
    is inert; configuring one would make every stray ``async with store`` in the
    codebase a live defect at once.
    """
    return AsyncPostgresStore.from_conn_string(
        conn_string=DB_URI,
        pool_config=PoolConfig(
            min_size=DB_POOL_MIN_SIZE,
            max_size=DB_POOL_MAX_SIZE,
            max_lifetime=DB_POOL_MAX_LIFETIME,
            kwargs={
                "prepare_threshold": None,
                "keepalives": 1,
                "keepalives_idle": DB_KEEPALIVE_IDLE,
                "keepalives_interval": DB_KEEPALIVE_INTERVAL,
                "keepalives_count": DB_KEEPALIVE_COUNT,
                "application_name": get_store_application_name(),
            },
        ),
        index=PostgresIndexConfig(
            embed=init_embeddings(embed),
            dims=dims,
            fields=fields,
        ),
    )


########################################################
## Process-level store singleton
########################################################
# One AsyncPostgresStore per API process. The Aegra lifespan owns the store and
# request handlers receive it through app state.
_shared_store: Optional[AsyncPostgresStore] = None
_shared_store_stack: Optional[contextlib.AsyncExitStack] = None
_shared_store_lock = asyncio.Lock()


def _reset_shared_store_state() -> None:
    """Drop the singleton references without touching the event loop.

    Deliberately synchronous so tests can reset between cases regardless of which
    loop (or test style) they run under. Production code should call
    :func:`close_shared_store`, which releases the pool first.
    """
    global _shared_store, _shared_store_stack, _shared_store_lock

    _shared_store = None
    _shared_store_stack = None
    # A lock bound to a torn-down loop deadlocks the next acquirer, so re-create it.
    _shared_store_lock = asyncio.Lock()


async def get_shared_store() -> AsyncPostgresStore:
    """Return this process's shared AsyncPostgresStore, creating it on first call.

    This module owns the store's ``__aenter__``/``__aexit__`` via a module-level
    ``AsyncExitStack``. Callers must **not** write ``async with store`` -- that
    runs the singleton's teardown and would close the shared pool out from under
    every other caller. Await the store's methods directly. (Same defect as #958,
    fixed here at ``services/assistant.py`` and ``services/prompt/__init__.py``.)

    This is an ``async def`` returning the store rather than an async context
    manager, precisely so no call site can be written that way.

    Process- **and loop**-scoped: ``AsyncBatchedBaseStore.__init__`` captures
    ``asyncio.get_running_loop()`` and every async method schedules futures and
    tasks on it, so the store must be created on, and used from, one loop per
    process. That is also why there is no ``atexit`` hook -- there is no running
    loop at interpreter exit. Shutdown is owned by the FastAPI lifespan.

    ``setup()`` is intentionally not called here: DDL stays an explicit startup
    act (``main.py``), not a side effect of first access from a worker or a job.
    """
    global _shared_store, _shared_store_stack

    if _shared_store is not None:
        return _shared_store

    async with _shared_store_lock:
        # Re-check: another coroutine may have completed initialization while we
        # were waiting for the lock.
        if _shared_store is not None:
            return _shared_store

        logger.info(
            "store_singleton_initializing",
            extra={"event": "store_singleton_initializing", "pid": os.getpid()},
        )
        stack = contextlib.AsyncExitStack()
        try:
            store = await stack.enter_async_context(get_store_db())
        except BaseException:
            # Never cache a failed construction. A transient outage during the
            # first call must fail that caller only, not poison the process.
            with contextlib.suppress(Exception):
                await stack.aclose()
            logger.exception(
                "store_singleton_init_failed",
                extra={"event": "store_singleton_init_failed", "pid": os.getpid()},
            )
            raise

        _shared_store_stack = stack
        _shared_store = store
        logger.info(
            "store_singleton_initialized",
            extra={
                "event": "store_singleton_initialized",
                "pid": os.getpid(),
                "min_size": DB_POOL_MIN_SIZE,
                "max_size": DB_POOL_MAX_SIZE,
                "status": "success",
            },
        )
        return _shared_store


async def close_shared_store() -> None:
    """Close this process's shared store and clear it. Idempotent.

    Safe to call twice. Also tolerant of test doubles,
    which is why the batch-task cancellation is guarded rather than assumed
    awaitable.
    """
    global _shared_store, _shared_store_stack

    stack, store = _shared_store_stack, _shared_store
    if stack is None and store is None:
        return

    logger.info(
        "store_singleton_closing",
        extra={"event": "store_singleton_closing", "pid": os.getpid()},
    )

    if stack is not None:
        try:
            await stack.aclose()
        except Exception as e:  # pragma: no cover - defensive
            logger.warning("Error closing shared store exit stack: %s", e)

    # Defense-in-depth: cancel the store's internal batch loop task. The pool is
    # released by the exit stack above; `_task` is independent of it.
    await _cancel_store_batch_task(store)

    _reset_shared_store_state()
    logger.info(
        "store_singleton_closed",
        extra={"event": "store_singleton_closed", "pid": os.getpid()},
    )


async def _cancel_store_batch_task(store: Any) -> None:
    """Cancel ``store._task`` if it is a live awaitable. Never raises."""
    task = getattr(store, "_task", None)
    # A MagicMock attribute is truthy and not awaitable; `asyncio.wait_for` would
    # raise TypeError, which the CancelledError/TimeoutError handler below misses.
    if task is None or not (asyncio.isfuture(task) or inspect.isawaitable(task)):
        return
    if getattr(task, "done", None) and task.done():
        return
    try:
        task.cancel()
        await asyncio.wait_for(task, timeout=5.0)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("Error cancelling shared store batch task: %s", e)
