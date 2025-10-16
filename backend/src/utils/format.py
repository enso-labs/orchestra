import base64
import requests
import re
import unicodedata
from typing import Optional
from loguru import logger
from datetime import datetime, timezone


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