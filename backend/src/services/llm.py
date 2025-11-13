import requests

from src.utils.llm import filter_tool_call_models
from src.utils.logger import logger

class LLMService:

	def _all_models(self):
		response = requests.get(f"https://models.dev/api.json", timeout=3)
		if response.ok:
			data = response.json()
			return data
		return []
	
	def model_by_provider(self, provider: str):
		models = self._all_models()
		provider_models = models.get(provider, []).get("models", [])
		tool_models = filter_tool_call_models(provider_models)
		logger.info(f"Found {len(tool_models)} tool calling models for {provider}")
		if provider == "google":
			provider = "google_genai"
		return [f"{provider}:{model}" for model in tool_models]



llm_service = LLMService()