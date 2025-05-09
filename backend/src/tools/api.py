from typing import Union, Dict, Any, List, Optional, Type
import re
import json
import httpx
import yaml
import asyncio

from pydantic import BaseModel, create_model
from pydantic.fields import Field
from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
from langchain_community.utilities.requests import TextRequestsWrapper, GenericRequestsWrapper
from langchain_core.tools import StructuredTool
from langchain_community.tools.requests.tool import BaseRequestsTool

def _get_schema(response_json: Union[dict, list]) -> dict:
    if isinstance(response_json, list):
        response_json = response_json[0] if response_json else {}
    return {key: type(value).__name__ for key, value in response_json.items()}

def _add_endpoint_to_spec(
    base_url: str,
    endpoint: str,
    common_query_parameters: List[Dict[str, Any]],
    openapi_spec: Dict[str, Any]
) -> None:
    response = httpx.get(base_url + endpoint)
    if response.status_code == 200:
        schema = _get_schema(response.json())
        openapi_spec["paths"][endpoint] = {
            "get": {
                "summary": f"Get {endpoint[1:]}",
                "parameters": common_query_parameters,
                "responses": {
                    "200": {
                        "description": "Successful response",
                        "content": {
                            "application/json": {
                                "schema": {"type": "object", "properties": schema}
                            }
                        },
                    }
                },
            }
        }

def get_api_spec(
    title: str,
    version: str,
    base_url: str,
    endpoints: List[str],
    common_query_parameters: List[Dict[str, Any]],
    description: str,
    paths: Dict[str, Any] = {},
) -> str:
    openapi_spec: Dict[str, Any] = {
        "openapi": "3.0.0",
        "info": {"title": title, "version": version, "description": description},
        "servers": [{"url": base_url}],
        "paths": paths,
    }
    # Iterate over the endpoints to construct the paths
    for endpoint in endpoints:
        _add_endpoint_to_spec(base_url, endpoint, common_query_parameters, openapi_spec)
    return yaml.dump(openapi_spec, sort_keys=False)

def openapi_from_url(url: str) -> str:
    try:
        response = httpx.get(url)
        if response.status_code == 200:
            return yaml.dump(response.json(), sort_keys=False)
        else:
            raise Exception(f"Failed to get OpenAPI spec from {url}")
    except Exception as e:
        raise Exception(f"Failed to get OpenAPI spec from {url}: {e}")
    
################################################################################
### Example Usage
################################################################################
api_spec = get_api_spec(
    title="JSONPlaceholder API",
    version="1.0.0",
    base_url="https://jsonplaceholder.typicode.com",
    endpoints=["/posts", "/comments"],
    common_query_parameters=[],
    description="JSONPlaceholder API",
)
toolkit = RequestsToolkit(
    requests_wrapper=TextRequestsWrapper(headers={}),
    allow_dangerous_requests=True,
)
tools = toolkit.get_tools()
system_message = """You have access to an API to help answer user queries.
Here is documentation on the API:
{api_spec}
""".format(api_spec=api_spec)

from langchain_community.utilities.requests import GenericRequestsWrapper
from langchain_core.tools import BaseTool

def get_base_tool(
    headers: Dict[str, Any]
) -> BaseTool:
    requests_wrapper = GenericRequestsWrapper(headers=headers)
    base_tool = BaseRequestsTool(requests_wrapper=requests_wrapper)
    return base_tool

def get_wrapper(
    headers: Dict[str, Any]
) -> GenericRequestsWrapper:
    requests_wrapper = GenericRequestsWrapper(headers=headers)
    return requests_wrapper

def construct_api_tool(
    name: str,
    description: str,
    method: str,
    headers: Dict[str, Any],
    metadata: Dict[str, Any] = {},
    tags: List[str] = [],
    verbose: bool = False,
) -> StructuredTool:
    requests_wrapper = GenericRequestsWrapper(headers=headers)
    if method == "GET":
        async def api_request(url: str):    
            return await requests_wrapper.aget(url)
    elif method == "POST":
        async def api_request(url: str, data: Dict[str, Any]):    
            return await requests_wrapper.apost(url, data=data)
    elif method == "PUT":
        async def api_request(url: str, data: Dict[str, Any]):    
            return await requests_wrapper.aput(url, data=data)
    elif method == "DELETE":
        async def api_request(url: str):    
            return await requests_wrapper.adelete(url)
        
    api_request.__doc__ = description
    tool = StructuredTool.from_function(coroutine=api_request)
    tool.name = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())
    tool.description = description
    tool.metadata = metadata
    tool.tags = tags
    tool.verbose = verbose
    return tool

################################################################################
### API from OpenAPI spec
################################################################################
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
    data: Optional[Dict[str, Any]] = None,
) -> Any:
    """
    Factory that creates an async function for the given HTTP method and URL.
    """
    async def api_call():
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

def resolve_ref_recursive(spec: dict, obj: dict) -> dict:
    """
    Recursively resolves all $ref values in a schema object using the OpenAPI spec.

    Args:
        spec: The full OpenAPI spec as a dictionary.
        obj: The schema object (may contain $ref).

    Returns:
        The schema object with all $ref values resolved.
    """
    if isinstance(obj, dict):
        if "$ref" in obj:
            # Resolve the reference and recurse
            resolved = resolve_ref(spec, obj["$ref"])
            return resolve_ref_recursive(spec, resolved)
        else:
            # Recurse into all dict values
            return {k: resolve_ref_recursive(spec, v) for k, v in obj.items()}
    elif isinstance(obj, list):
        # Recurse into all list items
        return [resolve_ref_recursive(spec, item) for item in obj]
    else:
        # Base case: return as is
        return obj
    

def get_field_type(field_type: str) -> Any:
    """
    Map field type strings to actual Python types.
    """
    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "object": Dict[str, Any],
        "array": list
    }
    return type_mapping.get(field_type, Any)

def create_schema(model_name: str, fields_json: Dict[str, Any]) -> Type[BaseModel]:
    """
    Create a Pydantic model dynamically from a JSON object.

    :param model_name: The name of the model.
    :param fields_json: A dictionary representing the fields from a JSON object.
    :return: A dynamically created Pydantic model.
    """
    fields = {}
    for field_name, field_info in fields_json.items():
        if field_info.get("type") == "object" and "properties" in field_info:
            # Recursively create nested models for object types
            nested_model = create_schema(field_info.get('title'), field_info["properties"])
            field_type = nested_model
        else:
            field_type = get_field_type(field_info.get("type", ""))
        
        field_params = {"description": field_info.get("description", "")}
        if field_info.get("required", False):
            field_params["default"] = field_info.get('default', None) or ...
        else:
            field_params["default"] = field_info.get("default", None)
        fields[field_name] = (field_type, Field(**field_params))
    
    return create_model(model_name, **fields)

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
    server_url = spec.get("servers", [{}])[0].get("url", "") or openapi_url.replace("/openapi.json", "")

    tools: List[StructuredTool] = []
    for path, operations in spec.get("paths", {}).items():
        for http_method, operation in operations.items():
            method = http_method.upper()
            args_schema = None
            if operation.get('requestBody'):
                ref = operation.get('requestBody').get('content').get('application/json').get('schema').get('$ref')
                if ref:
                    schema = resolve_ref(spec, ref)
                    fully_resolved_schema = resolve_ref_recursive(spec, schema)
                    args_schema = create_schema(fully_resolved_schema.get('title'), fully_resolved_schema.get('properties'))
            # Sanitize tool name
            name = re.sub(r'[^a-zA-Z0-9_]', '_', operation.get("summary").lower())

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
            tool = StructuredTool.from_function(coroutine=api_func, args_schema=args_schema)
            tool.name = name
            tool.description = description
            tool.tags = operation.get("tags", [])
            tool.metadata = operation.get("x-metadata", {})
            tool.verbose = verbose

            tools.append(tool)

    return tools


if __name__ == "__main__":
    tool = construct_api_tool(
        name="Get a post",
        description="Get a post",
        method="GET",
        headers={},
        verbose=True
    )
    print(tool)
    
    # Example usage
    tools = generate_tools_from_openapi_spec(
        "http://localhost:8050/openapi.json"
    )
    for t in tools:
        print(t.name, "-", t.description)
        print(t.args_schema)