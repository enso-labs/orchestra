## Presidio service integration
#####################################
# Presidio is an open-source tool for detecting and anonymizing sensitive data.
# Documentation: https://microsoft.github.io/presidio/
# GitHub: https://github.com/microsoft/presidio/blob/main/docs/installation.md#using-docker

from httpx import AsyncClient
from typing import Optional
from pydantic import BaseModel, Field

from src.schemas.entities import LLMRequest
from src.utils.logger import logger
from src.constants import PRESIDIO_ANALYZE_HOST, PRESIDIO_ANONYMIZE_HOST
from utils.format import format_content


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
    
async def process_presidio(params: LLMRequest, presidio_service: PresidioService):
    query = format_content(params.messages[-1].content)
    if params.presidio and params.presidio.analyze:
        if not PRESIDIO_ANALYZE_HOST:
            raise PresidioException(
                message="Please add environment variable PRESIDIO_ANALYZE_HOST",
                results=None,
            )
        analyze_results = await presidio_service.analyze_text(query)
        if analyze_results:
            logger.warning(f"Sensitive data detected in the query: {analyze_results}")
            raise PresidioException(
                message=(
                    "Query was NOT processed. Sensitive data detected in the query. "
                    "Please review the results and try again."
                ),
                results=analyze_results,
            )

    if params.presidio and params.presidio.anonymize:
        if not PRESIDIO_ANONYMIZE_HOST:
            raise PresidioException(
                message="Please add environment variable PRESIDIO_ANONYMIZE_HOST",
                results=None,
            )
        anonymized_query = await presidio_service.anonymize_text(query)
        if not anonymized_query:
            logger.warning(f"Error anonymizing the query: {anonymized_query}")
            raise PresidioException(
                message="Error anonymizing the query. Please review the results and try again.",
                results=None,
            )
        params.messages[-1].content = [{"type": "text","text": anonymized_query["text"]}]
    return params