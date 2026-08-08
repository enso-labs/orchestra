"""Pins that services never re-enter the store they were handed (#957).

`get_store` returns `req.app.state.store` -- the process-wide singleton created
once in the lifespan. Three services used to do `async with self.store as store:`
on it, running `__aenter__`/`__aexit__` on a lifecycle they do not own. This is
the same defect #958/PR #964 fixed in the `/health/store` probe, and these tests
follow that file's model.

Two traps this file is written around, both of which produce a test that passes
against the *pre-fix* code:

1. **The double must not subclass `InMemoryStore`.** `RecordingStore` in
   `test_health_store.py` does, which is right for that endpoint. Here, both
   call sites sit behind `isinstance(self.store, InMemoryStore)` branches
   (`services/assistant.py`, `services/prompt/__init__.py`); an `InMemoryStore`
   subclass routes into the in-memory arm, which never reaches the `async with`
   at all, and `aenter_calls` is trivially 0 either way.

2. **`app.dependency_overrides` is inert for `/api/...` routes.** `main.py`
   builds the outer `app` with `routes=[*mcp_app.routes, *api_app.routes]` --
   the same route objects by reference -- so each keeps
   `dependency_overrides_provider = api_app`. An override installed on `app`
   alone never runs; the real dependency does, reading `req.app.state.store`.
   The override goes on *both* apps, and comes off both on teardown.
"""

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import Request
from langgraph.store.base import Item

from main import api_app, app
from src.services.assistant import AssistantService
from src.services.db import get_store
from src.services.prompt import PromptSearch, PromptService

NOW = datetime(2026, 8, 7, tzinfo=timezone.utc)
SENTINEL_NAME = "sentinel-957"


class CountingStore:
    """A perfectly valid async context manager that counts entries and exits.

    Deliberately NOT an `InMemoryStore` subclass (see module docstring), and
    deliberately does not raise on `__aenter__`: the service is free to enter it,
    so a pre-fix run fails on the counter -- "you entered the singleton" -- rather
    than on an incidental `TypeError` from a double that simply is not enterable.
    """

    def __init__(self, items: list[Item] | None = None) -> None:
        self.aenter_calls = 0
        self.aexit_calls = 0
        self.searches: list[tuple] = []
        self._items = items or []

    async def __aenter__(self) -> "CountingStore":
        self.aenter_calls += 1
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.aexit_calls += 1

    async def asearch(self, namespace, limit: int = 10, **kwargs) -> list[Item]:
        self.searches.append((namespace, limit))
        return list(self._items)


def make_item(name: str = SENTINEL_NAME, namespace=("public", "assistants")) -> Item:
    """An item that survives `_format_assistant` and `PublicAssistant.from_assistant`.

    A double returning plain dicts raises inside `search_public`, which swallows
    everything and returns `[]` -- indistinguishable from an empty result, which
    is exactly how a weakened sentinel gets written.
    """
    return Item(
        value={"name": name, "description": "sentinel", "tools": []},
        key=f"{name}-key",
        namespace=namespace,
        created_at=NOW,
        updated_at=NOW,
    )


@pytest.fixture
def override_store():
    """Install a store double on both apps, restoring prior state on teardown.

    Copied from `tests/integration/test_health_store.py` rather than paraphrased.
    `conftest.py`'s client fixtures clear only `app.dependency_overrides`, so a
    double left on `api_app` -- where the override is actually live -- would pin
    itself for every later test in the session.
    """
    sentinel = object()
    previous = getattr(app.state, "store", sentinel)

    def _apply(store):
        def override_get_store(req: Request):
            return store

        app.dependency_overrides[get_store] = override_get_store
        api_app.dependency_overrides[get_store] = override_get_store
        app.state.store = store
        return store

    yield _apply

    api_app.dependency_overrides.pop(get_store, None)
    app.dependency_overrides.pop(get_store, None)
    if previous is sentinel:
        delattr(app.state, "store")
    else:
        app.state.store = previous


class TestPublicAssistantsRoute:
    """`GET /api/assistants/public` -- unauthenticated, so this one is public-facing."""

    async def test_route_does_not_enter_the_injected_store(self, async_client, override_store):
        store = override_store(CountingStore([make_item()]))

        response = await async_client.get("/api/assistants/public")

        assert response.status_code == 200
        body = response.json()

        # Sentinel FIRST. `search_public` swallows every exception and returns
        # `[]` with a 200, and `PublicAssistant.from_assistant` runs in the route
        # *outside* that try/except, so a 500 or a validation failure would leave
        # the aenter counter at 0 and the assertion below trivially true. This
        # proves the override is live and the double's data actually came back.
        assert [a["name"] for a in body["assistants"]] == [SENTINEL_NAME]
        assert body["assistants"][0]["slug"] == SENTINEL_NAME
        assert store.searches, "search_public never reached the store"

        assert store.aenter_calls == 0
        assert store.aexit_calls == 0

    async def test_the_override_is_actually_live_on_api_app(self, async_client, override_store):
        """Guards the trap itself: prove the dependency resolves to our double.

        If this ever regresses to reading the real `app.state.store`, the test
        above would silently stop testing anything.
        """
        store = override_store(CountingStore([make_item("only-from-the-double")]))

        body = (await async_client.get("/api/assistants/public")).json()

        assert body["assistants"][0]["name"] == "only-from-the-double"
        assert store.searches, "the dependency resolved to something other than our double"
        assert api_app.dependency_overrides.get(get_store) is not None


class TestServicePostgresSearch:
    """The other two `async with self.store` sites, unit-level.

    `AssistantService._postgres_search` (behind `POST /api/assistants/search`) and
    `PromptService._postgres_search`. Both keep their `isinstance` branch and
    their retry loop; only the re-entry is gone.
    """

    async def test_assistant_postgres_search_does_not_enter_the_store(self):
        store = CountingStore([make_item(namespace=("user-1", "assistants"))])
        service = AssistantService(user_id="user-1", store=store)

        results = await service.search(limit=5)

        assert [a.name for a in results] == [SENTINEL_NAME]
        assert store.aenter_calls == 0
        assert store.aexit_calls == 0

    async def test_prompt_postgres_search_does_not_enter_the_store(self):
        item = Item(
            value={"name": "sentinel prompt", "content": "hello", "v": 1},
            key="1",
            namespace=("user-1", "prompts", "p-1"),
            created_at=NOW,
            updated_at=NOW,
        )
        store = CountingStore([item])
        service = PromptService(user_id="user-1", store=store)

        results = await service.search(PromptSearch(limit=5))

        assert len(results) == 1
        assert store.aenter_calls == 0
        assert store.aexit_calls == 0

    async def test_prompt_postgres_search_still_derives_the_public_namespace(self):
        """The `filter={"public": ...}` branch is behaviour the cleanup must not eat."""
        store = CountingStore([])
        service = PromptService(user_id="user-1", store=store)

        await service.search(PromptSearch(limit=5, filter={"public": True}))

        assert store.searches, "the store was never searched"
        namespace, _limit = store.searches[0]
        assert "public" in namespace


def test_no_service_re_enters_its_injected_store():
    """Belt-and-braces across all three sites at once.

    The behavioural tests above cover the three known call sites; this catches a
    fourth being added later in a file no test imports.
    """
    import pathlib

    src = pathlib.Path(__file__).resolve().parents[2] / "src"
    offenders = [
        f"{path.relative_to(src)}:{n}"
        for path in src.rglob("*.py")
        for n, line in enumerate(path.read_text().splitlines(), start=1)
        if "async with self.store" in line or "async with store as" in line
    ]

    assert offenders == [], f"store re-entry reintroduced at: {offenders}"
