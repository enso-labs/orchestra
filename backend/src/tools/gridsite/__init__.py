from langchain_core.tools import tool
from httpx import AsyncClient
from langchain_core.tools import ToolException
from src.constants import MICROSOFT_TEAMS_WEBHOOK_URL



@tool()
async def webhook_teams(text: str) -> str:
    """Send a message to the GridSite Microsoft Teams channel."""
    async with AsyncClient() as client:
        try:
            response = await client.post(
                MICROSOFT_TEAMS_WEBHOOK_URL,
                json={"text": text},
            )
            response.raise_for_status()
            return f"Message sent to Microsoft Teams channel"
        except Exception as e:
            raise ToolException(f"Error sending message to Microsoft Teams channel: {e}")


GRIDSIDE_TOOLS = [webhook_teams]
