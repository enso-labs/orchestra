"""
Prompt Optimizer Service
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from langchain_core.runnables import Runnable
from langmem.prompts.types import (
    AnnotatedTrajectory,
    MultiPromptOptimizerInput,
    OptimizerInput,
)
from langmem import Prompt, create_prompt_optimizer, create_multi_prompt_optimizer

from src.constants.llm import ChatModels


DEFAULT_TRAJECTORIES = [
    AnnotatedTrajectory(
        messages=[
            {"role": "user", "content": "Tell me about Mars"},
            {"role": "assistant", "content": "Mars is the fourth planet..."},
            {"role": "user", "content": "I wanted more about its moons"},
        ]
    )._asdict(),
    AnnotatedTrajectory(
        messages=[
            {"role": "user", "content": "What are Mars' moons?"},
            {
                "role": "assistant",
                "content": "Mars has two moons: Phobos and Deimos...",
            },
        ],
        feedback={
            "comment": "Should include more details and recommended follow-up questions.",
            "score": 0.9,
        },
    )._asdict(),
    AnnotatedTrajectory(
        messages=[
            {"role": "user", "content": "Compare Mars and Earth"},
            {"role": "assistant", "content": "Mars and Earth have many differences..."},
        ],
        feedback={
            "revised": "Earth and Mars have many similarities and differences..."
        },
    )._asdict(),
]

DEFAULT_PROMPTS = [
    "You are a planetary science expert.",
    Prompt(
        name="planetary_science_expert",
        prompt="You are a planetary science expert.",
        update_instructions=(
            "Detail any moons of the planet the user asks about, "
            "provide a list of the moons and their properties."
        ),
    ),
]


class PromptOptimizerRequest(BaseModel):
    trajectories: List[dict] = Field(default=DEFAULT_TRAJECTORIES)
    prompt: str | Prompt = Field(default=DEFAULT_PROMPTS[1])
    model: ChatModels = Field(default=ChatModels.OPENAI_GPT_5_NANO)
    kind: Optional[str] = Field(default="gradient")
    config: Optional[dict] = Field(
        default={"min_reflection_steps": 1, "max_reflection_steps": 3}
    )


class PromptOptimizer:
    def __init__(self, model: ChatModels):
        self.model = model

    async def optimize(
        self,
        optimizer_input: OptimizerInput,
        kind: str = "prompt_memory",
        config: dict = {"min_reflection_steps": 2, "max_reflection_steps": 3},
    ) -> Any:
        optimizer: Runnable = create_prompt_optimizer(
            self.model, kind=kind, config=config
        )
        optimized = await optimizer.ainvoke(optimizer_input)
        return optimized

    async def optimize_batch(
        self,
        optimizer_input: MultiPromptOptimizerInput,
        kind: str = "gradient",
        config: dict = {"min_reflection_steps": 2, "max_reflection_steps": 3},
    ) -> Any:
        optimizer: Runnable = create_multi_prompt_optimizer(
            self.model, kind=kind, config=config
        )
        optimized = await optimizer.ainvoke(optimizer_input)
        return optimized
