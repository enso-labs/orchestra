import time
import requests
from src.utils.llm import filter_tool_call_models
from src.utils.logger import logger


class LLMService:
    def __init__(self, ttl_seconds: int = 60 * 60 * 24):  # 24 hours
        self._models_cache = None
        self._cache_time = 0.0
        self._ttl = ttl_seconds
        
    def _reset_cache(self):
        """Force-clear the model cache so the next call re-fetches."""
        self._models_cache = None
        self._cache_time = 0.0
    
    def _fetch_models(self):
        """Fetch models from API with 24h caching."""
        now = time.time()

        # Serve from cache if still fresh
        if self._models_cache is not None and (now - self._cache_time) < self._ttl:
            return self._models_cache
        
        try:
            response = requests.get("https://models.dev/api.json", timeout=3)
            response.raise_for_status()  # Raises exception for 4xx/5xx status codes
            self._models_cache = response.json() or {}
            self._cache_time = now
            logger.info(f"Models fetched successfully and cached for {self._ttl} seconds")
        except (requests.RequestException, ValueError) as e:
            logger.warning(f"Failed to fetch models: {e}")
            # Keep old cache if present; otherwise empty dict
            if self._models_cache is None:
                self._models_cache = {}
        
        return self._models_cache
    
    def model_by_provider(self, provider: str):
        """Get tool-calling models for a given provider."""
        all_models = self._fetch_models()
        
        provider_data = all_models.get(provider, {}) or {}
        provider_models = provider_data.get("models", []) or []
        
        if not provider_models:
            logger.info(f"No models found for provider: {provider}")
            return []
        
        # Filter for tool-calling models
        tool_models = filter_tool_call_models(provider_models)
        logger.info(f"Found {len(tool_models)} tool calling models for {provider}")
        
        # Normalize provider name
        normalized_provider = "google_genai" if provider == "google" else provider
        
        return [f"{normalized_provider}:{model}" for model in tool_models]


# Make sure this is a singleton used by your app (e.g., FastAPI dependency)
llm_service = LLMService()
