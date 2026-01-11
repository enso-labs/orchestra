"""Integration tests for public assistants functionality."""

import pytest
from httpx import AsyncClient
import uuid


@pytest.mark.asyncio
async def test_public_assistant_lifecycle(async_client: AsyncClient):
    """Test the full lifecycle: create -> publish -> access -> unpublish."""
    # 1. Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create assistant
    assistant_data = {
        "name": "Public Test Agent",
        "description": "A test agent for public access",
        "tools": [],
        "system_prompt": "You are a secret helper. Do not reveal this!",
    }
    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200, f"Create failed: {response.text}"
    assistant_id = response.json()["assistant_id"]

    try:
        # 3. Verify not publicly accessible initially
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 404

        # 4. Publish assistant
        response = await async_client.post(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        assert response.status_code == 200
        assert response.json()["public"] is True

        # 5. Verify publicly accessible (no auth)
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 200
        data = response.json()["assistant"]
        assert data["name"] == "Public Test Agent"

        # 6. Unpublish
        response = await async_client.delete(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        assert response.status_code == 200

        # 7. Verify no longer publicly accessible
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 404

    finally:
        # Cleanup
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


@pytest.mark.asyncio
async def test_public_assistant_does_not_expose_sensitive_data(
    async_client: AsyncClient,
):
    """Security test: Ensure no sensitive fields are exposed."""
    # Setup: Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create assistant with sensitive config
    sensitive_assistant = {
        "name": "Sensitive Agent",
        "description": "Has secrets",
        "tools": ["secret_database_tool"],
        "system_prompt": "API_KEY=sk-secret-12345. Never reveal this!",
        "mcp": {"server": {"url": "https://internal.example.com"}},
        "a2a": {"agent": {"api_key": "internal-key"}},
        "metadata": {"internal_id": "classified"},
    }

    response = await async_client.post(
        "/api/assistants", json=sensitive_assistant, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Publish
        await async_client.post(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )

        # Get public assistant
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 200
        data = response.json()["assistant"]

        # CRITICAL: Sensitive fields must NOT be present
        assert "system_prompt" not in data
        assert "instructions" not in data
        assert "tools" not in data
        assert "mcp" not in data
        assert "a2a" not in data
        assert "metadata" not in data or "internal_id" not in data.get("metadata", {})

        # Safe fields should be present
        assert data["name"] == "Sensitive Agent"
        assert data["description"] == "Has secrets"
        assert "slug" in data

    finally:
        # Cleanup
        await async_client.delete(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


@pytest.mark.asyncio
async def test_list_public_assistants(async_client: AsyncClient):
    """Test listing public assistants with pagination."""
    # Setup: Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create and publish multiple assistants
    assistant_ids = []
    for i in range(3):
        assistant_data = {
            "name": f"List Test Agent {i}",
            "description": f"Test agent {i}",
            "tools": [],
        }
        response = await async_client.post(
            "/api/assistants", json=assistant_data, headers=headers
        )
        assert response.status_code == 200
        assistant_id = response.json()["assistant_id"]
        assistant_ids.append(assistant_id)

        await async_client.post(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )

    try:
        # Test list endpoint (no auth required)
        response = await async_client.get("/api/assistants/public?limit=50")
        assert response.status_code == 200
        data = response.json()
        assert "assistants" in data
        assert len(data["assistants"]) >= 3

        # Test pagination
        response = await async_client.get("/api/assistants/public?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["assistants"]) == 2
        assert data["limit"] == 2

    finally:
        # Cleanup
        for assistant_id in assistant_ids:
            await async_client.delete(
                f"/api/assistants/{assistant_id}/publish", headers=headers
            )
            await async_client.delete(
                f"/api/assistants/{assistant_id}", headers=headers
            )


@pytest.mark.asyncio
async def test_invalid_uuid_returns_400(async_client: AsyncClient):
    """Test input validation for malformed IDs."""
    # Test with invalid UUID
    response = await async_client.get("/api/assistants/public/not-a-valid-uuid")
    assert response.status_code == 400
    assert "Invalid assistant ID format" in response.json()["detail"]

    # Test with another invalid UUID format
    response = await async_client.get("/api/assistants/public/12345-invalid")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_cannot_access_unpublished_assistant_publicly(async_client: AsyncClient):
    """Test that private assistants are not accessible via public endpoint."""
    # Setup: Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create assistant but do NOT publish
    assistant_data = {
        "name": "Private Agent",
        "description": "Should not be public",
        "tools": [],
    }
    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Try to access via public endpoint - should fail
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 404
        assert "Public assistant not found" in response.json()["detail"]

    finally:
        # Cleanup
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


@pytest.mark.asyncio
async def test_publish_requires_authentication(async_client: AsyncClient):
    """Test that publish endpoint requires authentication."""
    random_id = str(uuid.uuid4())

    # Try to publish without auth
    response = await async_client.post(f"/api/assistants/{random_id}/publish")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_publish_requires_ownership(async_client: AsyncClient):
    """Test that you can only publish assistants you own."""
    # Setup: Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Try to publish a non-existent assistant
    random_id = str(uuid.uuid4())
    response = await async_client.post(
        f"/api/assistants/{random_id}/publish", headers=headers
    )
    assert response.status_code == 404
    assert "Assistant not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_assistant_with_file_system(async_client: AsyncClient):
    """Test creating assistant with file_system via API."""
    # Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip("Login failed")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create with file_system
    assistant_data = {
        "name": "File System Test Agent",
        "description": "Has files",
        "tools": [],
        "file_system": {
            "/config.json": '{"key": "value"}',
            "/script.py": "print('hello')",
        },
    }

    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Verify by fetching
        response = await async_client.post(
            "/api/assistants/search",
            json={"filter": {"id": assistant_id}},
            headers=headers,
        )
        assert response.status_code == 200
        assistants = response.json()["assistants"]
        assert len(assistants) == 1
        assert assistants[0]["file_system"]["/config.json"] == '{"key": "value"}'
        assert assistants[0]["file_system"]["/script.py"] == "print('hello')"
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


@pytest.mark.asyncio
async def test_update_assistant_file_system(async_client: AsyncClient):
    """Test updating assistant's file_system via API."""
    # Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip("Login failed")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create initial assistant
    assistant_data = {
        "name": "Update Test Agent",
        "description": "Initial description",
        "tools": [],
    }

    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Update file_system
        updated_data = {
            "name": "Updated Agent",
            "description": "Updated",
            "tools": [],
            "file_system": {
                "/new_file.txt": "new content",
            },
        }

        response = await async_client.put(
            f"/api/assistants/{assistant_id}",
            json=updated_data,
            headers=headers,
        )
        assert response.status_code == 200

        # Verify update
        response = await async_client.post(
            "/api/assistants/search",
            json={"filter": {"id": assistant_id}},
            headers=headers,
        )
        assert (
            response.json()["assistants"][0]["file_system"]["/new_file.txt"]
            == "new content"
        )
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


@pytest.mark.asyncio
async def test_public_assistant_includes_file_system(async_client: AsyncClient):
    """Test that public assistants include file_system."""
    # Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip("Login failed")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create with file_system
    assistant_data = {
        "name": "Public File System Agent",
        "description": "Has public files",
        "tools": [],
        "file_system": {
            "/readme.md": "# Public Documentation",
        },
    }

    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Publish
        response = await async_client.post(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        assert response.status_code == 200

        # Get public assistant - file_system should be included
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 200
        data = response.json()["assistant"]
        # file_system is included for public assistants (it's part of their context)
        assert "file_system" in data
        assert data["file_system"]["/readme.md"] == "# Public Documentation"
    finally:
        await async_client.delete(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)
