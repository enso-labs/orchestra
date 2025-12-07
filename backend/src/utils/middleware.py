
from langchain.agents import AgentState
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage
from langgraph.runtime import Runtime
from src.constants.llm import ChatModels
from src.schemas.contexts import ContextSchema
from langchain.agents.middleware import (
    PIIMiddleware,
    wrap_model_call,
    ModelRequest,
    ModelResponse,
    after_model,
)

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
    ]


@wrap_model_call
async def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    """Smart routing based on query complexity and conversation depth."""
    messages = request.state["messages"]
    last_message = format_content(messages[-1].content)

    message_count = len(messages)

    # Define keywords for reasoning-heavy tasks
    complex_keywords = [
        "explain", "compare", "analyze", "summarize",
        "derive", "why", "how", "design", "calculate",
        "build", "create", "develop", "implement", "code",
    ]

    # Rule 1 — Long conversation → advanced model
    if message_count > 20:
        model = ChatModels.OPENAI_GPT_5_NANO.value
        reason = "long conversation context"
    
    # Rule 2 — Complex query → advanced model
    elif any(word in last_message for word in complex_keywords):
        model = ChatModels.XAI_GROK_4_1_FAST.value
        reason = "complex reasoning or analysis query"

    # Default — simple question → basic model
    else:
        model = ChatModels.XAI_GROK_4_1_FAST.value
        reason = "simple query"

    print(f"[Middleware] Using {model} due to {reason}(messages={message_count})")

    request.model = init_chat_model(model)
    return await handler(request)