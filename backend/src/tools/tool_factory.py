"""
Tool construction and factory methods.

This module provides functionality for creating structured tools from various
sources including OpenAPI specifications and manual configurations.
"""

from typing import Dict, Any, List, Optional
import re
import asyncio
import yaml
from langchain_core.tools import StructuredTool
from pydantic import create_model
from pydantic.fields import Field, FieldInfo

from .http_client import get_wrapper, make_api_call_func, fetch_openapi_spec
from .schema_resolver import resolve_ref, resolve_ref_recursive, create_schema
from src.utils.logger import logger


def construct_api_tool(
    name: str,
    description: str,
    method: str,
    headers: Dict[str, Any],
    metadata: Dict[str, Any] = {},
    tags: List[str] = [],
    verbose: bool = False,
) -> StructuredTool:
    """
    Construct a structured tool for making API requests.
    
    Args:
        name: The name of the tool
        description: Description of what the tool does
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        headers: HTTP headers to include in requests
        metadata: Additional metadata for the tool
        tags: Tags to categorize the tool
        verbose: Whether to enable verbose output
        
    Returns:
        A configured StructuredTool instance
    """
    requests_wrapper = get_wrapper(headers)
    
    if method == "GET":
        async def api_request(url: str):    
            return await requests_wrapper.aget(url)
    elif method == "POST":
        async def api_request(url: str, data: Dict[str, Any]):    
            return await requests_wrapper.apost(url, data=data)
    elif method == "PUT":
        async def api_request(url: str, data: Dict[str, Any]):    
            return await requests_wrapper.aput(url, data=data)
    elif method == "PATCH":
        async def api_request(url: str, data: Dict[str, Any]):    
            return await requests_wrapper.apatch(url, data=data)
    elif method == "DELETE":
        async def api_request(url: str):    
            return await requests_wrapper.adelete(url)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
        
    api_request.__doc__ = description
    tool = StructuredTool.from_function(coroutine=api_request)
    tool.name = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())
    tool.description = description
    tool.metadata = metadata
    tool.tags = tags
    tool.verbose = verbose
    return tool


def _to_field_def(fi: FieldInfo):
    """
    Convert a FieldInfo instance to a (type, default-or-Field) tuple.
    
    Args:
        fi: The FieldInfo instance to convert
        
    Returns:
        A tuple of (annotation, Field)
    """
    default = fi.get_default()
    return fi.annotation, Field(default=default, description=fi.description)


def merge_models(summary: str, reqBody=None, pathParams=None, queryParams=None):
    """
    Merge multiple Pydantic models into a single model with metadata.
    
    Args:
        summary: Summary description for the merged model
        reqBody: Request body model
        pathParams: Path parameters model
        queryParams: Query parameters model
        
    Returns:
        A new Pydantic model with all fields merged
    """
    all_defs = {}
    
    if pathParams:
        for name, fi in pathParams.model_fields.items():
            field_annotation, field_obj = _to_field_def(fi)
            field_with_metadata = Field(
                default=field_obj.default,
                description=field_obj.description,
                metadata={'in': 'path'}
            )
            all_defs[name] = (field_annotation, field_with_metadata)
            
    if queryParams:
        for name, fi in queryParams.model_fields.items():
            field_annotation, field_obj = _to_field_def(fi)
            field_with_metadata = Field(
                default=field_obj.default,
                description=field_obj.description,
                metadata={'in': 'query'}
            )
            all_defs[name] = (field_annotation, field_with_metadata)
            
    if reqBody:
        for name, fi in reqBody.model_fields.items():
            field_annotation, field_obj = _to_field_def(fi)
            field_with_metadata = Field(
                default=field_obj.default,
                description=field_obj.description,
                metadata={'in': 'body'}
            )
            all_defs[name] = (field_annotation, field_with_metadata)
            
    if all_defs:
        model_name = summary.replace(" ", "")
        return create_model(model_name, **all_defs)
    else:
        return None


def get_args_schema(spec: Dict[str, Any], operation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract and create argument schema from OpenAPI operation specification.
    
    Args:
        spec: The full OpenAPI specification
        operation: The specific operation definition
        
    Returns:
        A Pydantic model class for the operation arguments
        
    Raises:
        Exception: If schema extraction fails
    """
    try:
        reqBody = None
        pathParams = None
        queryParams = None
        
        if operation.get('requestBody'):
            ref = operation.get('requestBody').get('content').get('application/json').get('schema').get('$ref')
            if ref:
                schema = resolve_ref(spec, ref)
                fully_resolved_schema = resolve_ref_recursive(spec, schema)
                reqBody = create_schema(fully_resolved_schema.get('title'), fully_resolved_schema.get('properties'))
            else:
                model_title = operation.get('operationId').replace("_", " ").replace("-", " ").title().replace(" ", "") + "Args"
                schema = operation.get('requestBody').get('content').get('application/json').get('schema')
                
        model = create_schema(model_title or "DynamicArgs", schema)
        return model
    except Exception as e:
        logger.exception(f"Failed to get args schema for {operation.get('operationId')}: {e}")
        raise Exception(f"Failed to get args schema for {operation.get('operationId')}: {e}")


def generate_tools_from_openapi_json(
    openapi_spec: Dict[str, Any],
    base_url: Optional[str] = None,
    headers: Optional[Dict[str, Any]] = None,
    verbose: bool = False,
) -> List[StructuredTool]:
    """
    Generate a list of StructuredTool instances for each endpoint defined in an OpenAPI spec provided as JSON.

    Args:
        openapi_spec: The OpenAPI specification as a dictionary.
        base_url: Optional base URL to override the server URL from the spec.
        headers: Optional default headers for all requests.
        verbose: Whether to set verbose=True on each tool.

    Returns:
        A list of StructuredTool objects, one per (path, method) in the spec.
        
    Raises:
        ValueError: If no server URL is found and no base_url is provided
    """
    spec = openapi_spec

    # Determine base server URL
    server_url = base_url or spec.get("servers", [{}])[0].get("url", "")
    if not server_url:
        raise ValueError("No server URL found in spec and no base_url provided")

    tools: List[StructuredTool] = []
    for path, operations in spec.get("paths", {}).items():
        for http_method, operation in operations.items():
            method = http_method.upper()
            yaml_str = yaml.dump(operation, sort_keys=False, indent=2, default_flow_style=False)
            name = re.sub(r'[^a-zA-Z0-9_]', '_', operation.get("operationId").lower())

            # Use summary or description from spec
            description = (
                "You have access to an API to help answer user queries. \n\n"
                "Here is documentation on the API: \n\n"
                "~~~yaml\n"
                "{yaml_str}"
                "~~~".format(yaml_str=yaml_str)
            )

            # Construct full URL for this endpoint
            full_url = server_url.rstrip("/") + path

            # Create the coroutine function for this endpoint
            api_func = make_api_call_func(
                method, 
                full_url, 
                headers or {}, 
                description,
            )

            # Build the tool
            tool = StructuredTool.from_function(coroutine=api_func)
            tool.name = name
            tool.description = description
            tool.tags = operation.get("tags", [])
            tool.verbose = verbose

            tools.append(tool)

    return tools


def generate_tools_from_openapi_spec(
    openapi_url: str,
    headers: Optional[Dict[str, Any]] = None,
    verbose: bool = False,
) -> List[StructuredTool]:
    """
    Generate a list of StructuredTool instances for each endpoint defined in an OpenAPI spec.

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
            args_schema = get_args_schema(spec, operation)
            name = re.sub(r'[^a-zA-Z0-9_]', '_', operation.get("summary").lower())

            # Use summary or description from spec
            description = (
                operation.get("summary")
                or operation.get("description", f"{method} {path}")
            )

            # Construct full URL for this endpoint
            full_url = server_url.rstrip("/") + path

            # Create the coroutine function for this endpoint
            api_func = make_api_call_func(
                method, 
                full_url, 
                headers or {}, 
                description,
            )

            # Build the tool
            tool = StructuredTool.from_function(coroutine=api_func, args_schema=args_schema)
            tool.name = name
            tool.description = description
            tool.tags = operation.get("tags", [])
            tool.metadata = operation.get("x-metadata", {})
            tool.verbose = verbose

            tools.append(tool)

    return tools