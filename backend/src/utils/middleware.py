from langchain.agents.middleware import after_model
from langchain.agents import AgentState
from langchain_core.messages import AIMessage
from langgraph.runtime import Runtime
from src.schemas.contexts import ContextSchema
from langchain.agents.middleware import PIIMiddleware


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
