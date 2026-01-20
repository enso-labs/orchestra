from logging.config import fileConfig
import asyncio
import os
import sys
from pathlib import Path

# Add the project root directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load env file from ENV_FILE env var if set, otherwise default .env
env_file = os.environ.get("ENV_FILE")
if env_file:
    load_dotenv(Path(env_file).expanduser())
else:
    load_dotenv()

from sqlalchemy import engine_from_config, text
from sqlalchemy import pool
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from src.services.db import get_db_base
from src.constants import DB_URI


async def ensure_database_exists(db_uri: str) -> None:
    """Create the database if it doesn't exist."""
    # Parse the database name from the URI
    # Format: postgresql://user:pass@host:port/dbname
    if "/" not in db_uri:
        return

    base_uri, db_name = db_uri.rsplit("/", 1)
    # Remove query params from db_name if present
    if "?" in db_name:
        db_name = db_name.split("?")[0]

    # Connect to the default 'postgres' database to create the target db
    # Convert to asyncpg format for async engine
    postgres_uri = f"{base_uri}/postgres".replace(
        "postgresql://", "postgresql+asyncpg://"
    )

    try:
        engine = create_async_engine(
            postgres_uri,
            isolation_level="AUTOCOMMIT",
            connect_args={"ssl": False},
        )
        async with engine.connect() as conn:
            # Check if database exists
            result = await conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": db_name},
            )
            if not result.fetchone():
                await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
        await engine.dispose()
    except (OperationalError, ProgrammingError):
        # If we can't connect to postgres db or create, the main connection will fail with a clearer error
        pass


# Handle both sync (tests) and async (app lifespan) contexts
try:
    asyncio.get_running_loop()
    # Already in an async context - run in a separate thread with its own loop
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor() as pool:
        pool.submit(asyncio.run, ensure_database_exists(DB_URI)).result()
except RuntimeError:
    # No running loop - safe to use asyncio.run() directly
    asyncio.run(ensure_database_exists(DB_URI))

config = context.config
config.set_main_option("sqlalchemy.url", DB_URI)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = get_db_base().metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
