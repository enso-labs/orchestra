import random
from typing import List, Optional
from langchain_core.tools import tool
from langgraph.types import interrupt
from src.constants import APP_ENV
from src.utils.logger import logger
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from src.constants.llm import ChatModels
from langmem.prompts.types import AnnotatedTrajectory, Prompt, OptimizerInput
from src.services.prompt.optimize import PromptOptimizer

class PromptOptimizerToolInput(BaseModel):
    prompt: Prompt = Field(..., description="The prompt to optimize")
    trajectories: List[AnnotatedTrajectory] = Field(..., description="The trajectories to use for optimization")
    model: Optional[ChatModels] = Field(default=ChatModels.OPENAI_GPT_5_NANO, description="The model to use for optimization")


@tool(args_schema=PromptOptimizerToolInput)
async def prompt_optimize(prompt: Prompt, trajectories: List[AnnotatedTrajectory], model: ChatModels) -> str:
    """
    Optimize a given prompt using the LangMem prompt optimizer.

    Args:
        prompt: The prompt to optimize
        trajectories: The trajectories to use for optimization
        model: The model to use for optimization
    """
    optimizer = PromptOptimizer(model)
    optimizer_input = OptimizerInput(
        prompt=prompt,
        trajectories=trajectories,
    )
    result = await optimizer.optimize(optimizer_input)
    return result


PROMPT_TOOLS = [prompt_optimize]
