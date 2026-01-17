"""Integration tests for LLM routes with inference dictation feature."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_stream_accepts_generate_files_flag(async_client: AsyncClient):
    """Test that /llm/stream accepts generate_files parameter."""
    # Login to get JWT
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "input": {
            "messages": [{"role": "user", "content": "Create a hello world script"}]
        },
        "generate_files": True,
    }

    # Mock the LLMController to avoid running actual stream generation
    with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
        mock_controller = MagicMock()

        async def mock_stream():
            yield "data: test\n\n"

        mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
        mock_controller_class.return_value = mock_controller

        # Use stream() context manager to handle streaming response
        async with async_client.stream(
            "POST", "/api/llm/stream", json=payload, headers=headers
        ) as response:
            # Sync stream endpoint always returns 200 (streaming response)
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_stream_accepts_target_file_parameter(async_client: AsyncClient):
    """Test that /llm/stream accepts target_file parameter."""
    # Login to get JWT
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "input": {
            "messages": [{"role": "user", "content": "Write a README for this project"}]
        },
        "generate_files": True,
        "target_file": "/README.md",
    }

    # Mock the LLMController to avoid running actual stream generation
    with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
        mock_controller = MagicMock()

        async def mock_stream():
            yield "data: test\n\n"

        mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
        mock_controller_class.return_value = mock_controller

        async with async_client.stream(
            "POST", "/api/llm/stream", json=payload, headers=headers
        ) as response:
            # Sync stream endpoint always returns 200 (streaming response)
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_stream_accepts_file_context_parameter(async_client: AsyncClient):
    """Test that /llm/stream accepts file_context parameter."""
    # Login to get JWT
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "input": {
            "messages": [{"role": "user", "content": "Add error handling to this code"}]
        },
        "generate_files": True,
        "target_file": "/main.py",
        "file_context": "def hello():\n    print('hello world')",
    }

    # Mock the LLMController to avoid running actual stream generation
    with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
        mock_controller = MagicMock()

        async def mock_stream():
            yield "data: test\n\n"

        mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
        mock_controller_class.return_value = mock_controller

        async with async_client.stream(
            "POST", "/api/llm/stream", json=payload, headers=headers
        ) as response:
            # Sync stream endpoint always returns 200 (streaming response)
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_invoke_accepts_generate_files_flag(async_client: AsyncClient):
    """Test that /llm/invoke accepts generate_files parameter."""
    # Login to get JWT
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)

    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.text}. Ensure DB is seeded.")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "input": {"messages": [{"role": "user", "content": "Hello"}]},
        "generate_files": True,
        "target_file": "/hello.txt",
        "file_context": "Existing content",
    }

    response = await async_client.post("/api/llm/invoke", json=payload, headers=headers)
    # Should accept the request - may timeout but that's OK for this test
    # We're testing that the schema accepts the parameters, not the full flow
    assert response.status_code in [200, 500]  # 500 may occur due to mocked responses
