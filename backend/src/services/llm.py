import time
import requests
from uuid import uuid4
from langchain_core.runnables.config import RunnableConfig
from langgraph.store.base import BaseStore

from src.constants.llm import DEFAULT_SYSTEM_PROMPT
from src.services.tool import ToolService
from src.schemas.entities.a2a import A2AServers
from src.services.db import get_store_in_memory
from src.schemas.entities.llm import LLMRequest
from src.services.assistant import AssistantService, Assistant
from src.utils.llm import filter_tool_call_models
from src.utils.logger import logger
from src.tools import init_tool_library


class LLMService:
    def __init__(
        self,
        user_id: str = None,
        store: BaseStore = get_store_in_memory(),
        tool_service: ToolService = None,
        assistant_service: AssistantService = None,
        config: RunnableConfig = None,
        ttl_seconds: int = 60 * 60 * 24,
    ):  # 24 hours
        self.user_id = user_id
        self.store = store
        self.config = config
        self.tool_service = tool_service
        self.assistant_service = assistant_service
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
            logger.info(
                f"Models fetched successfully and cached for {self._ttl} seconds"
            )
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

    async def init_tools(self, tools: list[str], a2a: dict, mcp: dict):
        tool_map = {
            t.name: t for t in init_tool_library(user_id=self.user_id)
        }  # O(n) index
        filtered_tools = (
            A2AServers(a2a=a2a).fetch_agent_cards_as_tools(
                self.config["configurable"].get("thread_id")
            )
            + await self.tool_service.mcp_tools(mcp)
            + [tool_map[name] for name in (tools or ()) if name in tool_map]
        )
        if self.user_id:
            for tool in tools:
                items = await self.tool_service.tool_repo.search(filter={"name": tool})
                if items:
                    structured_tool = items[0]
                    tool_metadata = {structured_tool.name: structured_tool.metadata}
                    self.config["metadata"] = {
                        **tool_metadata,
                        **self.config["metadata"],
                    }
                    filtered_tools.append(structured_tool)
        return filtered_tools

    def default_system_prompt(self, item: LLMRequest | Assistant) -> str:
        if not item.system_prompt:
            return DEFAULT_SYSTEM_PROMPT
        return item.system_prompt

    async def assistant(
        self,
        params: LLMRequest,
    ) -> LLMRequest:
        params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
        params.input.to_langchain_messages()
        ## Protection if not defined
        if not params.system_prompt:
            params.system_prompt = DEFAULT_SYSTEM_PROMPT

        ## Auto Assign Assistant if ID is provided
        if params.metadata.assistant_id:
            # Try user's namespace first (if user_id exists)
            assistant: Assistant | None = None
            if self.user_id:
                assistant = await self.assistant_service.get(
                    params.metadata.assistant_id
                )

            # Fall back to public namespace if not found in user namespace
            if not assistant:
                assistant = await self.assistant_service.get_public(
                    params.metadata.assistant_id
                )
                if assistant:
                    logger.info(
                        f"Loading public assistant {params.metadata.assistant_id} "
                        f"for user {self.user_id or 'anonymous'}"
                    )

            if assistant:
                assistant.system_prompt = self.default_system_prompt(assistant)
                assistant.tools = await self.init_tools(
                    assistant.tools, assistant.a2a, assistant.mcp
                )
                return assistant.to_llm_request(
                    input=params.input,
                    model=params.model,
                    metadata=params.metadata,
                )
            else:
                logger.warning(
                    f"Assistant {params.metadata.assistant_id} not found in user or public namespace"
                )

        ### Collect all tools
        params.system_prompt = self.default_system_prompt(params)
        params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
        return params


# Make sure this is a singleton used by your app (e.g., FastAPI dependency)
llm_service = LLMService()
