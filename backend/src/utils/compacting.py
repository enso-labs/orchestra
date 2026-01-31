# Compacting Middleware for Orchestra
#
# US-001 Finding: deepagents==0.3.8 does NOT ship internal SummarizationMiddleware.
# Verified by inspecting deepagents source - no summarization/compaction/middleware
# references found in the package. create_deep_agent() has no compaction parameters.
#
# Decision: Proceed with Phase 2B (full Orchestra implementation).

from abc import ABC, abstractmethod
from typing import Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.chat_models import init_chat_model
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from src.constants.llm import (
    DEFAULT_COMPACTION_MODEL,
    DEFAULT_COMPACTION_RECENT_MESSAGES,
    DEFAULT_COMPACTION_TOKEN_THRESHOLD,
)


class CompactingMiddleware(ABC):
    """Abstract base class for context compaction middleware.

    Subclasses must implement the `compact` method to define
    a specific compaction strategy (e.g., summarization, truncation).
    """

    def __init__(
        self,
        token_threshold: int = DEFAULT_COMPACTION_TOKEN_THRESHOLD,
        recent_messages: int = DEFAULT_COMPACTION_RECENT_MESSAGES,
    ) -> None:
        self.token_threshold = token_threshold
        self.recent_messages = recent_messages

    @abstractmethod
    async def compact(self, messages: list[BaseMessage]) -> list[BaseMessage]:
        """Compact a list of messages, returning a shorter list.

        Args:
            messages: The full message history.

        Returns:
            A compacted message list.
        """
        ...

    def estimate_tokens(self, messages: list[BaseMessage]) -> int:
        """Estimate token count using len(content) // 4 heuristic."""
        total = 0
        for msg in messages:
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            total += len(content) // 4
        return total

    def should_compact(self, messages: list[BaseMessage]) -> bool:
        """Return True if estimated tokens exceed the threshold."""
        return self.estimate_tokens(messages) >= self.token_threshold

    @staticmethod
    def is_system_message(msg: BaseMessage) -> bool:
        """Check if a message is a system prompt message."""
        return isinstance(msg, SystemMessage)

    def split_messages(
        self, messages: list[BaseMessage]
    ) -> tuple[list[BaseMessage], list[BaseMessage], list[BaseMessage]]:
        """Split messages into system prompts, compaction candidates, and recent messages.

        Args:
            messages: Full message history.

        Returns:
            Tuple of (system_messages, middle_messages, recent_messages).
        """
        system_msgs: list[BaseMessage] = []
        non_system_msgs: list[BaseMessage] = []

        for msg in messages:
            if self.is_system_message(msg):
                system_msgs.append(msg)
            else:
                non_system_msgs.append(msg)

        if len(non_system_msgs) <= self.recent_messages:
            return system_msgs, [], non_system_msgs

        middle = non_system_msgs[: -self.recent_messages]
        recent = non_system_msgs[-self.recent_messages :]
        return system_msgs, middle, recent


class SummarizationMiddleware(CompactingMiddleware):
    """Compaction middleware that summarizes older messages using an LLM.

    When the estimated token count exceeds the threshold, older messages
    (excluding system prompts and recent messages) are summarized into a
    single SystemMessage with a [CONVERSATION SUMMARY] prefix.
    """

    def __init__(
        self,
        token_threshold: int = DEFAULT_COMPACTION_TOKEN_THRESHOLD,
        recent_messages: int = DEFAULT_COMPACTION_RECENT_MESSAGES,
        model: str | None = DEFAULT_COMPACTION_MODEL,
    ) -> None:
        super().__init__(
            token_threshold=token_threshold, recent_messages=recent_messages
        )
        self.model = model

    async def compact(self, messages: list[BaseMessage]) -> list[BaseMessage]:
        """Summarize older messages when token count exceeds threshold.

        Returns the original messages unchanged if under threshold.
        """
        if not self.should_compact(messages):
            return messages

        system_msgs, middle_msgs, recent_msgs = self.split_messages(messages)

        if not middle_msgs:
            return messages

        # Build the conversation text for summarization
        conversation_text = "\n".join(
            f"{msg.type}: {msg.content if isinstance(msg.content, str) else str(msg.content)}"
            for msg in middle_msgs
        )

        llm = init_chat_model(self.model)
        summary_response = await llm.ainvoke(
            [
                SystemMessage(
                    content="You are a conversation summarizer. Provide a concise summary of the following conversation, preserving key facts, decisions, and context."
                ),
                HumanMessage(content=conversation_text),
            ]
        )

        summary_content = (
            summary_response.content
            if isinstance(summary_response.content, str)
            else str(summary_response.content)
        )

        summary_message = SystemMessage(
            content=f"[CONVERSATION SUMMARY] {summary_content}",
            metadata={"compacted": True, "original_count": len(middle_msgs)},
        )

        return system_msgs + [summary_message] + recent_msgs


# Singleton instance used by the decorator
_summarization_middleware = SummarizationMiddleware()


@wrap_model_call
async def compaction_middleware(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Apply SummarizationMiddleware to compact messages before model invocation."""
    messages = request.state.get("messages", [])
    compacted = await _summarization_middleware.compact(messages)
    request.state["messages"] = compacted
    return await handler(request)
