"""
API tools module - main entry point for API-related functionality.

This module provides a simplified interface for API tool creation and OpenAPI
specification handling by importing and re-exposing functionality from
specialized submodules.

This maintains backward compatibility while providing better code organization.
"""

# Import all functions from specialized modules to maintain backward compatibility
from .openapi_spec import (
    get_api_spec,
    openapi_from_url,
    _get_schema,
    _add_endpoint_to_spec
)

from .http_client import (
    get_base_tool,
    get_wrapper,
    fetch_openapi_spec,
    make_api_call_func
)

from .schema_resolver import (
    resolve_ref,
    resolve_ref_recursive,
    get_field_type,
    create_schema,
    json_schema_to_base_model
)

from .tool_factory import (
    construct_api_tool,
    merge_models,
    get_args_schema,
    generate_tools_from_openapi_json,
    generate_tools_from_openapi_spec,
    _to_field_def
)

# Re-export necessary dependencies for backward compatibility
from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
from langchain_community.utilities.requests import TextRequestsWrapper

################################################################################
### Example Usage (maintained for backward compatibility)
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