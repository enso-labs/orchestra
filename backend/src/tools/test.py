import random
from langchain_core.tools import tool
from langgraph.types import interrupt
from langgraph.runtime import get_runtime
from src.schemas.contexts import ContextSchema
from src.utils.logger import logger


@tool
def get_stock_price(symbol: str) -> str:
    """Get the stock price of a given symbol"""
    return f"The stock price of {symbol} is {random.randint(100, 200)}"


@tool
def get_weather(location: str) -> str:
    """Get the weather in a given location"""
    runtime = get_runtime(ContextSchema)
    user_id = runtime.context.user.id
    logger.info(f"user_id: {user_id}")
    return f"The weather in {location} is sunny and {random.randint(60, 80)} degrees"


@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
    human_response = interrupt({"query": query})
    return human_response["data"]


TEST_TOOLS = [get_stock_price, get_weather, human_assistance]
