import random
from dataclasses import dataclass
from typing import Annotated, Any
from langchain_core.messages import BaseMessage
from langchain_core.tools import tool
from langgraph.types import interrupt
from src.constants import APP_ENV
from pydantic import BaseModel, Field
from src.utils.logger import logger
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool, ToolRuntime 

from src.utils.format import get_tool_call_env


@tool
def get_stock_price(symbol: str) -> str:
    """Get the stock price of a given symbol"""
    return f"The stock price of {symbol} is {random.randint(100, 200)}"


@tool
def get_weather(location: str, config: RunnableConfig) -> str:
    """Get the weather in a given location"""
    user_id = config["configurable"].get("user_id")
    if user_id:
        logger.debug(f"user_id: {user_id}")
        return f"The weather in {location} is sunny and {random.randint(60, 80)} degrees as seen by {user_id}"
    return f"The weather in {location} is sunny and {random.randint(60, 80)} degrees"


@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
    human_response = interrupt({"query": query})
    return human_response["data"]


class SendWebhookArgs(BaseModel):
    text: str = Field(description="The text to send to the webhook")
    runtime: Any

@tool(args_schema=SendWebhookArgs)
def send_webhook_to_channel(text: str, runtime: ToolRuntime) -> str:
    """Title: Webhook Tool
    Description: Test the webhook tool
    Args:
        text (str): The text to send to the webhook
    Returns:
        bool: True if the webhook tool is working, False otherwise
    """
    TEST_WEBHOOK_URL, tool_call = get_tool_call_env(runtime).get('TEST_WEBHOOK_URL')
    if not TEST_WEBHOOK_URL:
        raise ValueError(f"TEST_WEBHOOK_URL not found in metadata for tool call {tool_call.get('name')}")
    return True

TEST_TOOLS = [get_stock_price, get_weather, human_assistance, send_webhook_to_channel]
