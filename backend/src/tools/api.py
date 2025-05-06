from typing import Union, Dict, Any, List
import httpx
import yaml
from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
from langchain_community.utilities.requests import TextRequestsWrapper

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

if __name__ == "__main__":
    # print(api_spec)
    print(system_message)
    # print(tools)