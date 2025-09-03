import contextlib
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import async_sessionmaker
from psycopg_pool import ConnectionPool
from src.constants import DB_URI, CONNECTION_POOL_KWARGS
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.store.postgres.base import PostgresIndexConfig
from langchain.embeddings.base import init_embeddings

MAX_CONNECTION_POOL_SIZE = None

# SQLAlchemy engines
engine = create_engine(DB_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(ASYNC_DB_URI)
AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=async_engine)

# Create a single shared base instance
_Base = declarative_base()

def get_db_base():
	return _Base

def load_models():
	"""Import all models to ensure they are registered with SQLAlchemy"""
	from src.schemas.models import User, Token, Agent, Revision, Settings, Thread, Server
	return _Base

def get_checkpoint_db():
	return AsyncPostgresSaver.from_conn_string(conn_string=DB_URI)

def get_store_db(embed: str = "openai:text-embedding-3-small"):
	return AsyncPostgresStore.from_conn_string(
		conn_string=DB_URI,
		index=PostgresIndexConfig(
			dims=1536,
			embed=embed,
			fields=["text"]
		)
	)

# Session context managers
def get_db() -> Generator[SessionLocal, None, None]: # type: ignore
	"""Get a SQLAlchemy database session."""
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
	"""Get an async SQLAlchemy database session."""
	db = AsyncSessionLocal()
	try:
		yield db
	finally:
		await db.close()