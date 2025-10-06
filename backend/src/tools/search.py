from typing import Literal, List, Optional
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
    engines: Optional[List[Engines]] = ["google"],
    categories: Optional[List[Categories]] = [],
    language: Optional[str] = "en",
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

    logger.info(
        f"Searching for {query} with {engines} engines and {categories} categories and {language} language"
    )

    try:
        results = await searx.aresults(
            query=query,
            num_results=num_results,
            engines=engines,
            categories=categories,
            language=language,
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


SEARCH_TOOLS = [web_search, web_scrape]
