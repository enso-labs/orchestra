import httpx
import logging
import urllib.parse
from typing import Dict, Optional, Any  # Optional imports for better typing

class APIClient:
    def __init__(self, base_url: str, headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(base_url=self.base_url, headers=headers)

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        try:
            if method in ["post", "put", "patch", "delete"]:
                response = await self.client.request(
                    method,
                    endpoint,
                    json=data,
                    params=params,
                    headers=headers,
                )
            else:
                response = await self.client.request(
                    method,
                    endpoint,
                    params=params,
                    headers=headers,
                )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            full_url = urllib.parse.urljoin(self.base_url + '/', endpoint)
            logging.error(f"APIClient {method.upper()} {full_url} failed: {e}")
            raise

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None):
        return await self._request("get", endpoint, params=params, headers=headers)

    async def post(self, endpoint: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None):
        return await self._request("post", endpoint, data=data, headers=headers)

    async def put(self, endpoint: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None):
        return await self._request("put", endpoint, data=data, headers=headers)

    async def patch(self, endpoint: str, data: Dict[str, Any], headers: Optional[Dict[str, str]] = None):
        return await self._request("patch", endpoint, data=data, headers=headers)

    async def delete(self, endpoint: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None):
        return await self._request("delete", endpoint, params=params, headers=headers)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()