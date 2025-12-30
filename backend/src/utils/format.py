import base64
import yaml
import ujson
from langchain_core.runnables import RunnableConfig
import requests
import re
import unicodedata
from pydantic import BaseModel, Field, create_model
from typing import Optional, Any, Dict, Type, List, Tuple
from loguru import logger
from datetime import datetime, timezone
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
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


def init_system_prompt(
    system_prompt: str, config: RunnableConfig, instructions: str = None
) -> str:
    lines = [system_prompt]
    if instructions:
        lines.append("---")
        lines.append(f"INSTRUCTIONS:\n{instructions}")
    lines.append("---")
    metadata = config.get("metadata", {})
    current_utc = metadata.get("current_utc")
    timezone_val = metadata.get("timezone")
    lang = metadata.get("language", "en-US")
    if current_utc:
        # Attempt to localize UTC datetime based on the provided timezone, if available
        try:
            import pytz
            from dateutil.parser import isoparse

            dt_utc = isoparse(current_utc)
            if timezone_val:
                tz = pytz.timezone(timezone_val)
                dt_local = dt_utc.astimezone(tz)
                lines.append(f"LOCAL_TIME: {dt_local.isoformat()}")
                lines.append(f"CURRENT_UTC: {dt_utc.isoformat()}")
            else:
                lines.append(f"CURRENT_UTC: {dt_utc.isoformat()}")
        except Exception as e:
            lines.append(f"CURRENT_UTC: {current_utc}")
    elif timezone_val:
        now_iso = datetime.now(timezone.utc).isoformat()
        lines.append(f"CURRENT_UTC: {now_iso}")
    if timezone_val:
        lines.append(f"TIMEZONE: {timezone_val}")
    if lang:
        lines.append(f"LANGUAGE: {lang}")
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
    try:
        messages: list[BaseMessage] = runtime.state.get("messages", []) or []
        metadata = runtime.config.get("metadata") or {}
        if messages:
            for msg in reversed(messages):
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for call in msg.tool_calls:
                        if call.get("id") == runtime.tool_call_id:
                            tool_name = call.get("name")
                            env = (metadata.get(tool_name) or {}).get("env") or {}
                            return env, call
    except Exception as e:
        logger.error(f"Error getting tool call env: {e}")
        raise ValueError(f"Error getting tool call env: {e}")


def format_xml_thread(
    messages: list[BaseMessage], include_tool_calls: bool = True
) -> str:
    xml_lines = ["<thread>"]
    for message in messages:
        if isinstance(message, HumanMessage):
            content = format_content(message.content)
            xml_lines.append(
                f'  <event id="{message.id}" type="{message.type}">{content}</event>'
            )
        elif isinstance(message, ToolMessage):
            if include_tool_calls:
                xml_lines.append(
                    f'  <event id="{message.tool_call_id}" type="tool_output" name="{message.name}" status="{message.status}">{message.content}</event>'
                )
        elif isinstance(message, AIMessage):
            if getattr(message, "tool_calls", None):
                if include_tool_calls:
                    for tool_call in message.tool_calls:
                        xml_lines.append(
                            f'  <event id="{tool_call["id"]}" type="tool_input" name="{tool_call["name"]}">{ujson.dumps(tool_call["args"])}</event>'
                        )
            else:
                content = format_content(message.content)
                xml_lines.append(
                    f'  <event id="{message.id}" type="{message.type}">{content}</event>'
                )
    xml_lines.append("</thread>")
    return "\n".join(xml_lines)


def format_schema_to_model(
    schema: Dict[str, Any],
    model_name: str = "DynamicModel",
) -> Type[BaseModel]:
    """
    Converts a nested args_schema-like dict into a nested Pydantic model class.
    """

    fields = {}

    type_mapping = {
        "str": str,
        "string": str,
        "int": int,
        "integer": int,
        "float": float,
        "number": float,
        "bool": bool,
        "boolean": bool,
        "dict": dict,
        "object": dict,
        "list": list,
        "array": list,
    }

    for key, spec in schema.items():
        # If the spec is a nested object (dict of fields) WITHOUT explicit type definition, we treat it as nested model.
        # This supports simplified schemas where nested objects are just dicts of fields.
        is_implicit_nested = isinstance(spec, dict) and not {
            "type",
            "default",
            "required",
            "description",
        } & set(spec.keys())

        description = spec.get("description", "")
        required = spec.get("required", False)
        default = spec.get("default", None)

        if required:
            default_value = Field(..., description=description)
        else:
            default_value = Field(default, description=description)

        # ---- CASE 1: Implicit Nested object ----
        if is_implicit_nested:
            nested_model = format_schema_to_model(
                spec, model_name=f"{model_name}_{key.capitalize()}"
            )
            fields[key] = (nested_model, default_value)
            continue

        # ---- CASE 2: Explicit definition ----
        raw_type = spec.get("type", Any)
        field_type = Any

        if isinstance(raw_type, str):
            raw_type = raw_type.lower()

            if raw_type in ["array", "list"] and "items" in spec:
                # Handle List[Type]
                item_spec = spec["items"]
                # If item spec is simple type string
                if isinstance(item_spec, dict) and "type" in item_spec:
                    item_type_str = item_spec["type"]
                    # If item type is object/nested
                    if item_type_str == "object" and "properties" in item_spec:
                        nested_item_model = format_schema_to_model(
                            item_spec["properties"],
                            model_name=f"{model_name}_{key.capitalize()}Item",
                        )
                        field_type = List[nested_item_model]
                    else:
                        py_item_type = type_mapping.get(item_type_str, Any)
                        field_type = List[py_item_type]
                else:
                    field_type = List[Any]

            elif raw_type in ["object", "dict"] and "properties" in spec:
                # Handle nested object with properties
                nested_model = format_schema_to_model(
                    spec["properties"], model_name=f"{model_name}_{key.capitalize()}"
                )
                field_type = nested_model

            else:
                # Simple type mapping
                field_type = type_mapping.get(raw_type, Any)
        else:
            field_type = raw_type

        fields[key] = (field_type, default_value)

    return create_model(model_name, **fields)

def split_front_matter(md: str) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Split the front matter from the markdown content.
    Returns a dictionary of the front matter and the markdown content.
    """
    if not md.startswith("---\n"):
        return None, md

    end = md.find("\n---", 4)
    if end == -1:
        return None, md

    try:
        fm = yaml.safe_load(md[4:end]) or {}
    except yaml.YAMLError as e:
        logger.error(f"Failed to parse YAML front matter: {e}")
        raise ValueError(f"Invalid YAML front matter: {e}") from e

    body = md[end + 4 :].lstrip("\n")

    return fm, body