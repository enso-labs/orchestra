"""Cross-path tests for Daytona execute availability and command execution behavior.

US-005: Verifies that all three execution paths (invoke, stream, worker) consistently
handle execute-capable and execute-missing Daytona backends, and that the fallback
messages are deterministic across paths.
"""

import ujson
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import SystemMessage
from langgraph.store.memory import InMemoryStore

from src.agents.daytona import (
    DAYTONA_BACKEND_UNAVAILABLE_REASON,
    DAYTONA_EXECUTE_MISSING_REASON,
    DaytonaExecuteCapability,
    daytona_fallback_message,
    validate_daytona_execute_capability,
)
from src.controllers.llm import LLMController
from src.schemas.entities.llm import LLMRequest


# ---------------------------------------------------------------------------
# Shared test doubles
# ---------------------------------------------------------------------------

class _DummyCheckpointCtx:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeInvokeAgent:
    def __init__(self):
        self.graph = MagicMock()
        self.graph.aget_state = AsyncMock()
        self.invoke = AsyncMock(return_value={"ok": True})


class _FakeStreamAgent:
    def __init__(self):
        self.model = "openai/gpt-4o-mini"
        self.graph = MagicMock()
        self.graph.aget_state = AsyncMock(
            return_value=MagicMock(
                config={"configurable": {}},
                values={"messages": []},
            )
        )

    async def astream(self, *_args, **_kwargs):
        if False:
            yield None


class _ExecuteCapableBackend:
    """A test double that satisfies the deepagents sandbox execute protocol."""

    def __init__(self):
        self.execute_calls: list[tuple] = []

    def execute(self, command: str, **kwargs):
        self.execute_calls.append((command, kwargs))
        return {"exit_code": 0, "stdout": "ok", "stderr": ""}


class _NoExecuteBackend:
    """A test double that lacks execute(), simulating an incomplete sandbox."""
    pass


# ---------------------------------------------------------------------------
# 1. Cross-path: validate_daytona_execute_capability is consistent
# ---------------------------------------------------------------------------

class TestCrossPathCapabilityConsistency:
    """The shared capability validator produces identical results regardless of caller."""

    def test_execute_capable_backend_passes(self):
        cap = validate_daytona_execute_capability(_ExecuteCapableBackend())
        assert cap.supported is True
        assert cap.reason is None

    def test_no_execute_backend_fails(self):
        cap = validate_daytona_execute_capability(_NoExecuteBackend())
        assert cap.supported is False
        assert cap.reason == DAYTONA_EXECUTE_MISSING_REASON

    def test_none_backend_fails(self):
        cap = validate_daytona_execute_capability(None)
        assert cap.supported is False
        assert cap.reason == DAYTONA_BACKEND_UNAVAILABLE_REASON

    def test_fallback_message_deterministic(self):
        """All paths use daytona_fallback_message() so the user sees the same text."""
        msg1 = daytona_fallback_message(DAYTONA_EXECUTE_MISSING_REASON)
        msg2 = daytona_fallback_message(DAYTONA_EXECUTE_MISSING_REASON)
        assert msg1 == msg2
        assert "falling back to default sandbox" in msg1

    def test_fallback_message_includes_unavailable_reason(self):
        msg = daytona_fallback_message(DAYTONA_BACKEND_UNAVAILABLE_REASON)
        assert DAYTONA_BACKEND_UNAVAILABLE_REASON in msg


# ---------------------------------------------------------------------------
# 2. Invoke path: execute-capable success + execute-unavailable fallback
# ---------------------------------------------------------------------------

class TestInvokePathDaytona:

    def _make_controller(self):
        store = InMemoryStore()
        ctrl = LLMController(user_id="test-user", store=store, config={"configurable": {}})
        ctrl._update_store = AsyncMock()
        return ctrl

    def _make_request(self):
        return LLMRequest(
            model="openai/gpt-4o-mini",
            metadata={"sandbox": "daytona"},
            input={"messages": [{"role": "user", "content": "run ls"}]},
        )

    @pytest.mark.asyncio
    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_execute_capable_uses_composite_backend(
        self, mock_create, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-1/4: Invoke path uses Daytona backend when execute() is present."""
        ctrl = self._make_controller()
        req = self._make_request()
        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeInvokeAgent()

        execute_backend = _ExecuteCapableBackend()
        sandbox = MagicMock()
        mock_create.return_value = (sandbox, execute_backend)
        ctrl._resolve_user_settings = AsyncMock(return_value=(req.model, "k", "daytona"))

        await ctrl.llm_invoke(req)

        mock_create.assert_called_once_with(api_key="k")
        # construct_agent gets a CompositeBackend wrapping the execute-capable backend
        from deepagents.backends import CompositeBackend
        call_kwargs = mock_construct.call_args[1]
        assert isinstance(call_kwargs["backend"], CompositeBackend)
        # No fallback messages injected
        assert not any(
            isinstance(m, SystemMessage) and "falling back" in str(m.content)
            for m in req.input.messages
        )
        sandbox.stop.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_execute_unavailable_falls_back(
        self, mock_create, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-1: Invoke path falls back with SystemMessage when execute() missing."""
        ctrl = self._make_controller()
        req = self._make_request()
        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeInvokeAgent()

        sandbox = MagicMock()
        mock_create.return_value = (sandbox, _NoExecuteBackend())
        ctrl._resolve_user_settings = AsyncMock(return_value=(req.model, "k", "daytona"))

        await ctrl.llm_invoke(req)

        fallback_msgs = [
            m for m in req.input.messages
            if isinstance(m, SystemMessage) and "falling back to default sandbox" in str(m.content)
        ]
        assert len(fallback_msgs) == 1
        assert DAYTONA_EXECUTE_MISSING_REASON in str(fallback_msgs[0].content)
        sandbox.stop.assert_called_once()


# ---------------------------------------------------------------------------
# 3. Stream path: execute-capable success + SSE fallback
# ---------------------------------------------------------------------------

class TestStreamPathDaytona:

    def _build_service_context(self):
        ctx = MagicMock()
        ctx.user_id = "user-1"
        ctx.memory_service = MagicMock()
        ctx.store = MagicMock()
        ctx.thread_service.update = AsyncMock()
        return ctx

    def _build_input(self):
        inp = MagicMock()
        inp.files = {}
        inp.messages = [MagicMock()]
        return inp

    def _default_config(self):
        return {
            "metadata": {},
            "configurable": {"thread_id": "t1", "assistant_id": "a1", "project_id": "p1"},
        }

    @pytest.mark.asyncio
    @patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
    @patch("src.utils.stream.init_backend")
    @patch("src.utils.stream.create_daytona_backend")
    async def test_stream_execute_capable_uses_daytona(
        self, mock_create, mock_init, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-2: Stream path uses Daytona when execute() is present, no fallback SSE."""
        from src.utils.stream import stream_generator

        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeStreamAgent()

        sandbox = MagicMock()
        execute_backend = MagicMock()  # MagicMock has execute
        mock_create.return_value = (sandbox, execute_backend)

        events = [
            e async for e in stream_generator(
                input=self._build_input(),
                model="openai/gpt-4o-mini",
                system_prompt="sys",
                tools=[],
                subagents=[],
                config=self._default_config(),
                service_context=self._build_service_context(),
                sandbox_backend="daytona",
                api_key="key-1",
            )
        ]

        mock_create.assert_called_once_with(api_key="key-1")
        mock_init.assert_not_called()
        sandbox.stop.assert_called_once()
        assert not any("falling back" in e for e in events)

    @pytest.mark.asyncio
    @patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
    @patch("src.utils.stream.init_backend")
    @patch("src.utils.stream.create_daytona_backend")
    async def test_stream_execute_unavailable_emits_sse_fallback(
        self, mock_create, mock_init, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-2: Stream path emits SSE fallback when execute() missing."""
        from src.utils.stream import stream_generator

        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeStreamAgent()

        sandbox = MagicMock()
        mock_create.return_value = (sandbox, _NoExecuteBackend())
        mock_init.return_value = MagicMock()

        events = [
            e async for e in stream_generator(
                input=self._build_input(),
                model="openai/gpt-4o-mini",
                system_prompt="sys",
                tools=[],
                subagents=[],
                config=self._default_config(),
                service_context=self._build_service_context(),
                sandbox_backend="daytona",
                api_key="key-1",
            )
        ]

        fallback_events = [e for e in events if "falling back to default sandbox" in e]
        assert len(fallback_events) == 1
        parsed = ujson.loads(fallback_events[0].removeprefix("data: ").strip())
        assert parsed[0] == "system"
        assert DAYTONA_EXECUTE_MISSING_REASON in parsed[1]


# ---------------------------------------------------------------------------
# 4. Worker path: execute-capable success + Redis fallback
# ---------------------------------------------------------------------------

class _EmptyAstream:
    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


def _make_worker_agent(mock_construct):
    fake_agent = MagicMock()
    fake_agent.model = "openai/gpt-4o-mini"
    fake_agent.graph.aget_state = AsyncMock(
        return_value=MagicMock(
            config={"configurable": {}},
            values={"messages": []},
        )
    )
    fake_agent.astream = lambda *_a, **_kw: _EmptyAstream()
    mock_construct.return_value = fake_agent
    return fake_agent


def _make_worker_context():
    ctx = MagicMock()
    ctx.llm_service.assistant = AsyncMock(side_effect=lambda p: p)
    ctx.memory_service = MagicMock()
    ctx.store = MagicMock()
    ctx.user_id = "user-1"
    ctx.thread_service.update = AsyncMock()
    return ctx


def _make_worker_params():
    params = MagicMock()
    params.model = "openai/gpt-4o-mini"
    params.instructions = "i"
    params.system_prompt = "s"
    params.tools = []
    params.subagents = []
    params.input = MagicMock()
    params.input.messages = [MagicMock()]
    return params


class TestWorkerPathDaytona:

    @pytest.mark.asyncio
    @patch("src.workers.tasks.resolve_api_key")
    @patch("src.workers.tasks.UserSettingsRepo")
    @patch("src.agents.create_daytona_backend")
    @patch("src.agents.init_backend")
    @patch("src.agents.construct_agent", new_callable=AsyncMock)
    @patch("src.agents.prepare_memory_files", new_callable=AsyncMock)
    async def test_worker_execute_capable_uses_daytona(
        self,
        mock_prepare,
        mock_construct,
        mock_init,
        mock_create,
        mock_settings_repo,
        mock_resolve_key,
    ):
        """AC-3: Worker path uses Daytona when execute() present, no Redis fallback."""
        from src.workers.tasks import _execute_agent_stream

        mock_prepare.return_value = ({}, [])
        mock_resolve_key.return_value = "k"
        _make_worker_agent(mock_construct)

        sandbox = MagicMock()
        execute_backend = MagicMock()  # MagicMock has execute
        mock_create.return_value = (sandbox, execute_backend)

        repo_instance = MagicMock()
        repo_instance._get_or_create = AsyncMock(
            return_value=MagicMock(sandbox_backend="daytona")
        )
        repo_instance._decrypt_keys.return_value = {}
        mock_settings_repo.return_value = repo_instance

        redis_client = MagicMock()
        redis_client.xadd = AsyncMock()
        redis_client.expire = AsyncMock()

        await _execute_agent_stream(
            params=_make_worker_params(),
            config={"configurable": {"thread_id": "t1", "assistant_id": None, "project_id": None}},
            files_map={},
            todos_list=[],
            service_context=_make_worker_context(),
            checkpointer=MagicMock(),
            user_id="user-1",
            thread_id="t1",
            stream_key="agent:stream:t1",
            redis_client=redis_client,
        )

        mock_create.assert_called_once_with(api_key="k")
        sandbox.stop.assert_called_once()
        mock_init.assert_not_called()

        # No fallback messages written to Redis
        for call in redis_client.xadd.call_args_list:
            if call.args and len(call.args) > 1 and isinstance(call.args[1], dict):
                assert "falling back" not in str(call.args[1].get("data", ""))

    @pytest.mark.asyncio
    @patch("src.workers.tasks.resolve_api_key")
    @patch("src.workers.tasks.UserSettingsRepo")
    @patch("src.agents.create_daytona_backend")
    @patch("src.agents.init_backend")
    @patch("src.agents.construct_agent", new_callable=AsyncMock)
    @patch("src.agents.prepare_memory_files", new_callable=AsyncMock)
    async def test_worker_execute_unavailable_writes_redis_fallback(
        self,
        mock_prepare,
        mock_construct,
        mock_init,
        mock_create,
        mock_settings_repo,
        mock_resolve_key,
    ):
        """AC-3: Worker path writes Redis fallback when execute() missing."""
        from src.workers.tasks import _execute_agent_stream

        mock_prepare.return_value = ({}, [])
        mock_resolve_key.return_value = "k"
        mock_init.return_value = MagicMock()
        _make_worker_agent(mock_construct)

        sandbox = MagicMock()
        mock_create.return_value = (sandbox, _NoExecuteBackend())

        repo_instance = MagicMock()
        repo_instance._get_or_create = AsyncMock(
            return_value=MagicMock(sandbox_backend="daytona")
        )
        repo_instance._decrypt_keys.return_value = {}
        mock_settings_repo.return_value = repo_instance

        redis_client = MagicMock()
        redis_client.xadd = AsyncMock()
        redis_client.expire = AsyncMock()

        await _execute_agent_stream(
            params=_make_worker_params(),
            config={"configurable": {"thread_id": "t1", "assistant_id": None, "project_id": None}},
            files_map={},
            todos_list=[],
            service_context=_make_worker_context(),
            checkpointer=MagicMock(),
            user_id="user-1",
            thread_id="t1",
            stream_key="agent:stream:t1",
            redis_client=redis_client,
        )

        sandbox.stop.assert_called_once()
        mock_init.assert_called_once()

        # Verify fallback message was written to Redis
        fallback_found = any(
            "falling back to default sandbox" in str(call.args[1].get("data", ""))
            for call in redis_client.xadd.call_args_list
            if call.args and len(call.args) > 1 and isinstance(call.args[1], dict)
        )
        assert fallback_found, "Expected Redis fallback message not found"


# ---------------------------------------------------------------------------
# 5. Command execution flow verification (AC-4)
# ---------------------------------------------------------------------------

class TestCommandExecutionFlowInvoked:
    """Verify that when Daytona execute capability is present, the backend with
    execute() is actually wired into the agent — proving the execution flow is
    available for deepagents to call."""

    @pytest.mark.asyncio
    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_wires_execute_capable_backend_to_agent(
        self, mock_create, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-4: When Daytona has execute(), the CompositeBackend wrapping it is
        passed to construct_agent, making execute() available to the LLM tool loop."""
        store = InMemoryStore()
        ctrl = LLMController(user_id="u1", store=store, config={"configurable": {}})
        ctrl._update_store = AsyncMock()

        req = LLMRequest(
            model="openai/gpt-4o-mini",
            metadata={},
            input={"messages": [{"role": "user", "content": "run echo hello"}]},
        )
        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeInvokeAgent()

        execute_backend = _ExecuteCapableBackend()
        sandbox = MagicMock()
        mock_create.return_value = (sandbox, execute_backend)
        ctrl._resolve_user_settings = AsyncMock(return_value=(req.model, "k", "daytona"))

        await ctrl.llm_invoke(req)

        # The backend passed to construct_agent must expose execute()
        from deepagents.backends import CompositeBackend
        call_kwargs = mock_construct.call_args[1]
        backend = call_kwargs["backend"]
        assert isinstance(backend, CompositeBackend)
        # The default backend inside the composite is our execute-capable one
        assert backend.default is execute_backend
        assert callable(getattr(backend.default, "execute", None))

    @pytest.mark.asyncio
    @patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
    @patch("src.utils.stream.init_backend")
    @patch("src.utils.stream.create_daytona_backend")
    async def test_stream_wires_execute_capable_backend_to_agent(
        self, mock_create, mock_init, mock_construct, mock_prep, _mock_ckpt,
    ):
        """AC-4: Stream path wires execute-capable backend into agent."""
        from src.utils.stream import stream_generator

        mock_prep.return_value = ({}, [])
        mock_construct.return_value = _FakeStreamAgent()

        execute_backend = _ExecuteCapableBackend()
        sandbox = MagicMock()
        mock_create.return_value = (sandbox, execute_backend)

        _ = [
            e async for e in stream_generator(
                input=MagicMock(files={}, messages=[MagicMock()]),
                model="openai/gpt-4o-mini",
                system_prompt="sys",
                tools=[],
                subagents=[],
                config={
                    "metadata": {},
                    "configurable": {"thread_id": "t1", "assistant_id": "a1", "project_id": "p1"},
                },
                service_context=MagicMock(
                    user_id="u1",
                    memory_service=MagicMock(),
                    store=MagicMock(),
                    thread_service=MagicMock(update=AsyncMock()),
                ),
                sandbox_backend="daytona",
                api_key="key-1",
            )
        ]

        from deepagents.backends import CompositeBackend
        call_kwargs = mock_construct.call_args[1]
        backend = call_kwargs["backend"]
        assert isinstance(backend, CompositeBackend)
        assert backend.default is execute_backend
        assert callable(getattr(backend.default, "execute", None))
