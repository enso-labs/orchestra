import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from src.constants import DB_URI
from src.services.db import get_async_db, get_store_db, get_store
from langgraph.store.memory import InMemoryStore


# Create test async engine with proper pooling
ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://")
test_async_engine = create_async_engine(
    ASYNC_DB_URI, 
    echo=False,
    poolclass=None,  # Disable pooling for tests
)
TestAsyncSessionLocal = async_sessionmaker(
    test_async_engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)


@pytest.fixture(scope="function")
def event_loop():
    """Create a new event loop for each test function."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture
async def test_store():
    """Provide a test store (in-memory for faster tests)."""
    store = InMemoryStore()
    yield store


@pytest.fixture
async def async_client(test_store):
    """Async HTTP client for testing with store override."""
    from fastapi import Request
    
    # Override the store dependency with correct signature (sync function)
    def override_get_store(req: Request):
        return test_store
    
    app.dependency_overrides[get_store] = override_get_store
    
    # Ensure app.state.store is set for tests
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
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "accept": "application/json"
    }