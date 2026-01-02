import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_api_token_lifecycle(async_client: AsyncClient):
    # 1. Login to get JWT
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create API Token
    response = await async_client.post(
        "/api/tokens", json={"name": "Integration Test Token"}, headers=headers
    )
    assert response.status_code == 200, f"Create failed: {response.text}"
    data = response.json()
    api_token_str = data["token"]
    token_id = data["api_token"]["id"]
    assert api_token_str.startswith("otk_")

    # 3. List Tokens
    response = await async_client.get("/api/tokens", headers=headers)
    assert response.status_code == 200
    tokens = response.json()
    assert len(tokens) > 0
    assert any(t["id"] == token_id for t in tokens)

    # 4. Use API Token
    response = await async_client.get(
        "/api/tokens", headers={"x-api-key": api_token_str}
    )
    assert response.status_code == 200, f"API Key auth failed: {response.text}"
    tokens_api = response.json()
    assert any(t["id"] == token_id for t in tokens_api)

    # 5. Revoke Token
    response = await async_client.delete(f"/api/tokens/{token_id}", headers=headers)
    assert response.status_code == 200

    # 6. Verify Revocation
    response = await async_client.get(
        "/api/tokens", headers={"x-api-key": api_token_str}
    )
    assert response.status_code == 401
