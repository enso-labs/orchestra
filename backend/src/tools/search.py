import asyncio
import re
import unicodedata
from dataclasses import dataclass
from typing import Literal, List, Optional, Tuple, Union

import httpx
from charset_normalizer import from_bytes
from markdownify import markdownify as md
from langchain_core.tools import tool
from langchain_core.tools import ToolException
from langchain_community.utilities import SearxSearchWrapper

from src.utils.logger import logger
from src.tools.math import math_calculator
from src.tools.base.reasoning import think_tool


# -----------------------------
# Helpers: binary/text hygiene
# -----------------------------
def strip_control_chars(s: str) -> str:
    """
    Remove most control characters that often show up as garbage output,
    but keep newlines and tabs for formatting.
    """
    return "".join(
        ch for ch in s if ch in ("\n", "\t") or unicodedata.category(ch)[0] != "C"
    )


def looks_binary(data: bytes, *, threshold: float = 0.20) -> bool:
    """
    Heuristic: if a significant portion of the first chunk is non-printable,
    treat it as binary/compressed/etc.
    """
    if not data:
        return False
    sample = data[:4096]
    bad = 0
    for b in sample:
        # allow: tab(9) lf(10) cr(13)
        if b in (9, 10, 13):
            continue
        # control chars + high-likelihood binary
        if b < 32:
            bad += 1
    return (bad / len(sample)) > threshold


# -----------------------------
# Markdown cleanup
# -----------------------------
def clean_markdown(md_text: str) -> str:
    """Clean and normalize markdown text."""
    # Normalize line endings
    md_text = md_text.replace("\r\n", "\n").replace("\r", "\n")

    # Strip weird control chars (prevents a lot of "�" / garbage display)
    md_text = strip_control_chars(md_text)

    # Strip trailing whitespace per line
    md_text = "\n".join(line.rstrip() for line in md_text.splitlines())

    # Collapse 3+ newlines into 2
    md_text = re.sub(r"\n{3,}", "\n\n", md_text)

    # Remove excessive spaces before/after horizontal rules
    md_text = re.sub(r"\n+\s*---\s*\n+", "\n\n---\n\n", md_text)

    return md_text.strip()


# -----------------------------
# Fetch + convert
# -----------------------------
@dataclass
class FetchResult:
    """Result of fetching a URL with its detected content type category."""

    text: str
    content_type: str


ALLOWED_TEXT_TYPES: dict[str, str] = {
    "text/html": "html",
    "text/plain": "plain",
    "text/csv": "csv",
    "text/markdown": "markdown",
    "text/xml": "xml",
    "application/json": "json",
    "application/xml": "xml",
    "application/xhtml+xml": "html",
    "application/rss+xml": "xml",
    "application/atom+xml": "xml",
}


def _resolve_content_type(raw: str) -> str:
    """Strip charset/parameters and match against ALLOWED_TEXT_TYPES.

    Returns the category string (e.g. "html", "plain") or raises ValueError.
    """
    if not raw:
        raise ValueError("Non-text content-type: unknown")

    # Strip parameters like "; charset=utf-8"
    mime = raw.split(";")[0].strip().lower()

    # Check explicit allowlist first
    if mime in ALLOWED_TEXT_TYPES:
        return ALLOWED_TEXT_TYPES[mime]

    # Accept any text/* not in the allowlist as a fallback
    if mime.startswith("text/"):
        return "plain"

    raise ValueError(f"Non-text content-type: {raw}")


async def fetch_content(client: httpx.AsyncClient, url: str) -> FetchResult:
    """
    Fetch text-based content from a URL safely.

    Key protections:
    - Reject non-text content-types (PDFs/images/zips/etc.)
    - Reject likely-binary payloads
    - Robust decode from bytes (don't trust server charset headers)
    """
    r = await client.get(url)
    r.raise_for_status()

    ctype = (r.headers.get("content-type") or "").lower()
    category = _resolve_content_type(ctype)

    data = r.content

    # Quick binary/compressed detection
    if looks_binary(data):
        raise ValueError("Response looks binary/compressed; refusing to decode as text")

    # Robust decode (handles missing/wrong charset)
    decoded = str(from_bytes(data).best())

    # Final safety
    return FetchResult(text=strip_control_chars(decoded), content_type=category)


async def html_to_markdown(html: str) -> str:
    """Convert HTML to clean markdown."""
    md_text = await asyncio.to_thread(md, html, heading_style="ATX")
    return clean_markdown(md_text)


async def content_to_markdown(result: FetchResult) -> str:
    """Route fetched content to the appropriate markdown converter based on content type."""
    ct = result.content_type

    if ct == "html":
        return await html_to_markdown(result.text)

    if ct in ("plain", "markdown"):
        return clean_markdown(result.text)

    if ct == "json":
        return f"```json\n{result.text}\n```"

    if ct == "xml":
        return f"```xml\n{result.text}\n```"

    if ct == "csv":
        return f"```csv\n{result.text}\n```"

    # Unknown text types fall back to clean_markdown
    return clean_markdown(result.text)


async def url_to_markdown(
    client: httpx.AsyncClient,
    url: str,
    sem: asyncio.Semaphore,
) -> Tuple[str, Union[str, Exception]]:
    """Fetch a URL and convert to markdown with concurrency control."""
    try:
        async with sem:
            result = await fetch_content(client, url)
            md_text = await content_to_markdown(result)
            return url, md_text
    except Exception as e:
        return url, e


async def urls_to_markdown(
    urls: List[str],
    *,
    concurrency: int = 5,
    timeout_s: float = 30.0,
) -> str:
    """Fetch multiple URLs and convert to markdown concurrently."""
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(timeout_s),
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            # Prefer HTML but accept plain text and other text types too
            "Accept": "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            # IMPORTANT: avoid brotli unless your runtime supports it
            "Accept-Encoding": "gzip, deflate",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Upgrade-Insecure-Requests": "1",
        },
    ) as client:
        tasks = [url_to_markdown(client, url, sem) for url in urls]
        results = await asyncio.gather(*tasks)

    pages: List[str] = []
    for url, outcome in results:
        if isinstance(outcome, Exception):
            pages.append(
                clean_markdown(
                    f"<!-- SOURCE: {url} -->\n\n"
                    f"## Fetch/convert failed\n\n"
                    f"**Error:** `{type(outcome).__name__}: {outcome}`\n\n"
                    f"> Tip: This often happens when the URL returns a PDF, image, "
                    f"> or other binary/compressed content."
                )
            )
            continue

        pages.append(f"<!-- SOURCE: {url} -->\n\n{outcome}")

    combined = "\n\n---\n\n".join(pages)
    return clean_markdown(combined)


Categories = Literal[
    "general",
    # "images",
    "videos",
    "news",
    "map",
    # "music",
    "it",
    "science",
    "files",
    # "social media",
]
Engines = Literal[
    "duckduckgo",
    "google",
    "bing",
    "github",
    # "wikipedia",
    "reuters",
    "arxiv",
    # "adobe_stock",
]


# -----------------------------
# Search Provider Helpers
# -----------------------------
async def _search_with_exa(
    query: str, num_results: int, api_key: str
) -> tuple[list, Exception | None]:
    """
    Execute search using Exa API.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        from exa_py import Exa
    except ImportError as e:
        logger.warning("[Exa] exa-py not installed, skipping Exa search")
        return [], e

    try:
        exa = Exa(api_key=api_key)
        response = await asyncio.to_thread(
            exa.search_and_contents,
            query,
            num_results=num_results,
            highlights=True,
        )
        results = _normalize_exa_results(response.results)
        return results, None
    except Exception as e:
        logger.warning(f"[Exa] Search failed: {e}")
        return [], e


async def _search_with_searx(
    query: str,
    num_results: int,
    searx_url: str,
    engines: List[Literal[Engines]],
    categories: List[Literal[Categories]],
) -> tuple[list, Exception | None]:
    """
    Execute search using SearXNG.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        searx = SearxSearchWrapper(searx_host=searx_url)
        results = await searx.aresults(
            query=query,
            num_results=num_results,
            engines=engines,
            categories=categories,
        )
        return results, None
    except Exception as e:
        return [], e


def _normalize_exa_results(exa_results) -> list:
    """
    Convert Exa search response to the canonical search result format.
    Maps Exa fields to {title, link, snippet, engines, score, source}.
    """
    normalized = []
    for item in exa_results:
        # Use first highlight if available, otherwise truncate text
        snippet = ""
        if hasattr(item, "highlights") and item.highlights:
            snippet = item.highlights[0]
        elif hasattr(item, "text") and item.text:
            snippet = item.text[:300]

        normalized.append(
            {
                "title": getattr(item, "title", ""),
                "link": getattr(item, "url", ""),
                "snippet": snippet,
                "engines": ["exa"],
                "score": getattr(item, "score", 0.0),
                "source": "exa",
            }
        )
    return normalized


def _normalize_tavily_results(tavily_response: dict) -> list:
    """
    Convert Tavily response format to match SearXNG result format.
    Ensures consistent return structure for downstream consumers.
    """
    normalized = []
    raw_results = tavily_response.get("results", [])

    for item in raw_results:
        normalized.append(
            {
                "title": item.get("title", ""),
                "link": item.get("url", ""),
                "snippet": item.get("content", ""),
                "engines": ["tavily"],
                "score": item.get("score", 0.0),
                "source": "tavily",
            }
        )

    return normalized


async def _search_with_tavily(
    query: str, num_results: int, api_key: str
) -> tuple[list, Exception | None]:
    """
    Execute search using Tavily API.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        from langchain_tavily import TavilySearch

        tavily = TavilySearch(
            max_results=num_results,
            tavily_api_key=api_key,
        )
        # TavilySearch returns dict with 'results' key
        response = await tavily.ainvoke({"query": query})

        # Normalize response format to match SearXNG output
        results = _normalize_tavily_results(response)
        return results, None
    except Exception as e:
        return [], e


@tool
async def web_search(
    query: str,
    num_results: Optional[int] = 5,
    engines: Optional[List[Literal[Engines]]] = ["google"],
    categories: Optional[List[Literal[Categories]]] = ["general"],
) -> list:
    """
    Execute a web search and return high-signal results for expert-level research.

    This tool performs a single search execution using the provided query.
    It does not reformulate, retry, or broaden queries internally.

    Parameters
    ----------
    query : str
        A well-formed search query using clear keywords and common operators
        (e.g., quotes, OR, -, site:, intitle:, filetype:) when appropriate.
    num_results : int | None, optional
        Maximum number of results to return. Defaults to 5 if None.

    Returns
    -------
    list
        A list of search result objects. Each result SHOULD include:
        - title : str
            The page or document title.
        - url : str
            The canonical URL of the result.
        - snippet : str
            A short, relevant summary or excerpt.

        An empty list ([]) explicitly indicates that no results were returned
        by the configured search providers.

    Tool Usage Constraint (MANDATORY)
    --------------------------------
    - An agent MUST NOT invoke this tool more than three (3) times consecutively
      without calling `think_tool` in between.
    - After three invocations, the agent MUST pause to reassess strategy,
      refine assumptions, or change the research approach before continuing.
    - Violating this rule is considered incorrect tool usage.

    Loop-Safety Contract
    --------------------
    - Returning an empty list ([]) is a terminal signal for the given query.
    - Repeated empty results for the same research task SHOULD be treated
      by the calling agent as an exit condition.
    - The calling agent is responsible for stopping, changing strategy,
      or reporting that no results were found.

    Notes
    -----
    - This tool may use multiple providers internally.
    - Results are raw search outputs and are not validated conclusions.
    - The tool maintains no internal state across calls.

    Raises
    ------
    ToolException
        If no search providers are configured.
    """
    from src.constants import EXA_API_KEY, SEARX_SEARCH_HOST_URL, TAVILY_API_KEY

    # Default num_results if None
    num_results = num_results or 5

    logger.info(f"[Search] Searching for '{query}' with max {num_results} results")

    # Phase 1: Try primary search provider (Exa)
    if EXA_API_KEY:
        results, exa_error = await _search_with_exa(
            query=query,
            num_results=num_results,
            api_key=EXA_API_KEY,
        )

        if results:
            logger.info(f"[Exa] Found {len(results)} results")
            return results

        if exa_error:
            logger.warning(f"[Exa] Search failed: {exa_error}")
        else:
            logger.warning(f"[Exa] No results returned for: {query}")

    # Phase 2: Fallback to SearXNG
    if SEARX_SEARCH_HOST_URL:
        results, searx_error = await _search_with_searx(
            query=query,
            num_results=num_results,
            searx_url=SEARX_SEARCH_HOST_URL,
            engines=engines,
            categories=categories,
        )

        if results:
            logger.info(f"[SearXNG] Found {len(results)} results")
            return results

        if searx_error:
            logger.warning(f"[SearXNG] Search failed: {searx_error}")
        else:
            logger.warning(f"[SearXNG] No results returned for: {query}")

    # Phase 3: Fallback to Tavily
    if TAVILY_API_KEY:
        logger.info("[Tavily] Attempting fallback search")
        results, tavily_error = await _search_with_tavily(
            query=query,
            num_results=num_results,
            api_key=TAVILY_API_KEY,
        )

        if results:
            logger.info(f"[Tavily] Fallback returned {len(results)} results")
            return results

        if tavily_error:
            logger.warning(f"[Tavily] Fallback also failed: {tavily_error}")

    # Phase 4: All providers exhausted
    if not EXA_API_KEY and not SEARX_SEARCH_HOST_URL and not TAVILY_API_KEY:
        raise ToolException(
            "No search providers configured. "
            "Set EXA_API_KEY, SEARX_SEARCH_HOST_URL, or TAVILY_API_KEY."
        )

    # Return empty rather than throwing to prevent agent loops
    logger.warning(f"[Search] All providers returned no results for: {query}")
    return []


@tool
async def web_scrape(urls: List[str]) -> str:
    """
    Title: Web Scrape
    Toolkit: Search
    Description: Retrieve content from a list of URLs
    Args:
        urls (List[str]): A list of URLs to scrape
    Returns:
        str: A string of the scraped content in markdown format
    """
    logger.info(f"Scraping {len(urls)} URLs START")
    result = await urls_to_markdown(urls, concurrency=5, timeout_s=30.0)
    logger.info(f"Scraping {len(urls)} URLs DONE")
    return result


SEARCH_TOOLS = [
    web_search,
    web_scrape,
    math_calculator,
    think_tool,
]
