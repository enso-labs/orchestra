import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from src.constants import DB_URI
from src.services.db import get_async_db, get_store
from langgraph.store.memory import InMemoryStore


class TestInMemoryStore(InMemoryStore):
    """Wrapper around InMemoryStore that allows setting fields attribute."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields = ["page_content", "metadata"]


@pytest.fixture(scope="function")
def event_loop():
    """Create a new event loop for each test function."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture
async def test_engine():
    """Create a fresh async engine for each test."""
    ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        ASYNC_DB_URI,
        echo=False,
        poolclass=NullPool,  # No connection pooling for tests
    )
    yield engine
    await engine.dispose()


@pytest.fixture
async def test_db(test_engine):
    """Provide a test database session."""
    async_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session_maker() as session:
        yield session


@pytest.fixture
async def test_store():
    """Provide a test store (in-memory for faster tests)."""
    store = TestInMemoryStore()
    yield store


@pytest.fixture
async def async_client(test_store, test_db):
    """Async HTTP client for testing with store and db overrides."""
    from fastapi import Request

    # Override dependencies
    async def override_get_async_db():
        yield test_db

    def override_get_store(req: Request):
        return test_store

    app.dependency_overrides[get_async_db] = override_get_async_db
    app.dependency_overrides[get_store] = override_get_store
    app.state.store = test_store

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(async_client):
    """Get authentication headers for testing."""
    data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=data)
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "accept": "application/json"}
