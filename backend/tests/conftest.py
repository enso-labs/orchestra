import pytest
import asyncio
import respx
from httpx import AsyncClient, ASGITransport
from main import app
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from src.constants import DB_URI
from src.services.db import get_async_db, get_store
from src.repos.user_repo import UserRepo
from src.schemas.models import User
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
    # Convert to asyncpg format and remove sslmode (asyncpg doesn't support it in URL)
    ASYNC_DB_URI = DB_URI.replace("postgresql://", "postgresql+asyncpg://").replace("?sslmode=disable", "")
    
    try:
        engine = create_async_engine(
            ASYNC_DB_URI,
            echo=False,
            poolclass=NullPool,  # No connection pooling for tests
            connect_args={"ssl": False}  # asyncpg SSL configuration
        )
        
        # Test connection
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        
        yield engine
        await engine.dispose()
    except Exception as e:
        pytest.fail(
            f"Failed to connect to test database.\n"
            f"Connection string: {ASYNC_DB_URI}\n"
            f"Error: {e}\n\n"
            f"Make sure PostgreSQL is running and accessible.\n"
            f"For CI: Ensure PostgreSQL service is configured in workflow.\n"
            f"For local: Run 'docker compose up postgres' or check your .env file."
        )


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


@pytest.fixture(autouse=True)
async def mock_external_services():
    """Mock external services to prevent real API calls during tests."""
    with respx.mock:
        # Mock Airtable API endpoints
        respx.post("https://api.airtable.com/v0/app6sU4AprV9uZze6/Contacts").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={"id": "mock_record_id", "fields": {}}
            )
        )
        respx.get("https://api.airtable.com/v0/app6sU4AprV9uZze6/Contacts").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={"records": [{"id": "mock_record_id", "fields": {}}]}
            )
        )
        respx.route(method="PATCH", url__regex=r"^https://api\.airtable\.com/v0/app6sU4AprV9uZze6/Contacts/.+$").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={"id": "mock_record_id", "fields": {}}
            )
        )
        
        # Mock OpenAI Chat API endpoints
        respx.post(url__regex=r"^https://api\.openai\.com/v1/chat/completions.*").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={
                    "id": "chatcmpl-mock",
                    "object": "chat.completion",
                    "created": 1234567890,
                    "model": "gpt-4",
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Mock response"
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": {
                        "prompt_tokens": 10,
                        "completion_tokens": 20,
                        "total_tokens": 30
                    }
                }
            )
        )
        
        # Mock OpenAI Embeddings API endpoints
        respx.post(url__regex=r"^https://api\.openai\.com/v1/embeddings.*").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={
                    "object": "list",
                    "data": [{
                        "object": "embedding",
                        "embedding": [0.1] * 1536,  # Mock embedding vector
                        "index": 0
                    }],
                    "model": "text-embedding-ada-002",
                    "usage": {
                        "prompt_tokens": 10,
                        "total_tokens": 10
                    }
                }
            )
        )
        
        # Mock Anthropic API endpoints
        respx.post(url__regex=r"^https://api\.anthropic\.com/.*").mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={
                    "id": "msg_mock",
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Mock response"}],
                    "model": "claude-3-opus-20240229",
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 10, "output_tokens": 20}
                }
            )
        )
        
        yield


@pytest.fixture
async def test_user(test_db):
    """Ensure test user exists in database."""
    user_repo = UserRepo(test_db)
    user = await user_repo.get_by_email("admin@example.com")
    
    if not user:
        # Create test user if not exists
        user = User(
            email="admin@example.com",
            username="admin",
            full_name="Test Admin",
            hashed_password=User.hash_password("test1234"),
            access=1,
        )
        test_db.add(user)
        await test_db.commit()
        await test_db.refresh(user)
    
    return user


@pytest.fixture
async def auth_headers(async_client, test_user):
    """Get authentication headers for testing."""
    data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=data)
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "accept": "application/json"}
