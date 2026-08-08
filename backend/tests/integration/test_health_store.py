"""Integration tests for `GET /api/info/health/store`.

The endpoint used to do `async with store as s:` on the value returned by
`get_store`, which is the application-wide singleton (`req.app.state.store`,
set once in the lifespan). Entering and exiting a context manager the handler
does not own is the defect tracked by issue #958, so the tests below pin the
call shape, not just the status code.

Note on how the store is injected here: routes are registered on `api_app` and
copied into `app` by reference (`main.py:126`), so every route's
`dependency_overrides_provider` is `api_app`, not `app`. Setting
`app.dependency_overrides[get_store]` alone does NOT reach this handler -- the
real `get_store` runs and reads `req.app.state.store`. `app.state.store` is
therefore the load-bearing assignment; the overrides are set on both apps as
well so these tests keep working if the routing is ever restructured.
"""

import asyncio
from typing import Any

import pytest
from fastapi import Request
from httpx import AsyncClient
from langgraph.store.memory import InMemoryStore
from main import api_app, app
from src.services.db import get_store


class RecordingStore(InMemoryStore):
    """A fully valid async context manager that counts entries and exits.

    Deliberately does NOT raise on `__aenter__`. That makes the assertion
    semantic rather than incidental: the handler is free to enter it, so the
    test fails against the pre-fix code on the counter itself ("you entered the
    singleton") instead of on an unrelated `TypeError` from a double that simply
    is not enterable.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.aenter_calls = 0
        self.aexit_calls = 0

    async def __aenter__(self) -> "RecordingStore":
        self.aenter_calls += 1
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.aexit_calls += 1


class FailingSearchStore(InMemoryStore):
    """`asearch` raises a generic error -- the 500 fallback path."""

    async def asearch(self, *args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("boom")


class BrokenLinkStore(InMemoryStore):
    """`asearch` raises the message the "connection"/"closed" 503 branch matches."""

    async def asearch(self, *args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("the connection is closed")


class TimingOutStore(InMemoryStore):
    """`asearch` times out, exercising the `except asyncio.TimeoutError` branch."""

    async def asearch(self, *args: Any, **kwargs: Any) -> Any:
        raise asyncio.TimeoutError()


@pytest.fixture
def override_store():
    """Swap in a store double, restoring `app.state.store` afterwards.

    The `async_client` fixture clears `app.dependency_overrides` on teardown but
    does not reset `app.state.store`, so a double left there would leak onto the
    module-level `app` for every later test in the session.
    """
    sentinel = object()
    previous = getattr(app.state, "store", sentinel)

    def _apply(store: InMemoryStore) -> InMemoryStore:
        def override_get_store(req: Request) -> InMemoryStore:
            return store

        app.dependency_overrides[get_store] = override_get_store
        api_app.dependency_overrides[get_store] = override_get_store
        app.state.store = store
        return store

    yield _apply

    api_app.dependency_overrides.pop(get_store, None)
    if previous is sentinel:
        delattr(app.state, "store")
    else:
        app.state.store = previous


@pytest.mark.asyncio
async def test_store_health_reports_healthy(async_client: AsyncClient, test_store: InMemoryStore):
    """Happy path: the probe answers 200 with the documented body."""
    response = await async_client.get("/api/info/health/store")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "healthy"
    assert body["test_operation"] == "search"
    assert body["message"] == "Store connection is working"
    # `store_type` reflects whatever store was injected -- the in-memory double
    # here, `AsyncPostgresStore` in production.
    assert body["store_type"] == type(test_store).__name__


@pytest.mark.asyncio
async def test_store_health_does_not_enter_store_context(async_client: AsyncClient, override_store):
    """Regression for #958: the probe must not re-enter the injected singleton.

    This is the test that pins the fix. `RecordingStore` is a perfectly usable
    async context manager, so the pre-fix handler enters it happily and still
    returns 200 -- the failure it produces is `aenter_calls == 1`, which names
    the actual defect. Post-fix both counters stay at zero.

    Scope of the guard: it proves the handler does not enter *the instance it
    was given*. It would not catch a handler that opened a fresh store from the
    `get_store_db()` factory instead.
    """
    store = override_store(RecordingStore())

    response = await async_client.get("/api/info/health/store")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "healthy"
    assert store.aenter_calls == 0, "handler entered the app-wide singleton's context manager"
    assert store.aexit_calls == 0, "handler exited the app-wide singleton's context manager"


@pytest.mark.asyncio
async def test_store_health_maps_search_failure_to_500(async_client: AsyncClient, override_store):
    """A generic store failure surfaces as a 500 with the message passed through."""
    override_store(FailingSearchStore())

    response = await async_client.get("/api/info/health/store")

    assert response.status_code == 500
    assert "boom" in response.json()["detail"]


@pytest.mark.asyncio
async def test_store_health_maps_closed_connection_to_503(async_client: AsyncClient, override_store):
    """FR-4: the "connection"/"closed" branch must keep mapping to 503, not 500.

    Pins the branch the PRD explicitly forbids deleting as newly-dead code.
    """
    override_store(BrokenLinkStore())

    response = await async_client.get("/api/info/health/store")

    assert response.status_code == 503
    assert response.json()["detail"] == "Store connection is closed - service unavailable"


@pytest.mark.asyncio
async def test_store_health_maps_timeout_to_503(async_client: AsyncClient, override_store):
    """FR-2: a timed-out store operation is a 503, not a 500.

    Exercises the `except asyncio.TimeoutError` branch. The literal 5.0s budget
    is not asserted -- doing so would cost five seconds of suite time for a
    constant.
    """
    override_store(TimingOutStore())

    response = await async_client.get("/api/info/health/store")

    assert response.status_code == 503
    assert response.json()["detail"] == "Store connection timeout - service unavailable"
