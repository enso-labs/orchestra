"""The custom app must not import the deleted/eager graph runtime surface."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from unittest.mock import patch

import pytest
from fastapi_cache import FastAPICache
from httpx import ASGITransport, AsyncClient

from custom_app import app, lifespan


def test_custom_app_import_has_no_legacy_runtime_dependencies():
    backend = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    script = """
import json
import sys
import custom_app
paths = [getattr(route, 'path', '') for route in custom_app.app.routes]
print(json.dumps({
    'legacy': {name: name in sys.modules for name in (
        'task' + 'iq', 'apscheduler', 'src.' + 'workers', 'src.controllers.' + 'llm',
        'src.routes.v0.' + 'llm', 'src.routes.v0.' + 'thread', 'src.routes.v0.' + 'schedule',
    )},
    'paths': paths,
}))
"""
    env = {
        **os.environ,
        "POSTGRES_CONNECTION_STRING": "postgresql://test:test@localhost:5432/test",
        "OPENAI_API_KEY": "test-key",
        "USER_AGENT": "orchestra-tests",
    }
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert not any(payload["legacy"].values())
    assert "/api/auth/login" in payload["paths"]
    assert "/api/llm/" + "stream" not in payload["paths"]
    assert "/api/llm/" + "invoke" not in payload["paths"]
    assert "/mcp" in payload["paths"]
    assert not any(path == "/{filename:path}" for path in payload["paths"])


@pytest.mark.asyncio
async def test_retained_custom_health_route_is_json_and_does_not_use_spa_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/info/health")
        missing_protocol = await client.post("/threads/search", json={})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["status"] == "healthy"
    assert missing_protocol.headers["content-type"].startswith("application/json")
    assert "<html" not in missing_protocol.text.lower()


@pytest.mark.asyncio
async def test_custom_lifespan_initializes_route_cache():
    """Cached custom routes must be usable after Aegra merges the lifespans."""

    FastAPICache.reset()

    with patch("aegra_api.core.database.db_manager.get_store", return_value=object()):
        async with lifespan(app):
            assert FastAPICache.get_prefix() == "orchestra-cache"

    FastAPICache.reset()
