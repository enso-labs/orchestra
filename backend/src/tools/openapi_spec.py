"""
OpenAPI specification generation utilities.

This module provides functionality for generating and fetching OpenAPI specifications
from various sources including URLs and dynamic endpoint discovery.
"""

from typing import Dict, Any, List, Union
import httpx
import yaml


def _get_schema(response_json: Union[dict, list]) -> dict:
    """
    Extract schema information from a JSON response.
    
    Args:
        response_json: The JSON response to analyze
        
    Returns:
        A dictionary mapping field names to their type names
    """
    if isinstance(response_json, list):
        response_json = response_json[0] if response_json else {}
    return {key: type(value).__name__ for key, value in response_json.items()}


def _add_endpoint_to_spec(
    base_url: str,
    endpoint: str,
    common_query_parameters: List[Dict[str, Any]],
    openapi_spec: Dict[str, Any]
) -> None:
    """
    Add an endpoint to an OpenAPI specification by fetching its schema.
    
    Args:
        base_url: The base URL of the API
        endpoint: The endpoint path to add
        common_query_parameters: Common query parameters for all endpoints
        openapi_spec: The OpenAPI spec dictionary to modify
    """
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
    """
    Generate an OpenAPI specification for a given API.
    
    Args:
        title: The title of the API
        version: The version of the API
        base_url: The base URL of the API
        endpoints: List of endpoint paths to include
        common_query_parameters: Common query parameters for all endpoints
        description: Description of the API
        paths: Additional paths to include in the spec
        
    Returns:
        The OpenAPI specification as a YAML string
    """
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
    """
    Fetch an OpenAPI specification from a URL.
    
    Args:
        url: The URL to fetch the OpenAPI spec from
        
    Returns:
        The OpenAPI specification as a YAML string
        
    Raises:
        Exception: If the request fails or returns a non-200 status code
    """
    try:
        response = httpx.get(url)
        if response.status_code == 200:
            return yaml.dump(response.json(), sort_keys=False)
        else:
            raise Exception(f"Failed to get OpenAPI spec from {url}")
    except Exception as e:
        raise Exception(f"Failed to get OpenAPI spec from {url}: {e}")