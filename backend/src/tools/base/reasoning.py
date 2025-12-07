from pydantic import BaseModel, Field, field_validator
from langchain_core.tools import tool


#########################################################################################################
## REASONING TOOL
## https://github.com/langchain-ai/deepagents-quickstarts/blob/main/deep_research/research_agent/tools.py
#########################################################################################################
MAX_WORDS = 20
DESCRIPTION = f"""
Title: Reasoning
Toolkit: Search
Description: Provide a concise (≤{MAX_WORDS} words) reflection on your research step.

You may use this tool multiple times to iteratively reflect
after each search or research action. Keep each reflection short—
no more than {MAX_WORDS} words.
"""

EXAMPLES = [
    "Need to use the Web Scrape tool to get more context from links.",
    "Check if web sources require scraping for full content.",
    "Need to scrape more data from multiple URLs.",
    "Results suggest web scraping could add details.",
    "Try Web Scrape to extract specific sections from pages.",
    "Use Web Search to find more information on the topic.",
    "I should Write a file with results from the web search.",
]


class ReasoningArgs(BaseModel):
    reflection: str = Field(
        ...,
        description=(
            f"The reflection to think about, less than {MAX_WORDS} words. "
            f"Examples: {', '.join(EXAMPLES)}"
        ),
        # examples=EXAMPLES,
    )

    @field_validator("reflection")
    def must_be_short_enough(cls, v):
        if len(v.split()) > MAX_WORDS:
            raise ValueError(f"Reflection must be {MAX_WORDS} words or fewer.")
        return v


@tool(description=DESCRIPTION, args_schema=ReasoningArgs)
def think_tool(reflection: str) -> str:
    return reflection
