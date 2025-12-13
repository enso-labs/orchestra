"""Async test example module."""

import unittest

from langmem.prompts.types import AnnotatedTrajectory, MultiPromptOptimizerInput, Prompt
from src.services.prompt.optimize import PromptOptimizer
from src.constants.llm import ChatModels, DefaultModels


prompts = [
    Prompt(
        name="research",
        prompt=(
            "You are a senior research analyst. Find credible sources, extract key facts, "
            "and capture citations (title, publisher, date). Return bullet points only."
        ),
        update_instructions=(
            "Prefer primary sources; flag weak evidence; avoid speculation; include URLs."
        ),
    ),
    Prompt(
        name="synthesize",
        prompt=(
            "Synthesize the research into a cohesive narrative. Compare at least two viewpoints, "
            "call out uncertainties, and note conflicting data."
        ),
        when_to_update="After 'research' is updated or when conflicting sources are detected.",
    ),
    Prompt(
        name="summarize",
        prompt=(
            "Produce a 5-paragraph executive summary: Background, Data, Analysis, Implications, "
            "Next Steps. Include 2–3 inline citations."
        ),
    ),
]

trajectories = [
    AnnotatedTrajectory(
        messages=[
            {
                "role": "user",
                "content": "Summarize the economic impact of AI on power grids.",
            },
            {
                "role": "assistant",
                "content": "AI is growing. It will need more electricity...",
            },
            {"role": "user", "content": "Where are the sources and numbers?"},
        ],
        feedback={
            "developer_feedback": "Missing citations and quantitative data in research step.",
            "score": 0.4,
        },
    ),
    AnnotatedTrajectory(
        messages=[
            {
                "role": "user",
                "content": "Compare Bloomberg vs. IEA on data center demand growth.",
            },
            {"role": "assistant", "content": "They both say demand is increasing."},
        ],
        feedback="Synthesis lacked point-by-point comparison and uncertainty discussion.",
    ),
    AnnotatedTrajectory(
        messages=[
            {
                "role": "user",
                "content": "Give me an exec summary with actions I can take this quarter.",
            },
            {
                "role": "assistant",
                "content": "Here is a long essay without headings...",
            },
        ],
        feedback="Summary needs the 5-section structure and clear next steps; too verbose.",
    ),
]


class TestPromptOptimizeCases(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.optimizer = PromptOptimizer(DefaultModels.DEFAULT.value)

    @unittest.skip("Skipping test_optimize")
    async def test_optimize(self):
        optimizer_input = MultiPromptOptimizerInput(
            trajectories=trajectories,
            prompts=prompts,
        )
        result = await self.optimizer.optimize(optimizer_input)
        print(result)
