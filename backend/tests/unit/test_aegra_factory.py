"""Focused contract tests for the production Aegra factory."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from aegra_api.services.graph_factory import build_server_runtime

import src.agents.factory as factory


@pytest.fixture
def read_runtime():
    return build_server_runtime(access_context="assistants.read", store=None, user=None)


@pytest.fixture
def execution_runtime():
    return build_server_runtime(
        access_context="threads.create_run",
        store=SimpleNamespace(),
        user=SimpleNamespace(identity="runtime-user", is_authenticated=True),
        context={"assistant_id": "assistant-1", "model": "openai:gpt-4.1-mini"},
    )


@pytest.mark.asyncio
async def test_non_execution_factory_path_is_cheap_and_does_not_resolve_sandbox(read_runtime):
    graph = object()
    with (
        patch.object(factory, "_read_graph", return_value=graph),
        patch.object(factory, "resolve_sandbox_backend") as resolve_backend,
        patch.object(factory, "ServiceContext") as service_context,
    ):
        async with factory.build_graph({"configurable": {"user_id": "forged"}}, read_runtime) as result:
            assert result is graph

    resolve_backend.assert_not_called()
    service_context.assert_not_called()


@pytest.mark.asyncio
async def test_factory_uses_runtime_identity_and_cleans_sandbox(execution_runtime):
    sandbox = SimpleNamespace(stop=AsyncMock())
    graph = object()

    class FakeContext:
        def __init__(self, **kwargs):
            self.store = kwargs["store"]
            self.memory_service = object()
            self.llm_service = SimpleNamespace(assistant=AsyncMock(side_effect=lambda value: value))

    with (
        patch.object(factory, "ServiceContext", FakeContext),
        patch.object(
            factory,
            "_resolve_user_settings",
            AsyncMock(return_value=("openai:gpt-4.1-mini", None, None, None, None, None)),
        ),
        patch.object(factory, "prepare_memory_files", AsyncMock(return_value=({}, None))),
        patch.object(factory, "resolve_context_files", AsyncMock(return_value={})),
        patch.object(factory, "resolve_sandbox_backend", return_value=(object(), sandbox, "state")) as resolver,
        patch.object(factory, "construct_agent", AsyncMock(return_value=SimpleNamespace(graph=graph))) as constructor,
    ):
        async with factory.build_graph(
            {"configurable": {"user_id": "forged", "thread_id": "thread-1"}},
            execution_runtime,
        ) as result:
            assert result is graph

    resolver.assert_called_once()
    constructor.assert_awaited_once()
    assert constructor.call_args.kwargs["checkpointer"] is None
    assert sandbox.stop.await_count == 1


def test_runtime_user_id_ignores_client_config():
    runtime = SimpleNamespace(
        user=SimpleNamespace(identity="trusted", is_authenticated=True),
    )
    assert factory._runtime_user_id(runtime) == "trusted"
    config = factory._sanitized_config({"configurable": {"user_id": "forged"}})
    assert "user_id" not in config["configurable"]
