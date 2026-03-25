"""Planner pre-execution phase — expands short prompts into structured product specs."""

from pathlib import Path

from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

from src.schemas.entities.planner import PlannerConfig
from src.utils.llm import resolve_api_key
from src.utils.logger import logger

# Load the planner system prompt
_PLANNER_PROMPT_PATH = Path(__file__).parent.parent / "static" / "prompts" / "md" / "planner.md"
_PLANNER_PROMPT = ""
if _PLANNER_PROMPT_PATH.exists():
    _PLANNER_PROMPT = _PLANNER_PROMPT_PATH.read_text()


async def run_planner(
    user_message: str,
    planner_config: PlannerConfig,
    default_model: str,
    api_key: str | None = None,
    user_keys: dict[str, str] | None = None,
) -> str:
    """Run the planner to expand a short prompt into a structured spec.

    Returns the plan as markdown text.
    """
    model_name = planner_config.model or default_model

    # Resolve API key for the planner model
    planner_api_key = api_key
    if planner_config.model:
        resolved = resolve_api_key(planner_config.model, user_keys)
        if resolved:
            planner_api_key = resolved

    llm = init_chat_model(model_name, api_key=planner_api_key)

    scope_instruction = ""
    if planner_config.scope_level == "conservative":
        scope_instruction = (
            "\n\nIMPORTANT: Keep the scope conservative. "
            "Only include features explicitly requested by the user. Do not add extras."
        )
    else:
        scope_instruction = (
            "\n\nBe ambitious about scope. Include features that would make this product impressive, "
            "even if the user didn't explicitly request them."
        )

    system_prompt = _PLANNER_PROMPT + scope_instruction

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Please create a product plan for the following request:\n\n{user_message}"),
    ]

    logger.info(f"planner_phase model={model_name} scope={planner_config.scope_level}")

    response = await llm.ainvoke(messages)
    plan_text = response.content if isinstance(response.content, str) else str(response.content)

    logger.info(f"planner_phase_complete plan_length={len(plan_text)}")

    return plan_text
