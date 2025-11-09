import base64
from langchain_core.runnables import RunnableConfig
import requests
import re
import unicodedata
from typing import Optional, Any
from loguru import logger
from datetime import datetime, timezone
from langchain_core.messages import BaseMessage
from langgraph.prebuilt import ToolRuntime


def get_base64_image(image_url: str) -> Optional[str]:
    """Fetch image from URL and convert to base64, or return existing base64 string."""
    # Check if the string is already a base64 data URL
    if image_url.startswith("data:image/"):
        return image_url

    # Check if it's a raw base64 string
    try:
        # Try to decode to check if it's valid base64
        base64.b64decode(image_url)
        # If successful, assume it's an image and add data URL prefix
        return f"data:image/png;base64,{image_url}"
    except Exception:
        # Not base64, try to fetch as URL
        try:
            response = requests.get(image_url)
            response.raise_for_status()
            image_data = response.content
            base64_image = base64.b64encode(image_data).decode("utf-8")
            # Detect content type from response headers or default to png
            content_type = response.headers.get("content-type", "image/png")
            return f"data:{content_type};base64,{base64_image}"
        except Exception as e:
            logger.error(f"Failed to fetch or encode image {image_url}: {str(e)}")
            return None


def get_time(ts: str = None) -> str:
    if ts:
        return datetime.fromtimestamp(ts, timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    """
    Convert a string into a slug (URL-friendly format).
    """
    # Normalize unicode characters (e.g., café -> cafe)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")

    # Lowercase
    text = text.lower()

    # Replace non-alphanumeric characters with hyphens
    text = re.sub(r"[^a-z0-9]+", "-", text)

    # Remove leading/trailing hyphens
    text = text.strip("-")

    return text


def raw_html(content: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <title>Prompt Content</title>
  <meta charset="utf-8">
</head>
<body>
<pre>{content}</pre>
</body>
</html>"""


def init_system_prompt(system_prompt: str, metadata: dict) -> str:
    from src.schemas.entities import Config

    if isinstance(metadata, Config):
        metadata = metadata.model_dump()
    lines = [system_prompt]
    lines.append("---")
    # current_time: use if present, else fill if timezone given
    current_time = metadata.get("current_time")
    timezone_val = metadata.get("timezone")
    if current_time:
        lines.append(f"CURRENT_TIME: {current_time}")
    elif timezone_val:
        now_iso = datetime.now(timezone.utc).isoformat()
        lines.append(f"CURRENT_TIME: {now_iso}")
    if timezone_val:
        lines.append(f"TIMEZONE: {timezone_val}")
    if "language" in metadata:
        lines.append(f"LANGUAGE: {metadata['language']}")
    return "\n".join(lines) + "\n"


def format_content(content: str | list[Any]) -> str:
    if isinstance(content, str):
        return content
    return content[0].get("text", "")

def get_tool_call_from_runtime_state(runtime: ToolRuntime) -> dict:
    messages: list[BaseMessage] = runtime.state.get("messages", [])
    if messages:
        for msg in reversed(messages):
            if hasattr(msg, "tool_calls"):
                for call in msg.tool_calls:
                    if call.get("id") == runtime.tool_call_id:
                        return call
    raise ValueError("Tool call not found in runtime state")

def get_tool_call_env(runtime: ToolRuntime) -> tuple[dict, dict]:
    """Return (env_dict, tool_call_dict) for the current tool_call_id."""
    messages: list[BaseMessage] = runtime.state.get("messages", []) or []
    metadata = runtime.config.get("metadata") or {}
    if messages:
        for msg in reversed(messages):
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for call in msg.tool_calls:
                    if call.get("id") == runtime.tool_call_id:
                        tool_name = call.get("name")
                        env = ((metadata.get(tool_name) or {}).get("env") or {})
                        return env, call
    raise ValueError("Tool call not found in runtime state")
