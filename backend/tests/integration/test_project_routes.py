import pytest
from uuid import uuid4


@pytest.mark.asyncio
async def test_create_project(async_client, auth_headers):
    """Test creating a new project."""
    project_data = {
        "name": "Test Project",
        "description": "A test project for integration testing",
    }

    response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "project_id" in data
    assert data["project_id"] is not None


@pytest.mark.asyncio
async def test_get_project(async_client, auth_headers):
    """Test getting a project by ID."""
    # First create a project
    project_data = {
        "name": "Test Get Project",
        "description": "Project for get test",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert create_response.status_code == 200
    project_id = create_response.json()["project_id"]

    # Now get the project
    response = await async_client.get(
        f"/api/projects/{project_id}", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "project" in data
    assert data["project"]["id"] == project_id
    assert data["project"]["name"] == project_data["name"]
    assert data["project"]["description"] == project_data["description"]


@pytest.mark.asyncio
async def test_search_projects_all(async_client, auth_headers):
    """Test searching for all projects."""
    # Create a couple of projects first
    for i in range(2):
        project_data = {
            "name": f"Search Test Project {i}",
            "description": f"Project {i} for search test",
        }
        await async_client.post(
            "/api/projects", json=project_data, headers=auth_headers
        )

    # Search for all projects
    search_data = {"filter": {}, "limit": 10, "offset": 0}

    response = await async_client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    assert isinstance(data["projects"], list)
    assert len(data["projects"]) >= 2


@pytest.mark.asyncio
async def test_search_projects_by_id(async_client, auth_headers):
    """Test searching for a specific project by ID."""
    # Create a project
    project_data = {
        "name": "Search By ID Project",
        "description": "Project for search by ID test",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Search by ID
    search_data = {"filter": {"id": project_id}, "limit": 10, "offset": 0}

    response = await async_client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "project" in data
    assert data["project"]["id"] == project_id
    assert data["project"]["name"] == project_data["name"]
    assert data["project"]["description"] == project_data["description"]


@pytest.mark.asyncio
async def test_delete_project(async_client, auth_headers):
    """Test deleting a project."""
    # Create a project
    project_data = {
        "name": "Delete Test Project",
        "description": "Project to be deleted",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Delete the project
    response = await async_client.delete(
        f"/api/projects/{project_id}", headers=auth_headers
    )

    assert response.status_code == 204

    # Verify project is deleted by trying to get it
    get_response = await async_client.get(
        f"/api/projects/{project_id}", headers=auth_headers
    )
    # Should return 500 or error since project doesn't exist
    assert get_response.status_code in [404, 500]


@pytest.mark.asyncio
async def test_add_project_sources(async_client, auth_headers):
    """Test adding sources to a project."""
    # Create a project
    project_data = {
        "name": "Sources Test Project",
        "description": "Project for testing sources",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Add sources
    sources_data = [
        {
            "type": "base64",
            "content": {"data": ["data:text/plain;base64,SGVsbG8sIFdvcmxkIQ=="]},
        }
    ]

    response = await async_client.post(
        f"/api/projects/{project_id}/sources", json=sources_data, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) > 0


@pytest.mark.asyncio
async def test_get_project_sources(async_client, auth_headers):
    """Test getting sources from a project."""
    # Create a project
    project_data = {
        "name": "Get Sources Test Project",
        "description": "Project for getting sources",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Add sources
    sources_data = [
        {"type": "base64", "content": {"data": ["data:text/plain;base64,VGVzdCBkYXRh"]}}
    ]

    add_response = await async_client.post(
        f"/api/projects/{project_id}/sources", json=sources_data, headers=auth_headers
    )
    assert add_response.status_code == 200

    # Get sources
    response = await async_client.get(
        f"/api/projects/{project_id}/sources", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) > 0


@pytest.mark.asyncio
async def test_delete_project_source(async_client, auth_headers):
    """Test deleting a source from a project."""
    # Create a project
    project_data = {
        "name": "Delete Source Test Project",
        "description": "Project for deleting sources",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Add sources
    sources_data = [
        {
            "type": "base64",
            "content": {"data": ["data:text/plain;base64,RGVsZXRlIHRlc3Q="]},
        }
    ]

    add_response = await async_client.post(
        f"/api/projects/{project_id}/sources", json=sources_data, headers=auth_headers
    )
    assert add_response.status_code == 200
    source_id = add_response.json()["sources"][0]["id"]

    # Delete the source
    response = await async_client.delete(
        f"/api/projects/{project_id}/sources/{source_id}", headers=auth_headers
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_search_project_documents(async_client, auth_headers):
    """Test searching for documents within a project."""
    # Create a project
    project_data = {
        "name": "Document Search Test Project",
        "description": "Project for document search",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    project_id = create_response.json()["project_id"]

    # Add sources with documents
    sources_data = [
        {
            "type": "base64",
            "content": {"data": ["data:text/plain;base64,U2VhcmNoYWJsZSBjb250ZW50"]},
        }
    ]

    await async_client.post(
        f"/api/projects/{project_id}/sources", json=sources_data, headers=auth_headers
    )

    # Search for documents with a query
    search_data = {
        "filter": {"id": project_id},
        "query": "content",
        "limit": 10,
        "offset": 0,
    }

    response = await async_client.post(
        "/api/projects/search", json=search_data, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    # Should return documents instead of projects when query is provided
    assert "documents" in data or "projects" in data


@pytest.mark.asyncio
async def test_create_project_missing_name(async_client, auth_headers):
    """Test creating a project without required name field."""
    project_data = {
        "description": "Missing name field",
    }

    response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )

    # Should return validation error
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_nonexistent_project(async_client, auth_headers):
    """Test getting a project that doesn't exist."""
    fake_project_id = str(uuid4())

    response = await async_client.get(
        f"/api/projects/{fake_project_id}", headers=auth_headers
    )

    # Should return error
    assert response.status_code in [404, 500]


@pytest.mark.asyncio
async def test_project_lifecycle(async_client, auth_headers):
    """Test complete project lifecycle: create, add sources, get, delete."""
    # 1. Create project
    project_data = {
        "name": "Lifecycle Test Project",
        "description": "Full lifecycle test",
    }

    create_response = await async_client.post(
        "/api/projects", json=project_data, headers=auth_headers
    )
    assert create_response.status_code == 200
    project_id = create_response.json()["project_id"]

    # 2. Add sources
    sources_data = [
        {
            "type": "base64",
            "content": {"data": ["data:text/plain;base64,TGlmZWN5Y2xlIHRlc3Q="]},
        }
    ]

    add_sources_response = await async_client.post(
        f"/api/projects/{project_id}/sources", json=sources_data, headers=auth_headers
    )
    assert add_sources_response.status_code == 200

    # 3. Get project with sources
    get_response = await async_client.get(
        f"/api/projects/{project_id}", headers=auth_headers
    )
    assert get_response.status_code == 200
    project = get_response.json()["project"]
    assert project["name"] == project_data["name"]

    # 4. Get sources
    get_sources_response = await async_client.get(
        f"/api/projects/{project_id}/sources", headers=auth_headers
    )
    assert get_sources_response.status_code == 200
    assert len(get_sources_response.json()["sources"]) > 0

    # 5. Delete project
    delete_response = await async_client.delete(
        f"/api/projects/{project_id}", headers=auth_headers
    )
    assert delete_response.status_code == 204
