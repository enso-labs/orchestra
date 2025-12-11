from pydantic import BaseModel, Field, field_validator
from langchain_core.tools import tool


#########################################################################################################
## REASONING TOOL
## Implements Chain of Draft: https://arxiv.org/html/2502.18600v1
#########################################################################################################
MAX_WORDS = 10
DESCRIPTION = f"""Draft a minimalistic (≤{MAX_WORDS} words) reflection on your reasoning process.
Capture only essential insights and critical information. Use shorthand and omit verbose explanations.
This tool allows you to think faster by writing less, capturing the core of your thought process.

Should instruct agent to write thoughts to think_tool.md and use mermaid diagrams to illustrate your thoughts.
"""

EXAMPLES = [
    "Scrape links for context and summarize main findings efficiently.",
    "Check if sources need scraping before starting additional research.",
    "Scrape multiple URLs for data collection, compare similarities.",
    "Web scraping might add critical details missing in docs.",
    "Extract important sections via targeted Web Scrape process.",
    "Search web for detailed topic info, prioritize trustworthy sources.",
    "Write search results to file, then analyze and compare.",
]


class ReasoningArgs(BaseModel):
    reflection: str = Field(
        ...,
        description=(
            f"ABSOLUTELY MUST be a concise draft—STRICTLY no more than {MAX_WORDS} words! Count every word. "
            "Exceeding the word limit is not allowed and will cause failure. Only key reasoning—no fluff. "
        ),
        examples=EXAMPLES,
    )

    # @field_validator("reflection")
    # def must_be_short_enough(cls, v):
    #     if len(v.split()) > MAX_WORDS:
    #         raise ValueError(f"Reflection must be {MAX_WORDS} words or fewer.")
    #     return v


@tool(description=DESCRIPTION, args_schema=ReasoningArgs)
def think_tool(reflection: str) -> str:
    return reflection
