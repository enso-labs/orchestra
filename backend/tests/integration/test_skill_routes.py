"""Integration tests for skills API routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_skills_endpoint(async_client: AsyncClient):
    """Test GET /api/skills returns skills list."""
    response = await async_client.get("/api/skills")

    assert response.status_code == 200
    data = response.json()
    assert "skills" in data
    assert "total" in data
    assert isinstance(data["skills"], list)
    assert data["total"] >= 2  # At least research-agent and code-engineer


@pytest.mark.asyncio
async def test_list_skills_with_category_filter(async_client: AsyncClient):
    """Test GET /api/skills with category filter."""
    response = await async_client.get("/api/skills?category=research")

    assert response.status_code == 200
    data = response.json()
    assert "skills" in data
    # All returned skills should be in research category
    for skill in data["skills"]:
        assert skill["category"] == "research"


@pytest.mark.asyncio
async def test_get_skill_by_slug(async_client: AsyncClient):
    """Test GET /api/skills/{slug} returns skill details."""
    response = await async_client.get("/api/skills/research-agent")

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Research Agent"
    assert data["slug"] == "research-agent"
    assert "description" in data
    assert "tools" in data
    assert "system_prompt" in data


@pytest.mark.asyncio
async def test_get_nonexistent_skill_returns_404(async_client: AsyncClient):
    """Test GET /api/skills/{slug} returns 404 for nonexistent skill."""
    response = await async_client.get("/api/skills/does-not-exist")

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert data["detail"] == "Skill not found"


@pytest.mark.asyncio
async def test_skill_response_structure(async_client: AsyncClient):
    """Test that skill response has correct structure."""
    response = await async_client.get("/api/skills")

    assert response.status_code == 200
    data = response.json()

    # Check first skill has required fields
    if data["skills"]:
        skill = data["skills"][0]
        assert "name" in skill
        assert "description" in skill
        assert "slug" in skill
        assert "category" in skill
        assert "tools" in skill
        assert "enabled" in skill
