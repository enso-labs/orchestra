"""
Prompt Optimizer Service
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from langchain_core.runnables import Runnable
from langgraph.store.base import BaseStore
from langmem.prompts.types import (
    AnnotatedTrajectory,
    MultiPromptOptimizerInput,
    OptimizerInput,
)
from langmem import Prompt, create_prompt_optimizer, create_multi_prompt_optimizer

from src.constants.llm import DEFAULT_CHAT_MODEL, ChatModels
from src.utils.logger import logger


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
        feedback={"revised": "Earth and Mars have many similarities and differences..."},
    )._asdict(),
]

DEFAULT_PROMPTS = [
    "You are a planetary science expert.",
    Prompt(
        name="planetary_science_expert",
        prompt="You are a planetary science expert.",
        update_instructions=(
            "Detail any moons of the planet the user asks about, provide a list of the moons and their properties."
        ),
    ),
]


class PromptOptimizerRequest(BaseModel):
    trajectories: List[dict] = Field(default=DEFAULT_TRAJECTORIES)
    prompt: str | Prompt = Field(default=DEFAULT_PROMPTS[1])
    model: str = Field(default=DEFAULT_CHAT_MODEL)
    kind: Optional[str] = Field(default="gradient")
    config: Optional[dict] = Field(default={"min_reflection_steps": 1, "max_reflection_steps": 3})


class PromptOptimizer:
    def __init__(self, model: ChatModels):
        self.model = model

    async def optimize(
        self,
        optimizer_input: OptimizerInput,
        kind: str = "gradient",
        config: dict = {"min_reflection_steps": 2, "max_reflection_steps": 3},
    ) -> Any:
        optimizer: Runnable = create_prompt_optimizer(self.model, kind=kind, config=config)
        optimized = await optimizer.ainvoke(optimizer_input)
        return optimized

    async def optimize_batch(
        self,
        optimizer_input: MultiPromptOptimizerInput,
        kind: str = "gradient",
        config: dict = {"min_reflection_steps": 2, "max_reflection_steps": 3},
    ) -> Any:
        optimizer: Runnable = create_multi_prompt_optimizer(self.model, kind=kind, config=config)
        optimized = await optimizer.ainvoke(optimizer_input)
        return optimized

    async def distill(
        self,
        user_id: str,
        assistant_id: str,
        store: BaseStore,
    ) -> Optional[int]:
        """Distill accumulated trajectories into an improved prompt and auto-apply it.

        Retrieves recent trajectories from the store, runs the optimizer, stores the
        optimized prompt as a new revision via PromptService, and updates the assistant's
        system_prompt field.

        Args:
            user_id: Owner of the assistant and trajectories.
            assistant_id: Assistant whose prompt should be optimized.
            store: AsyncPostgresStore for reading trajectories and updating assistant.

        Returns:
            The new prompt revision version number, or None if no improvement was detected
            or no trajectories were available.
        """
        from src.services.assistant import AssistantService
        from src.services.prompt import Prompt as PromptModel, PromptService

        try:
            # 1. Retrieve recent trajectories
            trajectory_namespace = (user_id, "trajectories", assistant_id)
            items = await store.asearch(trajectory_namespace, limit=50)
            trajectories = [item.dict()["value"] for item in items]

            if not trajectories:
                logger.info(
                    "distill_skip_no_trajectories",
                    extra={"event": "distill_skip_no_trajectories", "user_id": user_id, "assistant_id": assistant_id},
                )
                return None

            # 2. Get current assistant and its prompt
            assistant_service = AssistantService(user_id=user_id, store=store)
            assistant = await assistant_service.get(assistant_id)
            if not assistant:
                logger.warning("distill_assistant_not_found: %s", assistant_id)
                return None

            current_prompt = assistant.system_prompt or assistant.instructions or ""
            if not current_prompt:
                logger.info(
                    "distill_skip_no_prompt",
                    extra={"event": "distill_skip_no_prompt", "assistant_id": assistant_id},
                )
                return None

            # 3. Run optimizer
            prompt_input = Prompt(name=assistant.name, prompt=current_prompt)
            optimizer_input = OptimizerInput(trajectories=trajectories, prompt=prompt_input)
            optimized = await self.optimize(optimizer_input)

            # 4. Extract the optimized prompt text
            if isinstance(optimized, dict):
                optimized_text = optimized.get("prompt", "")
            elif isinstance(optimized, str):
                optimized_text = optimized
            else:
                optimized_text = str(optimized)

            if not optimized_text or optimized_text.strip() == current_prompt.strip():
                logger.info(
                    "distill_no_improvement",
                    extra={"event": "distill_no_improvement", "assistant_id": assistant_id},
                )
                return None

            # 5. Store as new prompt revision
            prompt_service = PromptService(user_id=user_id, store=store)
            revisions = await prompt_service.list_revisions(assistant_id)
            latest_version = revisions[0].v if revisions else None

            revision_data = PromptModel(
                name=assistant.name,
                content=optimized_text,
                v=latest_version,
            )
            revision_id = await prompt_service.revision(assistant_id, revision_data)

            if not revision_id:
                logger.error("distill_revision_failed: %s", assistant_id)
                return None

            # 6. Update assistant's system_prompt
            assistant_data = assistant.model_dump()
            assistant_data["system_prompt"] = optimized_text
            assistant_data["instructions"] = None  # Ensure only one is set
            await assistant_service.update(assistant_id, assistant_data)

            logger.info(
                "distill_completed",
                extra={
                    "event": "distill_completed",
                    "user_id": user_id,
                    "assistant_id": assistant_id,
                    "revision_id": revision_id,
                    "trajectory_count": len(trajectories),
                },
            )
            return revision_id

        except Exception as e:
            logger.error(
                "distill_failed",
                extra={
                    "event": "distill_failed",
                    "user_id": user_id,
                    "assistant_id": assistant_id,
                    "error": str(e),
                },
            )
            return None
