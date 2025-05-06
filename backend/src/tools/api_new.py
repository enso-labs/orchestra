import json
import re
import asyncio
from typing import Any, Dict, List, Optional

from langchain_community.utilities.requests import GenericRequestsWrapper
from langchain_core.tools import StructuredTool

async def fetch_openapi_spec(
    url: str,
    headers: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Fetches the OpenAPI specification JSON from a given URL asynchronously.
    """
    wrapper = GenericRequestsWrapper(headers=headers or {})
    raw = await wrapper.aget(url)
    return json.loads(raw)


def make_api_call_func(
    method: str,
    url: str,
    headers: Dict[str, Any],
    description: str,
) -> Any:
    """
    Factory that creates an async function for the given HTTP method and URL.
    """
    async def api_call(data: Dict[str, Any] = None):
        wrapper = GenericRequestsWrapper(headers=headers)
        if method == "GET":
            return await wrapper.aget(url)
        elif method == "POST":
            return await wrapper.apost(url, data=data or {})
        elif method == "PUT":
            return await wrapper.aput(url, data=data or {})
        elif method == "DELETE":
            return await wrapper.adelete(url)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

    api_call.__doc__ = description
    return api_call


def resolve_ref(spec: dict, ref: str) -> dict:
    """
    Resolves a $ref string (e.g., '#/components/schemas/JobCreate') to the actual object in the OpenAPI spec.

    Args:
        spec: The full OpenAPI spec as a dictionary.
        ref: The $ref string to resolve.

    Returns:
        The resolved object (e.g., the schema dict).
    """
    if not ref.startswith("#/"):
        raise ValueError("Only local refs are supported")
    parts = ref.lstrip("#/").split("/")
    obj = spec
    for part in parts:
        obj = obj[part]
    return obj

def generate_tools_from_openapi_spec(
    openapi_url: str,
    headers: Optional[Dict[str, Any]] = None,
    verbose: bool = False,
) -> List[StructuredTool]:
    """
    Generates a list of StructuredTool instances for each endpoint defined in an OpenAPI spec.

    Args:
        openapi_url: URL pointing to the OpenAPI JSON spec.
        headers: Optional default headers for all requests.
        verbose: Whether to set verbose=True on each tool.

    Returns:
        A list of StructuredTool objects, one per (path, method) in the spec.
    """
    # Load spec asynchronously
    spec = asyncio.get_event_loop().run_until_complete(
        fetch_openapi_spec(openapi_url, headers=headers)
    )

    # Determine base server URL
    server_url = spec.get("servers", [{}])[0].get("url", "")

    tools: List[StructuredTool] = []
    for path, operations in spec.get("paths", {}).items():
        for http_method, operation in operations.items():
            method = http_method.upper()
            operation_id = operation.get("operationId", f"{method}_{path}")
            if operation.get('requestBody'):
                ref = operation.get('requestBody').get('content').get('application/json').get('schema').get('$ref')
                if ref:
                    job_create_schema = resolve_ref(spec, ref)
                    print(job_create_schema)
            # Sanitize tool name
            name = re.sub(r'[^a-zA-Z0-9_]', '_', operation_id.lower())

            # Use summary or description from spec
            description = (
                operation.get("summary")
                or operation.get("description", f"{method} {path}")
            )

            # Construct full URL for this endpoint
            full_url = server_url.rstrip("/") + path

            # Create the coroutine function for this endpoint
            api_func = make_api_call_func(method, full_url, headers or {}, description)

            # Build the tool
            tool = StructuredTool.from_function(coroutine=api_func)
            tool.name = name
            tool.description = description
            tool.tags = operation.get("tags", [])
            tool.metadata = operation.get("x-metadata", {})
            tool.verbose = verbose

            tools.append(tool)

    return tools


if __name__ == "__main__":
    # Example usage
    tools = generate_tools_from_openapi_spec(
        "http://localhost:8050/openapi.json"
    )
    for t in tools:
        print(t.name, "-", t.description)