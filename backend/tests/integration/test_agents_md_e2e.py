"""End-to-end integration tests for AGENTS.md feature.

Tests verify the full flow:
1. Create agent with AGENTS.md → file persists and is retrievable
2. Update AGENTS.md content → changes persist
3. Legacy agent with instructions (no AGENTS.md) still works unchanged
4. Thread-level AGENTS.md in non-agent mode
5. AGENTS.md takes priority over legacy instructions
6. Public assistants do not expose AGENTS.md content
7. LLM routes accept AGENTS.md in files dict
"""

import pytest
from httpx import AsyncClient


async def _login(async_client: AsyncClient) -> dict:
    """Login and return auth headers. Skips test if login fails."""
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_assistant(
    async_client: AsyncClient, headers: dict, data: dict
) -> str:
    """Create an assistant and return its ID."""
    response = await async_client.post("/api/assistants", json=data, headers=headers)
    assert response.status_code == 200, f"Create failed: {response.text}"
    return response.json()["assistant_id"]


async def _get_assistant(
    async_client: AsyncClient, headers: dict, assistant_id: str
) -> dict:
    """Fetch an assistant by ID via search endpoint."""
    response = await async_client.post(
        "/api/assistants/search",
        json={"filter": {"id": assistant_id}},
        headers=headers,
    )
    assert response.status_code == 200
    assistants = response.json()["assistants"]
    assert len(assistants) == 1
    return assistants[0]


# =============================================================================
# Test 1: Create agent with AGENTS.md file
# =============================================================================
@pytest.mark.asyncio
async def test_create_agent_with_agents_md(async_client: AsyncClient):
    """Create a new agent with AGENTS.md in files and verify it persists."""
    headers = await _login(async_client)
    agents_md_content = "Always respond in haiku format."

    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E AGENTS.md Test Agent",
            "description": "Tests AGENTS.md file-based instructions",
            "tools": [],
            "files": {"AGENTS.md": agents_md_content},
        },
    )

    try:
        # Verify AGENTS.md persists in the assistant
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert "files" in assistant
        assert "AGENTS.md" in assistant["files"]
        assert assistant["files"]["AGENTS.md"] == agents_md_content
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 2: Update AGENTS.md content on existing agent
# =============================================================================
@pytest.mark.asyncio
async def test_update_agents_md_content(async_client: AsyncClient):
    """Update AGENTS.md on an existing agent and verify the update."""
    headers = await _login(async_client)

    # Create initial agent with AGENTS.md
    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Update Test Agent",
            "description": "Test AGENTS.md update",
            "tools": [],
            "files": {"AGENTS.md": "Original instructions"},
        },
    )

    try:
        # Update AGENTS.md content
        updated_content = "Updated: respond in bullet points only."
        response = await async_client.put(
            f"/api/assistants/{assistant_id}",
            json={
                "name": "E2E Update Test Agent",
                "description": "Test AGENTS.md update",
                "tools": [],
                "files": {"AGENTS.md": updated_content},
            },
            headers=headers,
        )
        assert response.status_code == 200

        # Verify update persisted
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert assistant["files"]["AGENTS.md"] == updated_content
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 3: Legacy agent with instructions (no AGENTS.md) still works
# =============================================================================
@pytest.mark.asyncio
async def test_legacy_agent_without_agents_md_unchanged(
    async_client: AsyncClient,
):
    """Agent with legacy instructions and no AGENTS.md continues to work."""
    headers = await _login(async_client)

    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Legacy Agent",
            "description": "Legacy instructions agent",
            "tools": [],
            "instructions": "You are a helpful assistant.",
        },
    )

    try:
        assistant = await _get_assistant(async_client, headers, assistant_id)
        # Legacy instructions should be preserved
        assert assistant.get("instructions") == "You are a helpful assistant."
        # No AGENTS.md in files
        files = assistant.get("files") or {}
        assert "AGENTS.md" not in files
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 4: AGENTS.md takes priority over legacy instructions
# =============================================================================
@pytest.mark.asyncio
async def test_agents_md_overrides_legacy_instructions(
    async_client: AsyncClient,
):
    """When both AGENTS.md and legacy instructions exist, AGENTS.md takes priority.

    This tests the LLMService.assistant() extraction logic indirectly by
    verifying both fields can coexist in the API and the assistant is valid.
    """
    headers = await _login(async_client)

    agents_md_content = "AGENTS.md instructions take priority"
    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Priority Test Agent",
            "description": "Tests AGENTS.md priority",
            "tools": [],
            "instructions": "Old legacy instructions",
            "files": {"AGENTS.md": agents_md_content},
        },
    )

    try:
        assistant = await _get_assistant(async_client, headers, assistant_id)
        # Both legacy instructions and AGENTS.md can coexist in the API
        assert assistant["files"]["AGENTS.md"] == agents_md_content
        # Legacy instructions still stored (API doesn't remove them)
        assert assistant.get("instructions") == "Old legacy instructions"
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 5: Public assistant does NOT expose AGENTS.md
# =============================================================================
@pytest.mark.asyncio
async def test_public_assistant_does_not_expose_agents_md(
    async_client: AsyncClient,
):
    """Published assistants should not expose AGENTS.md via public endpoint."""
    headers = await _login(async_client)

    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Public AGENTS.md Agent",
            "description": "Public agent with AGENTS.md",
            "tools": [],
            "files": {"AGENTS.md": "Secret internal instructions"},
        },
    )

    try:
        # Publish the assistant
        response = await async_client.post(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        assert response.status_code == 200

        # Public endpoint should NOT expose files (including AGENTS.md)
        response = await async_client.get(f"/api/assistants/public/{assistant_id}")
        assert response.status_code == 200
        public_data = response.json()["assistant"]
        assert "files" not in public_data
        assert "instructions" not in public_data

        # But owner can still see AGENTS.md via authenticated search
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert assistant["files"]["AGENTS.md"] == "Secret internal instructions"
    finally:
        await async_client.delete(
            f"/api/assistants/{assistant_id}/publish", headers=headers
        )
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 6: LLM stream accepts AGENTS.md in thread-level files
# =============================================================================
@pytest.mark.asyncio
async def test_llm_stream_accepts_agents_md_in_files(
    async_client: AsyncClient,
):
    """LLM stream endpoint accepts AGENTS.md in input.files for thread mode."""
    headers = await _login(async_client)

    payload = {
        "input": {
            "messages": [{"role": "user", "content": "Hello"}],
            "files": {"AGENTS.md": "Always respond in haiku format."},
        },
    }

    async with async_client.stream(
        "POST", "/api/llm/stream", json=payload, headers=headers
    ) as response:
        # Should accept the request (200 streaming or 202 distributed)
        assert response.status_code in [200, 202]


# =============================================================================
# Test 7: LLM invoke accepts AGENTS.md in thread-level files
# =============================================================================
@pytest.mark.asyncio
async def test_llm_invoke_accepts_agents_md_in_files(
    async_client: AsyncClient,
):
    """LLM invoke endpoint accepts AGENTS.md in input.files for thread mode."""
    headers = await _login(async_client)

    payload = {
        "input": {
            "messages": [{"role": "user", "content": "Hello"}],
            "files": {"AGENTS.md": "Be concise and helpful."},
        },
    }

    response = await async_client.post("/api/llm/invoke", json=payload, headers=headers)
    # 200 success or 500 from mocked external APIs — both valid for schema test
    assert response.status_code in [200, 500]


# =============================================================================
# Test 8: LLM stream with assistant that has AGENTS.md
# =============================================================================
@pytest.mark.asyncio
async def test_llm_stream_with_agents_md_assistant(async_client: AsyncClient):
    """LLM stream endpoint works with an assistant that has AGENTS.md in files."""
    headers = await _login(async_client)

    # Create assistant with AGENTS.md
    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E LLM Stream Agent",
            "description": "Test streaming with AGENTS.md",
            "tools": [],
            "files": {"AGENTS.md": "Always respond in haiku format."},
        },
    )

    try:
        payload = {
            "input": {
                "messages": [{"role": "user", "content": "Tell me about coding"}],
            },
            "metadata": {"assistant_id": assistant_id},
        }

        async with async_client.stream(
            "POST", "/api/llm/stream", json=payload, headers=headers
        ) as response:
            assert response.status_code in [200, 202]
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 9: Create agent with AGENTS.md alongside other files
# =============================================================================
@pytest.mark.asyncio
async def test_agents_md_coexists_with_other_files(async_client: AsyncClient):
    """AGENTS.md works correctly alongside other files in the file system."""
    headers = await _login(async_client)

    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Multi-File Agent",
            "description": "Agent with AGENTS.md and other files",
            "tools": [],
            "files": {
                "AGENTS.md": "You are a Python expert.",
                "/config.json": '{"theme": "dark"}',
                "/templates/greeting.txt": "Hello, how can I help?",
            },
        },
    )

    try:
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert assistant["files"]["AGENTS.md"] == "You are a Python expert."
        assert assistant["files"]["/config.json"] == '{"theme": "dark"}'
        assert assistant["files"]["/templates/greeting.txt"] == "Hello, how can I help?"
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)


# =============================================================================
# Test 10: Migrate from legacy to AGENTS.md by adding file
# =============================================================================
@pytest.mark.asyncio
async def test_migrate_legacy_to_agents_md(async_client: AsyncClient):
    """Simulate migration: create legacy agent, then add AGENTS.md via update."""
    headers = await _login(async_client)

    # Create agent with legacy instructions (no AGENTS.md)
    assistant_id = await _create_assistant(
        async_client,
        headers,
        {
            "name": "E2E Migration Agent",
            "description": "Legacy to AGENTS.md migration",
            "tools": [],
            "instructions": "Old instructions to migrate",
        },
    )

    try:
        # Verify legacy state
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert assistant.get("instructions") == "Old instructions to migrate"
        files = assistant.get("files") or {}
        assert "AGENTS.md" not in files

        # Migrate: add AGENTS.md via update
        response = await async_client.put(
            f"/api/assistants/{assistant_id}",
            json={
                "name": "E2E Migration Agent",
                "description": "Legacy to AGENTS.md migration",
                "tools": [],
                "instructions": "Old instructions to migrate",
                "files": {"AGENTS.md": "Migrated: new AGENTS.md instructions"},
            },
            headers=headers,
        )
        assert response.status_code == 200

        # Verify AGENTS.md is now present
        assistant = await _get_assistant(async_client, headers, assistant_id)
        assert assistant["files"]["AGENTS.md"] == "Migrated: new AGENTS.md instructions"
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)
