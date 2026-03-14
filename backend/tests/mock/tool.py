from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from langchain_core.messages import AIMessage, ToolCall
from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig
from src.services.db import get_store_in_memory


class FakeStreamWriter:
    def __init__(self):
        self.buffer: list[str] = []

    def write(self, chunk: str) -> None:
        self.buffer.append(chunk)


@dataclass
class MockToolVars:
    TOOL_CALL_ID = "tc_test_id"
    TEST_TOOL_NAME = "TEST_webhook_marketing_channel"
    BASE_TOOL = "send_webhook_to_channel"


MOCK_MESSAGES = [
    AIMessage(
        content="",
        tool_calls=[
            ToolCall(
                name=MockToolVars.TEST_TOOL_NAME,
                args={"test_arg": "test_value"},
                id=MockToolVars.TOOL_CALL_ID,
                type="tool_call",
            )
        ],
    )
]


@dataclass
class TestToolRuntime:
    state: Dict[str, Any] = field(default_factory=lambda: {"messages": MOCK_MESSAGES})
    context: Dict[str, Any] = field(default=None)
    config: RunnableConfig = field(
        default_factory=lambda: RunnableConfig(
            metadata={MockToolVars.TEST_TOOL_NAME: {"env": {"TEST_WEBHOOK_URL": "https://example.com/webhook"}}}
        )
    )
    stream_writer: FakeStreamWriter = field(default_factory=FakeStreamWriter)
    tool_call_id: Optional[str] = MockToolVars.TOOL_CALL_ID
    store: BaseStore = field(default=get_store_in_memory())


def fake_tool_runtime(**overrides) -> TestToolRuntime:
    rt = TestToolRuntime()
    for k, v in overrides.items():
        setattr(rt, k, v)
    return rt
