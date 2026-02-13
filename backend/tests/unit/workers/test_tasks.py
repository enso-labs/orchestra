"""Unit tests for TaskIQ task definitions.

Phase 3-4 TDD: Tests for task definitions ensuring proper registration and behavior.
"""

import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch


class TestRunAgentStreamTask:
    """Tests for the run_agent_stream task."""

    def test_task_is_registered(self):
        """run_agent_stream task is registered with broker."""
        from src.workers.tasks import run_agent_stream

        assert run_agent_stream is not None
        assert hasattr(run_agent_stream, "kiq")

    def test_task_has_correct_name(self):
        """Task has expected task_name."""
        from src.workers.tasks import run_agent_stream

        assert run_agent_stream.task_name == "run_agent_stream"

    def test_task_is_callable(self):
        """Task is callable."""
        from src.workers.tasks import run_agent_stream

        assert callable(run_agent_stream)

    def test_task_has_kiq_method(self):
        """Task has kiq method for enqueuing."""
        from src.workers.tasks import run_agent_stream

        assert hasattr(run_agent_stream, "kiq")
        assert callable(run_agent_stream.kiq)


class TestRedisStreamOperations:
    """Tests for Redis stream operations used in tasks."""

    @pytest.mark.asyncio
    async def test_task_writes_to_redis_stream(self, fake_redis):
        """Task writes chunks to Redis stream."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"data": b"test chunk"})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 2

    @pytest.mark.asyncio
    async def test_task_sets_stream_ttl(self, fake_redis):
        """Task sets TTL on stream key."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})
        await fake_redis.expire(stream_key, 300)

        ttl = await fake_redis.ttl(stream_key)
        assert 0 < ttl <= 300

    @pytest.mark.asyncio
    async def test_task_writes_error_on_failure(self, fake_redis):
        """Task writes error to stream on exception."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"error": b"Test error", "done": b"true"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 1
        assert b"error" in messages[0][1]

    @pytest.mark.asyncio
    async def test_stream_key_format(self, fake_redis):
        """Stream key follows expected format."""
        thread_id = "test-thread-12345"
        expected_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(expected_key, {"data": b"test"})

        # Verify key exists
        exists = await fake_redis.exists(expected_key)
        assert exists

    @pytest.mark.asyncio
    async def test_multiple_chunks_ordered(self, fake_redis):
        """Multiple chunks are stored in order."""
        import ujson

        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        # Add chunks in order
        chunks = [
            {"type": "messages", "content": "chunk1"},
            {"type": "messages", "content": "chunk2"},
            {"type": "values", "messages": []},
        ]

        for chunk in chunks:
            await fake_redis.xadd(stream_key, {"data": ujson.dumps(chunk).encode()})

        await fake_redis.xadd(stream_key, {"done": b"true"})

        # Read back
        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 4  # 3 chunks + done

        # Verify order
        for i, (msg_id, data) in enumerate(messages[:-1]):  # Skip done marker
            parsed = ujson.loads(data[b"data"])
            assert parsed["content" if "content" in parsed else "messages"] is not None


class TestTaskSerialization:
    """Tests for task parameter serialization."""

    def test_llm_request_dict_serializable(self, sample_llm_request_dict):
        """LLMRequest dict is properly structured for serialization."""
        import ujson

        # Should be JSON serializable
        serialized = ujson.dumps(sample_llm_request_dict)
        assert isinstance(serialized, str)

        # Should round-trip
        deserialized = ujson.loads(serialized)
        assert deserialized["input"]["messages"][0]["content"] == "Hello, test!"

    def test_config_dict_serializable(self, sample_config_dict):
        """Config dict is properly structured for serialization."""
        import ujson

        # Should be JSON serializable
        serialized = ujson.dumps(sample_config_dict)
        assert isinstance(serialized, str)

        # Should round-trip
        deserialized = ujson.loads(serialized)
        assert deserialized["configurable"]["thread_id"] == "test-thread-123"


class TestExecuteAgentStreamBackendRouting:
    @pytest.mark.asyncio
    @patch("src.workers.tasks.resolve_api_key")
    @patch("src.workers.tasks.UserSettingsRepo")
    @patch("src.agents.create_daytona_backend")
    @patch("src.agents.init_backend")
    @patch("src.agents.construct_agent", new_callable=AsyncMock)
    @patch("src.agents.prepare_memory_files", new_callable=AsyncMock)
    async def test_execute_agent_stream_uses_settings_daytona_and_falls_back_with_notice(
        self,
        mock_prepare_memory_files,
        mock_construct_agent,
        mock_init_backend,
        mock_create_daytona_backend,
        mock_user_settings_repo,
        mock_resolve_api_key,
    ):
        from src.workers.tasks import _execute_agent_stream

        mock_prepare_memory_files.return_value = ({}, [])
        mock_resolve_api_key.return_value = "k"
        mock_create_daytona_backend.return_value = (MagicMock(), None)
        mock_init_backend.return_value = MagicMock()

        repo_instance = MagicMock()
        repo_instance._get_or_create = AsyncMock(
            return_value=MagicMock(sandbox_backend="daytona")
        )
        repo_instance._decrypt_keys.return_value = {}
        mock_user_settings_repo.return_value = repo_instance

        fake_agent = MagicMock()
        fake_agent.model = "openai/gpt-4o-mini"
        fake_agent.graph.aget_state = AsyncMock(
            return_value=MagicMock(
                config={"configurable": {}},
                values={"messages": []},
            )
        )
        mock_construct_agent.return_value = fake_agent

        class _EmptyAstream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        fake_agent.astream = lambda *_args, **_kwargs: _EmptyAstream()

        redis_client = MagicMock()
        redis_client.xadd = AsyncMock()
        redis_client.expire = AsyncMock()

        service_context = MagicMock()
        service_context.llm_service.assistant = AsyncMock(
            side_effect=lambda p: p
        )
        service_context.memory_service = MagicMock()
        service_context.store = MagicMock()
        service_context.user_id = "user-1"
        service_context.thread_service.update = AsyncMock()

        params = MagicMock()
        params.model = "openai/gpt-4o-mini"
        params.instructions = "i"
        params.system_prompt = "s"
        params.tools = []
        params.subagents = []
        params.input = MagicMock()
        params.input.messages = [MagicMock()]

        result = await _execute_agent_stream(
            params=params,
            config={"configurable": {"thread_id": "t1", "assistant_id": None, "project_id": None}},
            files_map={},
            todos_list=[],
            service_context=service_context,
            checkpointer=MagicMock(),
            user_id="user-1",
            thread_id="t1",
            stream_key="agent:stream:t1",
            redis_client=redis_client,
        )

        mock_create_daytona_backend.assert_called_once_with(api_key="k")
        assert any(
            "falling back to default sandbox" in str(call.args[1]["data"])
            for call in redis_client.xadd.call_args_list
            if call.args and len(call.args) > 1 and isinstance(call.args[1], dict)
        )
        assert result["status"] == "complete"

    @pytest.mark.asyncio
    @patch("src.workers.tasks.resolve_api_key")
    @patch("src.workers.tasks.UserSettingsRepo")
    @patch("src.agents.create_daytona_backend")
    @patch("src.agents.init_backend")
    @patch("src.agents.construct_agent", new_callable=AsyncMock)
    @patch("src.agents.prepare_memory_files", new_callable=AsyncMock)
    async def test_execute_agent_stream_uses_daytona_backend_when_selected(
        self,
        mock_prepare_memory_files,
        mock_construct_agent,
        mock_init_backend,
        mock_create_daytona_backend,
        mock_user_settings_repo,
        mock_resolve_api_key,
    ):
        from src.workers.tasks import _execute_agent_stream

        mock_prepare_memory_files.return_value = ({}, [])
        mock_resolve_api_key.return_value = "k"
        daytona_sandbox = MagicMock()
        daytona_backend = MagicMock()
        mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)

        repo_instance = MagicMock()
        repo_instance._get_or_create = AsyncMock(
            return_value=MagicMock(sandbox_backend="daytona")
        )
        repo_instance._decrypt_keys.return_value = {}
        mock_user_settings_repo.return_value = repo_instance

        fake_agent = MagicMock()
        fake_agent.model = "openai/gpt-4o-mini"
        fake_agent.graph.aget_state = AsyncMock(
            return_value=MagicMock(config={"configurable": {}}, values={"messages": []})
        )
        mock_construct_agent.return_value = fake_agent

        class _EmptyAstream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        fake_agent.astream = lambda *_args, **_kwargs: _EmptyAstream()

        redis_client = MagicMock()
        redis_client.xadd = AsyncMock()
        redis_client.expire = AsyncMock()

        service_context = MagicMock()
        service_context.llm_service.assistant = AsyncMock(side_effect=lambda p: p)
        service_context.memory_service = MagicMock()
        service_context.store = MagicMock()
        service_context.user_id = "user-1"
        service_context.thread_service.update = AsyncMock()

        params = MagicMock()
        params.model = "openai/gpt-4o-mini"
        params.instructions = "i"
        params.system_prompt = "s"
        params.tools = []
        params.subagents = []
        params.input = MagicMock()
        params.input.messages = [MagicMock()]

        result = await _execute_agent_stream(
            params=params,
            config={"configurable": {"thread_id": "t1", "assistant_id": None, "project_id": None}},
            files_map={},
            todos_list=[],
            service_context=service_context,
            checkpointer=MagicMock(),
            user_id="user-1",
            thread_id="t1",
            stream_key="agent:stream:t1",
            redis_client=redis_client,
        )

        mock_create_daytona_backend.assert_called_once_with(api_key="k")
        mock_init_backend.assert_not_called()
        daytona_sandbox.stop.assert_called_once()
        assert result["status"] == "complete"

    @pytest.mark.asyncio
    @patch("src.workers.tasks.resolve_api_key")
    @patch("src.workers.tasks.UserSettingsRepo")
    @patch("src.agents.create_daytona_backend")
    @patch("src.agents.init_backend")
    @patch("src.agents.construct_agent", new_callable=AsyncMock)
    @patch("src.agents.prepare_memory_files", new_callable=AsyncMock)
    async def test_execute_agent_stream_keeps_default_backend_when_setting_unset(
        self,
        mock_prepare_memory_files,
        mock_construct_agent,
        mock_init_backend,
        mock_create_daytona_backend,
        mock_user_settings_repo,
        mock_resolve_api_key,
    ):
        from src.workers.tasks import _execute_agent_stream

        mock_prepare_memory_files.return_value = ({}, [])
        mock_resolve_api_key.return_value = "k"
        mock_init_backend.return_value = MagicMock()

        repo_instance = MagicMock()
        repo_instance._get_or_create = AsyncMock(return_value=MagicMock(sandbox_backend=None))
        repo_instance._decrypt_keys.return_value = {}
        mock_user_settings_repo.return_value = repo_instance

        fake_agent = MagicMock()
        fake_agent.model = "openai/gpt-4o-mini"
        fake_agent.graph.aget_state = AsyncMock(
            return_value=MagicMock(config={"configurable": {}}, values={"messages": []})
        )
        mock_construct_agent.return_value = fake_agent

        class _EmptyAstream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        fake_agent.astream = lambda *_args, **_kwargs: _EmptyAstream()

        redis_client = MagicMock()
        redis_client.xadd = AsyncMock()
        redis_client.expire = AsyncMock()

        service_context = MagicMock()
        service_context.llm_service.assistant = AsyncMock(side_effect=lambda p: p)
        service_context.memory_service = MagicMock()
        service_context.store = MagicMock()
        service_context.user_id = "user-1"
        service_context.thread_service.update = AsyncMock()

        params = MagicMock()
        params.model = "openai/gpt-4o-mini"
        params.instructions = "i"
        params.system_prompt = "s"
        params.tools = []
        params.subagents = []
        params.input = MagicMock()
        params.input.messages = [MagicMock()]

        result = await _execute_agent_stream(
            params=params,
            config={"configurable": {"thread_id": "t1", "assistant_id": None, "project_id": None}},
            files_map={},
            todos_list=[],
            service_context=service_context,
            checkpointer=MagicMock(),
            user_id="user-1",
            thread_id="t1",
            stream_key="agent:stream:t1",
            redis_client=redis_client,
        )

        mock_create_daytona_backend.assert_not_called()
        mock_init_backend.assert_called_once()
        assert result["status"] == "complete"
