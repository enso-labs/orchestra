import json

from main import app
from starlette.testclient import TestClient
from src.repos.user_repo import UserRepo
from src.schemas.models import User

# Sync client for token generation (used in setup)
client = TestClient(app)


def disabled(f):
    def _decorator():
        print(f.__name__ + " has been disabled")

    return _decorator


def get_test_token():
    """Get test token using sync client for setup purposes."""
    data = {"email": "admin@example.com", "password": "test1234"}
    headers = {
        "Content-Type": "application/json",
    }
    response = client.post("/api/auth/login", json=data, headers=headers)
    json_str = json.loads(response.content)
    return json_str["access_token"]


async def get_test_user() -> User:
    """Get test user from database for unit tests."""
    from sqlalchemy.ext.asyncio import (
        create_async_engine,
        async_sessionmaker,
        AsyncSession,
    )
    from sqlalchemy.pool import NullPool
    from src.constants import DB_URI
    from src.utils.db import get_asyncpg_connect_args, get_asyncpg_url

    # Create a fresh engine and session for this call
    engine = create_async_engine(
        get_asyncpg_url(DB_URI),
        echo=False,
        poolclass=NullPool,
        connect_args=get_asyncpg_connect_args(DB_URI),
    )
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as db:
        user_repo = UserRepo(db)
        user = await user_repo.get_by_email("admin@example.com")
        if not user:
            raise ValueError("Test user not found. Make sure to run seed_admin() first.")

    await engine.dispose()
    return user
