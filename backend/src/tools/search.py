import asyncio
import re
import unicodedata
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
async def fetch_html(client: httpx.AsyncClient, url: str) -> str:
    """
    Fetch HTML content from a URL safely.

    Key protections:
    - Reject non-HTML content-types (PDFs/images/zips/etc.)
    - Reject likely-binary payloads
    - Robust decode from bytes (don’t trust server charset headers)
    """
    r = await client.get(url)
    r.raise_for_status()

    ctype = (r.headers.get("content-type") or "").lower()

    # Only accept HTML-ish responses
    if ("text/html" not in ctype) and ("application/xhtml+xml" not in ctype):
        raise ValueError(f"Non-HTML content-type: {ctype or 'unknown'}")

    data = r.content

    # Quick binary/compressed detection
    if looks_binary(data):
        raise ValueError("Response looks binary/compressed; refusing to decode as text")

    # Robust decode (handles missing/wrong charset)
    html = str(from_bytes(data).best())

    # Final safety
    return strip_control_chars(html)


async def html_to_markdown(html: str) -> str:
    """Convert HTML to clean markdown."""
    md_text = await asyncio.to_thread(md, html, heading_style="ATX")
    return clean_markdown(md_text)


async def url_to_markdown(
    client: httpx.AsyncClient,
    url: str,
    sem: asyncio.Semaphore,
) -> Tuple[str, Union[str, Exception]]:
    """Fetch a URL and convert to markdown with concurrency control."""
    try:
        async with sem:
            html = await fetch_html(client, url)
            md_text = await html_to_markdown(html)
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
            # Prefer HTML; still allow */* so some sites respond, but we gate by Content-Type anyway
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
                    f"> Tip: This often happens when the URL returns a PDF/image, "
                    f"> or the payload is compressed/binary."
                )
            )
            continue

        pages.append(f"<!-- SOURCE: {url} -->\n\n{outcome}")

    combined = "\n\n---\n\n".join(pages)
    return clean_markdown(combined)


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


# -----------------------------
# Search Provider Helpers
# -----------------------------
async def _search_with_searx(
    query: str, num_results: int, searx_url: str
) -> tuple[list, Exception | None]:
    """
    Execute search using SearXNG.
    Returns (results, error) tuple for clean error handling.
    """
    try:
        searx = SearxSearchWrapper(searx_host=searx_url)
        results = await searx.aresults(query=query, num_results=num_results)
        return results, None
    except Exception as e:
        return [], e


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
) -> list:
    """
    Title: Web Search
    Toolkit: Search
    Description: Perform a targeted web search for the provided query.
        - Always refine the query with the most relevant keywords.
        - Be specific with dates (e.g., "September 7, 2025" instead of "recent" or "today").
        - Use exact timeframes when searching for current or time-sensitive events.
        - Think critically before searching to ensure accuracy and relevance.
        - Automatically falls back to Tavily API if primary search yields no results.

    Example Queries:
        - site:<domain> latest news about <topic> September 7, 2025
        - <company> earnings report Q2 2025
        - election results Nevada November 2024

    Args:
        query (str): The search query string.
        num_results (int, optional): Number of results to return. Default is 5.

    Returns:
        list: A list of search results.
    """
    from src.constants import SEARX_SEARCH_HOST_URL, TAVILY_API_KEY

    # Default num_results if None
    num_results = num_results or 5

    logger.info(f"[Search] Searching for '{query}' with max {num_results} results")

    # Phase 1: Try primary search provider (SearXNG)
    if SEARX_SEARCH_HOST_URL:
        results, searx_error = await _search_with_searx(
            query=query,
            num_results=num_results,
            searx_url=SEARX_SEARCH_HOST_URL,
        )

        if results:
            logger.info(f"[SearXNG] Found {len(results)} results")
            return results

        if searx_error:
            logger.warning(f"[SearXNG] Search failed: {searx_error}")
        else:
            logger.warning(f"[SearXNG] No results returned for: {query}")

    # Phase 2: Fallback to Tavily if available
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

    # Phase 3: All providers exhausted
    if not SEARX_SEARCH_HOST_URL and not TAVILY_API_KEY:
        raise ToolException(
            "No search providers configured. "
            "Set SEARX_SEARCH_HOST_URL or TAVILY_API_KEY."
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
