import base64
import requests
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
