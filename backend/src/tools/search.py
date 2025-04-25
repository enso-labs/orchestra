from langchain_core.tools import tool
from langchain_core.tools import ToolException
from langchain_community.utilities import SearxSearchWrapper

@tool
def search_engine(
    query: str,  # The search query.
    num_results: int = 10,  # The number of results to return. Defaults to 10.
    engines: list = ["google"],  # The list of search engines to use. Defaults to None.
    categories: list = [],  # The list of search categories to use. Defaults to None.
    language: str = "en",  # The language to use for the search. Defaults to None.
) -> list:  # The search results.
    """
    Rewrite the users original query to be more specific and concise.

    Args:
        query (str): The search query.
        num_results (int, optional): The number of results to return. Defaults to 10.
        engines (list, optional): The list of search engines to use. Defaults to None.
        categories (list, optional): The list of search categories to use. Defaults to None.
        language (str, optional): The language to use for the search. Defaults to None.

    Returns:
        list: The search results.

    Raises:
        ToolException: If SEARX_SEARCH_HOST_URL is not provided.
    """
    from src.constants import SEARX_SEARCH_HOST_URL
    # Check if SEARX_SEARCH_HOST_URL is provided.
    if not SEARX_SEARCH_HOST_URL:
        raise ToolException("No SEARX_SEARCH_HOST_URL provided")
    
    try:
        # Create a SearxSearchWrapper instance.
        searx = SearxSearchWrapper(searx_host=SEARX_SEARCH_HOST_URL)
        
        # Perform the search and return the results.
        results = searx.results(
            query=query,
            num_results=num_results,
            engines=engines,
            categories=categories,
            language=language
        )
        return results
    except ToolException as e:
        raise ToolException(f"Error during search_engine: {e}") from e
