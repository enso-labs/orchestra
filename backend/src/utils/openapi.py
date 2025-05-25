import httpx

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
		raise Exception(f"Failed to fetch OpenAPI spec: {str(e)}")
