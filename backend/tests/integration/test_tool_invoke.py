import pytest
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
            full_name="Test Admin",
            hashed_password=User.get_password_hash("test1234"),
            access=1,
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
            }
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
    payload = [
        {
            "name": "test_ephemeral",
            "args": {},
            "config": {"something": "else"} 
        }
    ]
    response = await async_client.post("/api/tools/invoke", json=payload, headers=local_auth_headers)
    assert response.status_code == 200, f"Status: {response.status_code}, Body: {response.text}"
    data = response.json()
    res = data["tools"][0]["result"]
    assert isinstance(res, dict) and "error" in res
