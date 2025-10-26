from typing import List, Optional, Literal
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from src.constants.llm import ChatModels
from langmem.prompts.types import AnnotatedTrajectory, Prompt, OptimizerInput
from src.services.prompt.optimize import PromptOptimizer

class Feedback(BaseModel):
    revised: Optional[str] = Field(default=None, description="The revised feedback to use for optimization")
    comment: Optional[str] = Field(default=None, description="The comment to use for optimization")
    score: Optional[float] = Field(default=None, description="The score to use for optimization")

class Trajectory(BaseModel):
    messages: List[dict] = Field(..., description="The messages to use for optimization")
    feedback: Optional[Feedback] = Field(default=None, description="The feedback to use for optimization")

class PromptOptimizerToolInput(BaseModel):
    prompt: Prompt = Field(..., description="The prompt to optimize")
    trajectories: List[Trajectory] | str = Field(..., description="The trajectories to use for optimization")
    kind: Literal["prompt_memory", "gradient", "metaprompt"] = Field(default="prompt_memory", description="The kind of optimizer to use")
    config: Optional[dict] = Field(default={"min_reflection_steps": 2, "max_reflection_steps": 3}, description="The config to use for optimization")
    model: Optional[ChatModels] = Field(default=ChatModels.OPENAI_GPT_5_NANO, description="The model to use for optimization")


@tool(args_schema=PromptOptimizerToolInput)
async def prompt_optimize(
    prompt: Prompt,
    trajectories: List[Trajectory] | str,
    kind: Literal["prompt_memory", "gradient", "metaprompt"] = "prompt_memory",
    config: dict = {"min_reflection_steps": 2, "max_reflection_steps": 3},
    model: Optional[ChatModels] = Field(default=ChatModels.OPENAI_GPT_5_NANO, description="The model to use for optimization")
) -> str:
    """
    Optimize a given prompt using the LangMem prompt optimizer.

    Args:
        prompt: The prompt to optimize
        trajectories: The trajectories to use for optimization
        model: The model to use for optimization
    """
    optimizer = PromptOptimizer(model)
    trajectories = [AnnotatedTrajectory(**trajectory.model_dump()) for trajectory in trajectories]
    optimizer_input = OptimizerInput(
        prompt=prompt,
        trajectories=trajectories,
    )
    result = await optimizer.optimize(optimizer_input, kind, config)
    return result


PROMPT_TOOLS = [prompt_optimize]
