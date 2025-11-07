from langchain_core.tools import tool
from httpx import AsyncClient
from langchain_core.tools import ToolException
from src.constants import MICROSOFT_TEAMS_WEBHOOK_URL

@tool()
async def webhook_teams(text: str) -> str:
    """Title: Webhook Teams
    Description: Send a message to the GridSite Microsoft Teams channel.
    IMPORTANT: Standard Markdown headers like #, ##, etc., are not supported in Microsoft Teams messages sent via webhook and will not render as headers. Avoid using Markdown header syntax.
    Formatting:
        - Use **bold** for bold text.
        - Use _italic_ for italic text.
        - Use - bullet list for bullet lists.
        - Use 1. numbered list for numbered lists.
        - Use [link](https://example.com) for links.
        - Use ![image](https://example.com/image.png) for images.
        - Use > blockquote for blockquotes.
        - Use `code` for code blocks.
    Args:
        text (str): The formatted message to send to the Microsoft Teams channel.
    Returns:
        str: A confirmation message.
    """
    async with AsyncClient() as client:
        try:
            from src.utils.logger import logger
            logger.info(f"Sending message to Microsoft Teams: {text!r}")
            response = await client.post(
                MICROSOFT_TEAMS_WEBHOOK_URL,
                json={"text": text},
            )
            response.raise_for_status()
            return f"Message sent to Microsoft Teams channel"
        except Exception as e:
            raise ToolException(f"Error sending message to Microsoft Teams channel: {e}")


GRIDSIDE_TOOLS = [webhook_teams]
