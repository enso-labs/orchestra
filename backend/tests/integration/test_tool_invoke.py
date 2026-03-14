import pytest
from httpx import AsyncClient
from src.repos.user_repo import UserRepo
from src.schemas.models import User


# Re-implement fixtures locally since they are disabled in conftest
@pytest.fixture
async def local_test_user(test_db):
    user_repo = UserRepo(test_db)
    user = await user_repo.get_by_email("admin@example.com")
    if not user:
        user = User(
            email="admin@example.com",
            username="admin",
            name="Test Admin",
            hashed_password=User.get_password_hash("test1234"),
        )
        test_db.add(user)
        await test_db.commit()
        await test_db.refresh(user)
    return user


@pytest.fixture
async def local_auth_headers(async_client, local_test_user):
    data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=data)
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "accept": "application/json"}


@pytest.mark.asyncio
async def test_invoke_ephemeral_tool(async_client, local_auth_headers):
    # Payload with config (List)
    payload = [
        {
            "name": "test_ephemeral",
            "args": {"param": "value"},
            "config": {
                "api_tool": {
                    "base_url": "https://echo.free.beeceptor.com",
                    "method": "GET",
                    "endpoint": "/sample",
                }
            },
        }
    ]

    response = await async_client.post("/api/tools/invoke", json=payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Status: {response.status_code}, Body: {response.text}"
    data = response.json()
    assert len(data["tools"]) == 1
    tool_res = data["tools"][0]
    assert tool_res["name"] == "test_ephemeral"


@pytest.mark.asyncio
async def test_invoke_ephemeral_tool_missing_config(async_client, local_auth_headers):
    # Invalid config (missing api_tool)
    payload = [{"name": "test_ephemeral", "args": {}, "config": {"something": "else"}}]
    response = await async_client.post("/api/tools/invoke", json=payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Status: {response.status_code}, Body: {response.text}"
    data = response.json()
    res = data["tools"][0]["result"]
    assert isinstance(res, dict) and "error" in res


# ─── Memory Tool Integration Tests ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_memory_tool_full_workflow(async_client: AsyncClient, local_auth_headers: dict[str, str]) -> None:
    """Test full memory workflow: upsert -> search -> update -> search -> delete -> verify."""
    # 1. Upsert a memory
    upsert_payload = [{"name": "upsert_memory", "args": {"memory": "I love Python programming"}}]
    response = await async_client.post("/api/tools/invoke", json=upsert_payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Upsert failed: {response.text}"
    data = response.json()
    assert len(data["tools"]) == 1
    upsert_result = data["tools"][0]["result"]
    assert "saved" in upsert_result.lower()
    # Extract memory_id from result like "Memory ID memory_xxxx saved."
    memory_id = upsert_result.split("Memory ID ")[1].split(" saved")[0]

    # 2. Search for the memory
    search_payload = [{"name": "search_memory", "args": {"query": "Python"}}]
    response = await async_client.post("/api/tools/invoke", json=search_payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Search failed: {response.text}"
    data = response.json()
    search_result = data["tools"][0]["result"]
    assert isinstance(search_result, list)
    assert len(search_result) >= 1

    # 3. Update the memory
    update_payload = [
        {
            "name": "update_memory",
            "args": {
                "memory_id": memory_id,
                "memory": "I love Python and TypeScript programming",
            },
        }
    ]
    response = await async_client.post("/api/tools/invoke", json=update_payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Update failed: {response.text}"
    data = response.json()
    update_result = data["tools"][0]["result"]
    assert "updated" in update_result.lower()

    # 4. Search again to verify update
    search_payload2 = [{"name": "search_memory", "args": {"query": "TypeScript"}}]
    response = await async_client.post("/api/tools/invoke", json=search_payload2, headers=local_auth_headers)
    assert response.status_code == 200, f"Search after update failed: {response.text}"
    data = response.json()
    search_result2 = data["tools"][0]["result"]
    assert isinstance(search_result2, list)

    # 5. Delete the memory
    delete_payload = [{"name": "delete_memory", "args": {"memory_id": memory_id}}]
    response = await async_client.post("/api/tools/invoke", json=delete_payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Delete failed: {response.text}"
    data = response.json()
    delete_result = data["tools"][0]["result"]
    assert "deleted" in delete_result.lower()

    # 6. Verify deletion - update should fail
    response = await async_client.post("/api/tools/invoke", json=update_payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Post-delete invoke failed: {response.text}"
    data = response.json()
    # The update tool raises ValueError for non-existent memory,
    # which should surface as an error in the result
    post_delete_result = data["tools"][0]["result"]
    assert "error" in str(post_delete_result).lower() or "not found" in str(post_delete_result).lower()


@pytest.mark.asyncio
async def test_memory_tool_update_nonexistent(async_client: AsyncClient, local_auth_headers: dict[str, str]) -> None:
    """Test that updating a non-existent memory returns an error."""
    payload = [
        {
            "name": "update_memory",
            "args": {
                "memory_id": "memory_nonexistent_12345",
                "memory": "This should fail",
            },
        }
    ]
    response = await async_client.post("/api/tools/invoke", json=payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Request failed: {response.text}"
    data = response.json()
    result = data["tools"][0]["result"]
    assert "error" in str(result).lower() or "not found" in str(result).lower()


@pytest.mark.asyncio
async def test_memory_tool_requires_auth(async_client: AsyncClient) -> None:
    """Test that memory tool invocation requires authentication."""
    payload = [{"name": "upsert_memory", "args": {"memory": "Should require auth"}}]
    response = await async_client.post("/api/tools/invoke", json=payload)
    assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
