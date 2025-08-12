"""
HTTP client wrappers and request handling utilities.

This module provides abstractions for making HTTP requests with various
configurations and handling different HTTP methods.
"""

from typing import Dict, Any, Optional
import json
from langchain_community.utilities.requests import GenericRequestsWrapper
from langchain_core.tools import BaseTool
from langchain_community.tools.requests.tool import BaseRequestsTool

from src.utils.logger import logger


def get_base_tool(headers: Dict[str, Any]) -> BaseTool:
    """
    Create a base requests tool with the specified headers.
    
    Args:
        headers: HTTP headers to include in requests
        
    Returns:
        A configured BaseRequestsTool instance
    """
    requests_wrapper = GenericRequestsWrapper(headers=headers)
    base_tool = BaseRequestsTool(requests_wrapper=requests_wrapper)
    return base_tool


def get_wrapper(headers: Dict[str, Any]) -> GenericRequestsWrapper:
    """
    Create a generic requests wrapper with the specified headers.
    
    Args:
        headers: HTTP headers to include in requests
        
    Returns:
        A configured GenericRequestsWrapper instance
    """
    requests_wrapper = GenericRequestsWrapper(headers=headers)
    return requests_wrapper


async def fetch_openapi_spec(
    url: str,
    headers: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Fetch an OpenAPI specification JSON from a given URL asynchronously.
    
    Args:
        url: The URL to fetch the OpenAPI spec from
        headers: Optional HTTP headers to include in the request
        
    Returns:
        The OpenAPI specification as a dictionary
    """
    wrapper = GenericRequestsWrapper(headers=headers or {})
    raw = await wrapper.aget(url)
    return json.loads(raw)


def make_api_call_func(
    method: str,
    url: str,
    headers: Dict[str, Any],
    description: str,
    path_params: Optional[Dict[str, Any]] = None,
) -> Any:
    """
    Factory that creates an async function for the given HTTP method and URL.
    
    Args:
        method: HTTP method (GET, POST, PUT, DELETE)
        url: Base URL for the API endpoint
        headers: HTTP headers to include in the request
        description: Description of what the API call does
        path_params: Optional dictionary of path parameters to format into the URL
        
    Returns:
        An async function that performs the API call
    """
    async def api_call(event: str, data: Dict[str, Any] = {}):
        wrapper = GenericRequestsWrapper(headers=headers)
        # Format URL with path parameters if provided
        formatted_url = url.format(**(path_params or {}))
        try:
            if method == "GET":
                response = await wrapper.aget(formatted_url)
            elif method == "POST":
                response = await wrapper.apost(formatted_url, data={'data': data, "event": event})
            elif method == "PUT":
                response = await wrapper.aput(formatted_url, data={'data': data, "event": event})
            elif method == "PATCH":
                response = await wrapper.apatch(formatted_url, data={'data': data, "event": event})
            elif method == "DELETE":
                response = await wrapper.adelete(formatted_url)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            logger.debug(f"API Response for {method} {formatted_url}: {response}")
            return response
            
        except Exception as e:
            logger.error(f"API call failed for {method} {formatted_url}: {str(e)}")
            raise

    api_call.__doc__ = description
    return api_call