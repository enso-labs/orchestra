"""
Prompt Optimizer Service
"""

from langchain_core.runnables import Runnable
from langmem.prompts.types import MultiPromptOptimizerInput 
from langmem import create_multi_prompt_optimizer
from typing import Any

from src.constants.llm import ChatModels


class PromptOptimizer:
    def __init__(self, model: ChatModels):
        self.model = model

    async def optimize(
        self,
        optimizer_input: MultiPromptOptimizerInput,
        kind: str = "gradient",
        config: dict = {"min_reflection_steps": 1, "max_reflection_steps": 3},
    ) -> Any:
        optimizer: Runnable = create_multi_prompt_optimizer(
            self.model,
            kind=kind,
            config=config,
        )
        return await optimizer.ainvoke(optimizer_input)
