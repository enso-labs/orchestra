"""No-side-effect contract tests for deferred capabilities."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from custom_app import app
from src.routes.deferred import FOLLOW_UP_MESSAGE, UNSUPPORTED_CODE


@pytest.fixture
def transport() -> ASGITransport:
    return ASGITransport(app=app)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/schedules"),
        ("post", "/api/schedules"),
        ("get", "/api/schedules/schedule-1"),
        ("put", "/api/schedules/schedule-1"),
        ("delete", "/api/schedules/schedule-1"),
        ("post", "/api/schedules/schedule-1/execute"),
        ("post", "/api/schedules/schedule-1/enable"),
        ("get", "/api/schedules/schedule-1/executions"),
        ("post", "/api/assistants/assistant-1/distill"),
        ("post", "/api/llm/optimize"),
        ("post", "/api/trajectories/thread-1"),
        ("post", "/api/distillation/assistant-1"),
    ],
)
async def test_deferred_entry_points_are_explicitly_unsupported(
    transport: ASGITransport,
    method: str,
    path: str,
) -> None:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await getattr(client, method)(path)

    assert response.status_code == 501
    assert response.headers["x-capability-status"] == "unsupported"
    assert response.json() == {
        "code": UNSUPPORTED_CODE,
        "capability": (
            "trajectory_distillation"
            if "distill" in path or "trajector" in path or "optimize" in path
            else "scheduled_execution"
        ),
        "message": FOLLOW_UP_MESSAGE,
    }


@pytest.mark.asyncio
async def test_deferred_operations_do_not_import_or_start_old_runtimes(transport: ASGITransport) -> None:
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/schedules", json={"title": "must not enqueue"})
        await client.post("/api/assistants/assistant-1/distill")

    assert "src.services." + "schedule" not in sys.modules
    assert "apscheduler" not in sys.modules
    assert "src." + "workers" not in sys.modules
    assert "task" + "iq" not in sys.modules


def test_custom_app_import_has_deferred_routes_without_legacy_modules() -> None:
    backend = Path(__file__).parents[2]
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
    payload = __import__("json").loads(result.stdout.strip().splitlines()[-1])
    assert not any(payload["legacy"].values())
    assert "/api/schedules" in payload["paths"]
    assert "/api/assistants/{assistant_id}/distill" in payload["paths"]
    assert "/mcp" in payload["paths"]
