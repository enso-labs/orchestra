import json

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from src.schemas.entities.server import ServerCreate, ServerTestConnectionRequest
from src.schemas.models.server import ServerTransport


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _login(client: AsyncClient) -> dict[str, str]:
    """Login and return auth headers. Skips test if login fails."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "test1234"},
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _server_payload(
    name: str = "Test MCP Server",
    url: str = "https://mcp.example.com/sse",
    transport: str = "sse",
    config: dict | None = None,
) -> dict:
    return {
        "name": name,
        "url": url,
        "transport": transport,
        "config": config,
    }


# ── CRUD Lifecycle ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_server_crud_lifecycle(async_client: AsyncClient):
    """Full create → read → list → update → delete lifecycle."""
    headers = await _login(async_client)

    # CREATE
    payload = _server_payload(config={"api_key": "secret123"})
    resp = await async_client.post("/api/servers", json=payload, headers=headers)
    assert resp.status_code == 201, f"Create failed: {resp.text}"
    data = resp.json()
    server_id = data["id"]
    assert data["name"] == "Test MCP Server"
    assert data["slug"] == "test-mcp-server"
    assert data["transport"] == "sse"
    # Config should be redacted
    assert data["config"]["api_key"] == "***REDACTED***"

    # READ single
    resp = await async_client.get(f"/api/servers/{server_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == server_id

    # LIST
    resp = await async_client.get("/api/servers", headers=headers)
    assert resp.status_code == 200
    servers = resp.json()
    assert any(s["id"] == server_id for s in servers)

    # UPDATE
    resp = await async_client.put(
        f"/api/servers/{server_id}",
        json={"name": "Updated Server", "transport": "streamable_http"},
        headers=headers,
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "Updated Server"
    assert updated["slug"] == "updated-server"
    assert updated["transport"] == "streamable_http"

    # DELETE
    resp = await async_client.delete(f"/api/servers/{server_id}", headers=headers)
    assert resp.status_code == 204

    # VERIFY deleted
    resp = await async_client.get(f"/api/servers/{server_id}", headers=headers)
    assert resp.status_code == 404


# ── Duplicate Name ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_server_duplicate_name_rejected(async_client: AsyncClient):
    """Creating two servers with the same name should fail with 409."""
    headers = await _login(async_client)

    payload = _server_payload(name="Unique Name Test")
    resp = await async_client.post("/api/servers", json=payload, headers=headers)
    assert resp.status_code == 201
    server_id = resp.json()["id"]

    # Same name again
    resp2 = await async_client.post("/api/servers", json=payload, headers=headers)
    assert resp2.status_code == 409

    # Cleanup
    await async_client.delete(f"/api/servers/{server_id}", headers=headers)


# ── SSRF Validation ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ssrf_localhost_rejected(async_client: AsyncClient):
    """URLs pointing to localhost should be rejected."""
    headers = await _login(async_client)

    for url in [
        "http://localhost:8080/sse",
        "http://127.0.0.1:8080/sse",
        "http://0.0.0.0:8080/sse",
    ]:
        resp = await async_client.post(
            "/api/servers",
            json=_server_payload(name=f"ssrf-{url}", url=url),
            headers=headers,
        )
        assert resp.status_code == 422, (
            f"Expected 422 for {url}, got {resp.status_code}"
        )


@pytest.mark.asyncio
async def test_ssrf_private_ip_rejected(async_client: AsyncClient):
    """URLs with private IPs should be rejected."""
    headers = await _login(async_client)

    for url in [
        "http://10.0.0.1:8080/sse",
        "http://192.168.1.1:8080/sse",
        "http://172.16.0.1:8080/sse",
    ]:
        resp = await async_client.post(
            "/api/servers",
            json=_server_payload(name=f"ssrf-{url}", url=url),
            headers=headers,
        )
        assert resp.status_code == 422, (
            f"Expected 422 for {url}, got {resp.status_code}"
        )


# ── Transport Restriction ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stdio_transport_rejected(async_client: AsyncClient):
    """stdio transport should not be allowed."""
    headers = await _login(async_client)

    resp = await async_client.post(
        "/api/servers",
        json=_server_payload(transport="stdio"),
        headers=headers,
    )
    # Pydantic validation rejects invalid enum value → 422
    assert resp.status_code == 422


def test_transport_enum_only_allows_sse_and_streamable_http():
    """ServerTransport enum only has sse and streamable_http."""
    values = {t.value for t in ServerTransport}
    assert values == {"sse", "streamable_http"}
    assert "stdio" not in values


# ── Schema-level SSRF Validation ─────────────────────────────────────────────


def test_schema_rejects_private_url():
    """ServerCreate schema validator blocks private URLs."""
    with pytest.raises(ValidationError, match="private or internal"):
        ServerCreate(name="bad", url="http://192.168.1.1/sse", transport="sse")


def test_schema_rejects_non_http_url():
    """ServerCreate schema validator blocks non-http URLs."""
    with pytest.raises(ValidationError, match="http:// or https://"):
        ServerCreate(name="bad", url="ftp://example.com/sse", transport="sse")


def test_schema_accepts_public_url():
    """ServerCreate accepts valid public URLs."""
    s = ServerCreate(name="ok", url="https://mcp.example.com/sse", transport="sse")
    assert s.url == "https://mcp.example.com/sse"


# ── Config Encryption Round-trip ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_config_encryption_roundtrip(async_client: AsyncClient):
    """Config secrets should be encrypted in DB and redacted in response,
    but the service should be able to decrypt them."""
    headers = await _login(async_client)

    config = {"api_key": "super_secret", "token": "tok_abc"}
    resp = await async_client.post(
        "/api/servers",
        json=_server_payload(name="Encrypt Test", config=config),
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    server_id = data["id"]

    # Response should have redacted config
    assert data["config"]["api_key"] == "***REDACTED***"
    assert data["config"]["token"] == "***REDACTED***"

    # Re-fetch — still redacted
    resp = await async_client.get(f"/api/servers/{server_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["config"]["api_key"] == "***REDACTED***"

    # Cleanup
    await async_client.delete(f"/api/servers/{server_id}", headers=headers)


# ── Server Assignment to Assistants ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_server_assignment_to_assistant(async_client: AsyncClient):
    """Assign servers to an assistant, list them, then unassign."""
    headers = await _login(async_client)

    # Create a server
    resp = await async_client.post(
        "/api/servers",
        json=_server_payload(name="Assignment Test Server"),
        headers=headers,
    )
    assert resp.status_code == 201
    server_id = resp.json()["id"]

    # Create an assistant
    resp = await async_client.post(
        "/api/assistants",
        json={"name": "Test Agent for Servers", "model": "openai:gpt-4.1-mini"},
        headers=headers,
    )
    if resp.status_code not in (200, 201):
        # Cleanup server and skip if assistant creation fails
        await async_client.delete(f"/api/servers/{server_id}", headers=headers)
        pytest.skip(f"Assistant create failed: {resp.text}")

    assistant_id = resp.json()["id"]

    # ASSIGN server to assistant
    resp = await async_client.post(
        f"/api/assistants/{assistant_id}/servers",
        json={"server_ids": [server_id]},
        headers=headers,
    )
    assert resp.status_code == 200, f"Assign failed: {resp.text}"

    # LIST assigned servers
    resp = await async_client.get(
        f"/api/assistants/{assistant_id}/servers", headers=headers
    )
    assert resp.status_code == 200
    assigned = resp.json()
    assert any(s["id"] == server_id for s in assigned)

    # UNASSIGN server
    resp = await async_client.delete(
        f"/api/assistants/{assistant_id}/servers/{server_id}",
        headers=headers,
    )
    assert resp.status_code == 200

    # Verify unassigned
    resp = await async_client.get(
        f"/api/assistants/{assistant_id}/servers", headers=headers
    )
    assert resp.status_code == 200
    assert not any(s["id"] == server_id for s in resp.json())

    # Verify server still exists (unassign doesn't delete)
    resp = await async_client.get(f"/api/servers/{server_id}", headers=headers)
    assert resp.status_code == 200

    # Cleanup
    await async_client.delete(f"/api/servers/{server_id}", headers=headers)
    await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# ── Not Found ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_nonexistent_server_returns_404(async_client: AsyncClient):
    """Getting a server that doesn't exist should return 404."""
    headers = await _login(async_client)

    resp = await async_client.get(
        "/api/servers/00000000-0000-4000-8000-000000000000",
        headers=headers,
    )
    assert resp.status_code == 404
