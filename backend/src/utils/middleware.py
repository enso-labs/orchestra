from typing import Awaitable, Callable
from deepagents.backends.utils import format_content_with_line_numbers, sanitize_tool_call_id
from deepagents.graph import AgentMiddleware, BackendProtocol
from deepagents.middleware.filesystem import TOO_LARGE_TOOL_MSG, TOOL_GENERATORS, FileData
from langchain.agents import AgentState
from langchain.chat_models import init_chat_model
from langchain.tools import ToolRuntime
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.runtime import Runtime
from langgraph.types import Command
from src.constants.llm import (
    DEFAULT_CHAT_MODEL,
    DEFAULT_CHAT_MODEL_BASIC,
    DEFAULT_CHAT_MODEL_ADVANCED,
)
from src.schemas.contexts import ContextSchema
from langchain.agents.middleware import (
    PIIMiddleware,
    wrap_model_call,
    ModelRequest,
    ModelResponse,
    after_model,
)
from src.utils.logger import logger
from src.utils.format import format_content


@after_model
def add_ai_message_metadata(
    state: AgentState, runtime: Runtime[ContextSchema]
) -> dict | None:
    """Attach AI message metadata to final response."""
    if state["messages"]:
        last_msg = state["messages"][-1]
        if isinstance(last_msg, AIMessage) and not last_msg.tool_calls:
            last_msg.model = runtime.context.model
    return None


def pii_middleware() -> dict | None:
    return [
        # Redact email addresses
        # PIIMiddleware(
        #     "email",
        #     strategy="redact",
        #     apply_to_input=True,
        # ),
        # Mask credit card numbers
        PIIMiddleware(
            "credit_card",
            strategy="mask",
            apply_to_input=True,
        ),
        # Block API keys - raise error if detected
        PIIMiddleware(
            "api_key",
            detector=r"sk-[A-Za-z0-9]+",
            strategy="block",
            apply_to_input=True,
        ),
        # PIIMiddleware(
        #     "api_key",
        #     detector=r"otk_[A-Za-z0-9]+",
        #     strategy="block",
        #     apply_to_input=True,
        # ),
    ]


@wrap_model_call
async def retry_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    for attempt in range(3):
        try:
            return await handler(request)
        except Exception as e:
            if attempt == 2:
                raise
            logger.warning(f"Retry {attempt + 1}/3 after error: {e}")


@wrap_model_call
async def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    """Smart routing based on query complexity and conversation depth."""
    messages = request.state["messages"]
    last_message = format_content(messages[-1].content)

    message_count = len(messages)

    # Define keywords for reasoning-heavy tasks
    complex_keywords = [
        "explain",
        "compare",
        "analyze",
        "summarize",
        "derive",
        "why",
        "how",
        "design",
        "calculate",
        "build",
        "create",
        "develop",
        "implement",
        "code",
    ]

    # Rule 1 — Long conversation → advanced model
    if message_count > 50:
        model = DEFAULT_CHAT_MODEL_BASIC
        reason = "long conversation context"

    # Rule 2 — Complex query → advanced model
    elif any(word in last_message for word in complex_keywords):
        model = DEFAULT_CHAT_MODEL_ADVANCED
        reason = "complex reasoning or analysis query"

    # Default — simple question → basic model
    else:
        model = DEFAULT_CHAT_MODEL
        reason = "simple query"

    logger.info(f"Using {model} due to {reason}(messages={message_count})")

    request.model = init_chat_model(model)
    return await handler(request)

class AutoEvictMiddleware(AgentMiddleware):
    def __init__(
        self, 
        backend, 
        tool_token_limit_before_evict: int = 10000, 
        evict_dir: str = "/large_tool_results"
    ):
        self.backend = backend
        self.evict_dir = evict_dir
        self.tool_token_limit_before_evict = tool_token_limit_before_evict
        
    def _get_backend(self, runtime: ToolRuntime) -> BackendProtocol:
        """Get the resolved backend instance from backend or factory.

        Args:
            runtime: The tool runtime context.

        Returns:
            Resolved backend instance.
        """
        if callable(self.backend):
            return self.backend(runtime)
        return self.backend
        
    def _process_large_message(
        self,
        message: ToolMessage,
        resolved_backend: BackendProtocol,
    ) -> tuple[ToolMessage, dict[str, FileData] | None]:
        content = message.content
        if not isinstance(content, str) or len(content) <= 4 * self.tool_token_limit_before_evict:
            return message, None

        sanitized_id = sanitize_tool_call_id(message.tool_call_id)
        file_path = f"/large_tool_results/{sanitized_id}"
        result = resolved_backend.write(file_path, content)
        if result.error:
            return message, None
        content_sample = format_content_with_line_numbers([line[:1000] for line in content.splitlines()[:10]], start_line=1)
        processed_message = ToolMessage(
            TOO_LARGE_TOOL_MSG.format(
                tool_call_id=message.tool_call_id,
                file_path=file_path,
                content_sample=content_sample,
            ),
            tool_call_id=message.tool_call_id,
        )
        return processed_message, result.files_update
        
    def _intercept_large_tool_result(self, tool_result: ToolMessage | Command, runtime: ToolRuntime) -> ToolMessage | Command:
        if isinstance(tool_result, ToolMessage) and isinstance(tool_result.content, str):
            if not (self.tool_token_limit_before_evict and len(tool_result.content) > 4 * self.tool_token_limit_before_evict):
                return tool_result
            resolved_backend = self._get_backend(runtime)
            processed_message, files_update = self._process_large_message(
                tool_result,
                resolved_backend,
            )
            return (
                Command(
                    update={
                        "files": files_update,
                        "messages": [processed_message],
                    }
                )
                if files_update is not None
                else processed_message
            )

        if isinstance(tool_result, Command):
            update = tool_result.update
            if update is None:
                return tool_result
            command_messages = update.get("messages", [])
            accumulated_file_updates = dict(update.get("files", {}))
            resolved_backend = self._get_backend(runtime)
            processed_messages = []
            for message in command_messages:
                if not (
                    self.tool_token_limit_before_evict
                    and isinstance(message, ToolMessage)
                    and isinstance(message.content, str)
                    and len(message.content) > 4 * self.tool_token_limit_before_evict
                ):
                    processed_messages.append(message)
                    continue
                processed_message, files_update = self._process_large_message(
                    message,
                    resolved_backend,
                )
                processed_messages.append(processed_message)
                if files_update is not None:
                    accumulated_file_updates.update(files_update)
            return Command(update={**update, "messages": processed_messages, "files": accumulated_file_updates})

        return tool_result

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        """(async)Check the size of the tool call result and evict to filesystem if too large.

        Args:
            request: The tool call request being processed.
            handler: The handler function to call with the modified request.

        Returns:
            The raw ToolMessage, or a pseudo tool message with the ToolResult in state.
        """
        if self.tool_token_limit_before_evict is None or request.tool_call["name"] in TOOL_GENERATORS:
            return await handler(request)

        tool_result = await handler(request)
        return self._intercept_large_tool_result(tool_result, request.runtime)


DEFAULT_MIDDLEWARE = [add_ai_message_metadata, retry_model] + pii_middleware()
