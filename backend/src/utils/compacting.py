# Compacting Middleware for Orchestra
#
# US-001 Finding: deepagents==0.3.8 does NOT ship internal SummarizationMiddleware.
# Verified by inspecting deepagents source - no summarization/compaction/middleware
# references found in the package. create_deep_agent() has no compaction parameters.
#
# Decision: Proceed with Phase 2B (full Orchestra implementation).

from abc import ABC, abstractmethod

from langchain_core.messages import BaseMessage, SystemMessage

from src.constants.llm import (
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
