from langchain_community.tools.playwright.utils import create_async_playwright_browser
from langchain_community.agent_toolkits.playwright.toolkit import PlayWrightBrowserToolkit

import nest_asyncio
nest_asyncio.apply()


def playwright_toolkit():
    browser = create_async_playwright_browser()
    toolkit = PlayWrightBrowserToolkit.from_browser(async_browser=browser)
    tools = toolkit.get_tools()
    return tools