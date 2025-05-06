from typing import Union, Dict, Any, List
import re
import httpx
import yaml
from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
from langchain_community.utilities.requests import TextRequestsWrapper
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
from langchain_community.tools.requests.tool import (
    RequestsGetTool,
    RequestsPostTool,
    RequestsPutTool,
    RequestsDeleteTool,
)

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

if __name__ == "__main__":
    tool = construct_api_tool(
        name="Get a post",
        description="Get a post",
        method="GET",
        headers={},
        verbose=True
    )
    print(tool)