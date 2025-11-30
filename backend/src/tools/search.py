import re
from typing import Literal, List, Optional
from pydantic import BaseModel, Field
from markitdown import MarkItDown
from langchain_core.tools import tool
from langchain_core.tools import ToolException
from langchain_community.utilities import SearxSearchWrapper
from src.utils.logger import logger


Categories = Literal[
    "general",
    "images",
    "videos",
    "news",
    "map",
    "music",
    "it",
    "science",
    "files",
    "social media",
]
Engines = Literal[
    "duckduckgo",
    "google",
    "bing",
    "github",
    "wikipedia",
    "reuters",
    "arxiv",
    "adobe_stock",
]


@tool
async def web_search(
    query: str,
    num_results: Optional[int] = 5,
    # engines: Optional[List[Engines]] = ["google"],
    # categories: Optional[List[Categories]] = [],
    # language: Optional[str] = "en",
) -> list:
    """
    Title: Web Search
    Description: Perform a targeted web search for the provided query.
        - Always refine the query with the most relevant keywords.
        - Be specific with dates (e.g., "September 7, 2025" instead of "recent" or "today").
        - Use exact timeframes when searching for current or time-sensitive events.
        - Think critically before searching to ensure accuracy and relevance.

    Example Queries:
        - site:<domain> latest news about <topic> September 7, 2025
        - <company> earnings report Q2 2025
        - election results Nevada November 2024

    Args:
        query (str): The search query string.
        num_results (int, optional): Number of results to return. Default is 5.
        engines (list, optional): List of search engines to use. Default is None.
        categories (list, optional): List of search categories to use. Default is None.
        language (str, optional): Search language. Default is None.

    Returns:
    list: A list of search results.
    """
    from src.constants import SEARX_SEARCH_HOST_URL

    # Check if SEARX_SEARCH_HOST_URL is provided.
    if not SEARX_SEARCH_HOST_URL:
        raise ToolException("No SEARX_SEARCH_HOST_URL provided")

    # Create a SearxSearchWrapper instance.
    searx = SearxSearchWrapper(searx_host=SEARX_SEARCH_HOST_URL)

    logger.info(f"Searching for {query} with {num_results} results")

    try:
        results = await searx.aresults(
            query=query,
            num_results=num_results,
            # engines=engines,
            # categories=categories,
            # language=language,
        )
        logger.info(f"Found {len(results)} results")
        return results
    except Exception as e:
        logger.error(f"Error searching for {query}: {e}")
        raise ToolException(f"Error searching for {query}: {e}")


@tool
def web_scrape(urls: List[str]) -> str:
    """Retrieve content from a list of URLs or Paths"""
    md = MarkItDown(enable_plugins=False)
    docs = []
    for url in urls:
        logger.info(f"Scraping {url} START")
        try:
            document = md.convert(url)
            logger.info(f"Scraped {url}, DONE")
        except Exception as e:
            logger.warning(f"Error scraping {url}: {e}")
            continue
        if document.title:
            formatted_output = f"# {document.title}\n\n{document.markdown}"
        else:
            formatted_output = document.markdown
        docs.append(formatted_output)
    return "\n\n---\n\n".join(docs)

#########################################################################################################
## THINK TOOL
## https://github.com/langchain-ai/deepagents-quickstarts/blob/main/deep_research/research_agent/tools.py
#########################################################################################################
@tool(parse_docstring=True)
def think_tool(reflection: str) -> str:
    """
    Provide a concise (≤20 words) reflection on your research step.

    You may use this tool multiple times to iteratively reflect
    after each search or research action. Keep each reflection short—
    no more than 20 words.

    Args:
        reflection: Concise summary (max 20 words) of your thought.

    Returns:
        Confirmation message with recorded reflection.
    """
    if len(reflection.split()) > 20:
        return "Error: Reflection must be 20 words or fewer"
    return reflection

class MathCalculatorInput(BaseModel):
    expression: str = Field(
        description="Mathematical expression to evaluate (e.g., '2 + 3 * 4', '(10 - 5) / 2')"
    )


@tool(args_schema=MathCalculatorInput)
def math_calculator(expression: str) -> str:
    """
    Calculate mathematical expressions including addition, subtraction, multiplication, division, and parentheses.
    """
    try:
        # Safe evaluation of basic math expressions
        # Only allow numbers, operators, parentheses, and basic math functions
        sanitized = re.sub(r"[^0-9+\-*/().\s]", "", expression)

        # Basic validation
        if not sanitized or sanitized.strip() == "":
            return "Error: Invalid math expression"

        # Use eval with restricted scope for safe evaluation
        result = eval(sanitized, {"__builtins__": {}}, {})

        if not isinstance(result, (int, float)) or not (
            isinstance(result, int) or isinstance(result, float)
        ):
            return "Error: Result is not a valid number"

        if (
            not (result == result) or result == float("inf") or result == -float("inf")
        ):  # Check for NaN or inf
            return "Error: Result is not a valid number"

        return f"{expression} = {result}"
    except Exception:
        return f"Error: Invalid math expression - {expression}"


SEARCH_TOOLS = [
    web_search, 
    web_scrape, 
    math_calculator, 
    think_tool,
]
