## Presidio service integration
#####################################
# Presidio is an open-source tool for detecting and anonymizing sensitive data.
# Documentation: https://microsoft.github.io/presidio/
# GitHub: https://github.com/microsoft/presidio/blob/main/docs/installation.md#using-docker

from httpx import AsyncClient
from typing import Optional
from pydantic import BaseModel, Field

from src.utils.logger import logger
from src.constants import PRESIDIO_ANALYZE_HOST, PRESIDIO_ANONYMIZE_HOST


class PresidioRequest(BaseModel):
    analyze: Optional[bool] = Field(default=False, description="Whether to analyze the text")
    anonymize: Optional[bool] = Field(default=False, description="Whether to anonymize the text")
    redact: Optional[bool] = Field(default=False, description="Whether to redact the text")

class PresidioConfig(BaseModel):
    analyze_host: str = Field(default=PRESIDIO_ANALYZE_HOST, description="Presidio analyze service host URL")
    anonymize_host: str = Field(default=PRESIDIO_ANONYMIZE_HOST, description="Presidio anonymize service host URL")
    api_key: Optional[str] = Field(None, description="API key for authenticating with the Presidio service", example="your_api_key_here")

class PresidioException(Exception):
    def __init__(self, message: str, results: list):
        self.message = message
        self.results = results
        super().__init__(self.message)

class PresidioService:
    
    def __init__(
        self, 
        presidio_config: Optional[PresidioConfig] = None, 
        api_key: Optional[str] = None
    ):
        self.presidio_config = presidio_config or PresidioConfig(api_key=api_key)
        self.api_key = api_key
        self.client = AsyncClient()
        
    def _get_headers(self) -> dict:
        # return {"Authorization": f"Bearer {self.api_key}"}
        return {}
    
    def _analyze_client(self, headers: dict = None) -> AsyncClient:
        headers = headers or self._get_headers()
        return AsyncClient(base_url=self.presidio_config.analyze_host, headers=headers)
    
    def _anonymize_client(self, headers: dict = None) -> AsyncClient:
        headers = headers or self._get_headers()
        return AsyncClient(base_url=self.presidio_config.anonymize_host, headers=headers)
    
    async def analyze_text(self, text: str):
        try:
            client = self._analyze_client()
            response = await client.post(
                "/analyze",
                json={"text": text, "language": "en"},
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error analyzing text: {e}")
            return e
    
    async def anonymize_text(self, text: str):
        try:
            analyze_results = await self.analyze_text(text)
            client = self._anonymize_client()
            response = await client.post(
                "/anonymize",
                json={
                    "text": text, 
                    "analyzer_results": analyze_results,
                    "anonymizers": {
                        "DEFAULT": {
                            "type": "replace",
                            "new_value": "[REDACTED]",
                        }
                    }
                },
            )
            return response.json()
        except Exception as e:
            logger.error(f"Error analyzing text: {e}")
            return e
    
    def redact_text(self, text: str):
        # Placeholder for text redaction logic
        pass
    
    
