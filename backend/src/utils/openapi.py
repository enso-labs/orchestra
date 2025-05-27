import httpx
from src.utils.logger import logger

async def fetch_openapi_spec(url: str = "http://localhost:8080/openapi.json") -> dict:
    """
    Fetch OpenAPI specification from the given URL.
    
    Args:
        url (str): URL to fetch OpenAPI spec from. Defaults to localhost:8080.
        
    Returns:
        dict: OpenAPI specification as a dictionary
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Failed to fetch OpenAPI spec: {str(e)}")
        
def fetch_openapi_spec_sync(url: str = "http://localhost:8080/openapi.json") -> dict:
	"""
	Synchronously fetch OpenAPI specification from the given URL.
	
	Args:
		url (str): URL to fetch OpenAPI spec from. Defaults to localhost:8080.
		
	Returns:
		dict: OpenAPI specification as a dictionary
	"""
	try:
		response = httpx.get(url)
		response.raise_for_status()
		return response.json()
	except httpx.HTTPError as e:
		logger.error(f"Failed to fetch OpenAPI spec: {str(e)}")
		return None


def get_response_model(name: str, spec: dict) -> type:
    """
    Get the response model for a given schema name from the OpenAPI spec.
    Maps OpenAPI types to Python types and respects required fields.
    """
    from pydantic import create_model
    from typing import Any, Optional

    type_mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "object": dict,
        "array": list,
    }

    schema = spec["components"]["schemas"][name]
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))
    fields = {}
    for prop, prop_schema in properties.items():
        openapi_type = prop_schema.get("type", "string")
        py_type = type_mapping.get(openapi_type, Any)
        if prop in required:
            fields[prop] = (py_type, ...)
        else:
            fields[prop] = (Optional[py_type], None)
    return create_model(name, **fields)