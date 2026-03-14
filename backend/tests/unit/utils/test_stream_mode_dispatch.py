"""Unit tests for handle_multi_mode() and handle_updates_mode() dispatch."""

from src.utils.stream import handle_multi_mode, handle_updates_mode


# ---------------------------------------------------------------------------
# handle_updates_mode
# ---------------------------------------------------------------------------
class TestHandleUpdatesMode:
    def _msg(self, content: str = "hello") -> dict:
        return {"content": content, "type": "ai"}

    def test_agent_only(self):
        payload = {"agent": {"messages": [self._msg("a1")]}}
        result = handle_updates_mode(payload)
        assert "agent" in result
        assert result["agent"]["messages"] == [{"content": "a1", "type": "ai"}]

    def test_tools_only(self):
        payload = {"tools": {"messages": [self._msg("t1")]}}
        result = handle_updates_mode(payload)
        assert "tools" in result
        assert result["tools"]["messages"] == [{"content": "t1", "type": "ai"}]

    def test_both_agent_and_tools(self):
        payload = {
            "agent": {"messages": [self._msg("a")]},
            "tools": {"messages": [self._msg("t")]},
        }
        result = handle_updates_mode(payload)
        assert "agent" in result and "tools" in result
        assert result["agent"]["messages"][0]["content"] == "a"
        assert result["tools"]["messages"][0]["content"] == "t"

    def test_neither_agent_nor_tools(self):
        payload = {"summary": {"text": "done"}}
        result = handle_updates_mode(payload)
        assert result == {"summary": {"text": "done"}}

    def test_unknown_node_with_messages(self):
        payload = {"my_custom_node": {"messages": [self._msg("x")]}}
        result = handle_updates_mode(payload)
        assert result["my_custom_node"]["messages"] == [{"content": "x", "type": "ai"}]

    def test_unknown_node_without_messages(self):
        payload: dict = {"router": "next_step"}
        result = handle_updates_mode(payload)
        assert result == {"router": "next_step"}

    def test_empty_payload(self):
        result = handle_updates_mode({})
        assert result == {}

    def test_preserves_non_message_keys(self):
        payload = {"agent": {"messages": [self._msg()], "extra": 42}}
        result = handle_updates_mode(payload)
        assert result["agent"]["extra"] == 42


# ---------------------------------------------------------------------------
# handle_multi_mode — updates, tasks, debug, custom, unrecognized
# ---------------------------------------------------------------------------
class TestHandleMultiModeUpdates:
    def test_updates_tuple(self):
        payload = {"agent": {"messages": [{"content": "hi", "type": "ai"}]}}
        chunk = ("updates", payload)
        result = handle_multi_mode(chunk)
        assert result is not None
        mode, data = result  # type: ignore[misc]
        assert mode == "updates"
        assert "agent" in data

    def test_updates_empty_payload(self):
        chunk = ("updates", {})
        result = handle_multi_mode(chunk)
        assert result is not None
        assert result == ("updates", {})


class TestHandleMultiModeTasks:
    def test_tasks_with_input(self):
        payload = {"input": {"messages": [{"content": "task input", "type": "human"}]}}
        chunk = ("tasks", payload)
        result = handle_multi_mode(chunk)
        assert result is not None
        mode, data = result  # type: ignore[misc]
        assert mode == "tasks"
        assert data["input"]["messages"][0]["content"] == "task input"

    def test_tasks_with_result(self):
        payload = {"result": [["node_a", [{"content": "result msg", "type": "ai"}]]]}
        chunk = ("tasks", payload)
        result = handle_multi_mode(chunk)
        assert result is not None
        mode, data = result  # type: ignore[misc]
        assert mode == "tasks"
        assert data["result"][0][1][0]["content"] == "result msg"


class TestHandleMultiModeDebug:
    def test_debug_with_input_messages(self):
        payload = {"payload": {"input": {"messages": [{"content": "dbg", "type": "human"}]}}}
        chunk = ("debug", payload)
        result = handle_multi_mode(chunk)
        assert result is not None
        mode, _ = result  # type: ignore[misc]
        assert mode == "debug"

    def test_debug_with_result(self):
        payload = {"payload": {"result": [["node", [{"content": "r", "type": "ai"}]]]}}
        chunk = ("debug", payload)
        result = handle_multi_mode(chunk)
        assert result is not None
        mode, _ = result  # type: ignore[misc]
        assert mode == "debug"


class TestHandleMultiModeCustom:
    def test_custom_passthrough(self):
        chunk = ("custom", {"arbitrary": "data"})
        result = handle_multi_mode(chunk)
        assert result == chunk


class TestHandleMultiModeUnrecognized:
    def test_unrecognized_mode_returns_none(self):
        chunk = ("nonexistent_mode", {"data": 1})
        result = handle_multi_mode(chunk)
        assert result is None
