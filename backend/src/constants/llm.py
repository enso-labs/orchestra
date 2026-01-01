from enum import Enum
from src.services.prompt import fetch_prompt
from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL,
    GROQ_API_KEY,
    GOOGLE_API_KEY,
    XAI_API_KEY,
)
from src.utils.logger import logger


class ChatModels(str, Enum):
    if OPENAI_API_KEY:
        OPENAI_REASONING_03 = "openai:o3"
        OPENAI_REASONING_04_MINI = "openai:o4-mini"
        OPENAI_GPT_4_1_NANO = "openai:gpt-4.1-nano"
        OPENAI_GPT_4_1_MINI = "openai:gpt-4.1-mini"
        OPENAI_GPT_5_NANO = "openai:gpt-5-nano"
        OPENAI_GPT_5_MINI = "openai:gpt-5-mini"
        OPENAI_GPT_5 = "openai:gpt-5"
        OPENAI_GPT_5_1 = "openai:gpt-5.1"
        OPENAI_GPT_5_2 = "openai:gpt-5.2"
        OPENAI_GPT_5_2_CHAT_LATEST = "openai:gpt-5.2-chat-latest"
        OPENAI_GPT_5_2_PRO = "openai:gpt-5.2-pro"
        # OPENAI_GPT_5_CODEX = "openai:gpt-5-codex"
    if ANTHROPIC_API_KEY:
        ANTHROPIC_CLAUDE_3_7_SONNET = "anthropic:claude-3-7-sonnet-latest"
        ANTHROPIC_CLAUDE_4_SONNET = "anthropic:claude-sonnet-4"
        ANTHROPIC_CLAUDE_4_OPUS = "anthropic:claude-opus-4-1"
        ANTHROPIC_CLAUDE_4_5_HAIKU = "anthropic:claude-haiku-4-5"
        ANTHROPIC_CLAUDE_4_5_SONNET = "anthropic:claude-sonnet-4-5"
    if XAI_API_KEY:
        XAI_GROK_4_1_FAST = "xai:grok-4-1-fast"
        XAI_GROK_4_1_FAST_NON_REASONING = "xai:grok-4-1-fast-non-reasoning"
        XAI_GROK_4 = "xai:grok-4"
        XAI_GROK_4_FAST = "xai:grok-4-fast"
        XAI_GROK_4_FAST_NON_REASONING = "xai:grok-4-fast-non-reasoning"
        XAI_GROK_CODE_FAST_1 = "xai:grok-code-fast-1"
    if GOOGLE_API_KEY:
        GOOGLE_GEMINI_2_5_FLASH_LITE = "google_genai:gemini-2.5-flash-lite"
        GOOGLE_GEMINI_2_5_FLASH = "google_genai:gemini-2.5-flash"
        GOOGLE_GEMINI_2_5_PRO = "google_genai:gemini-2.5-pro"
        GOOGLE_GEMINI_FLASH_LITE_LATEST = "google_genai:gemini-flash-lite-latest"
        GOOGLE_GEMINI_3_FLASH_PREVIEW = "google_genai:gemini-3-flash-preview"
    if GROQ_API_KEY:
        GROQ_OPENAI_GPT_OSS_120B = "groq:openai/gpt-oss-120b"
        GROQ_LLAMA_3_3_70B_VERSATILE = "groq:llama-3.3-70b-versatile"


def get_ollama_models():
    models = []
    try:
        import requests

        response = requests.get(f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=3)
        if response.ok:
            data = response.json()
            tags = data.get("models", []) if isinstance(data, dict) else []
            for tag in tags:
                model_name = tag.get("name")
                if model_name:
                    models.append(f"ollama:{model_name}")
    except Exception as e:
        logger.error(f"Error getting Ollama models: {e}")
        pass
    return models


def get_all_models():
    from src.services.llm import llm_service  # Lazy import to avoid circular dependency

    models = []
    if OPENAI_API_KEY:
        models.extend(llm_service.model_by_provider(provider="openai"))
    if ANTHROPIC_API_KEY:
        models.extend(llm_service.model_by_provider(provider="anthropic"))
    if GOOGLE_API_KEY:
        models.extend(llm_service.model_by_provider(provider="google"))
    if GROQ_API_KEY:
        models.extend(llm_service.model_by_provider(provider="groq"))
    if XAI_API_KEY:
        models.extend(llm_service.model_by_provider(provider="xai"))
    if OLLAMA_BASE_URL:
        models.extend(get_ollama_models())
    return sorted(models)


def get_free_models():
    models = []
    if OPENAI_API_KEY:
        models.extend(
            [
                ChatModels.OPENAI_GPT_4_1_NANO.value,
                ChatModels.OPENAI_GPT_4_1_MINI.value,
                ChatModels.OPENAI_GPT_5_NANO.value,
                ChatModels.OPENAI_GPT_5_MINI.value,
            ]
        )
    if ANTHROPIC_API_KEY:
        models.append(ChatModels.ANTHROPIC_CLAUDE_4_5_HAIKU.value)
    if GOOGLE_API_KEY:
        models.append(ChatModels.GOOGLE_GEMINI_3_FLASH_PREVIEW.value)
    if GROQ_API_KEY:
        models.append(ChatModels.GROQ_OPENAI_GPT_OSS_120B.value)
    if XAI_API_KEY:
        models.append(ChatModels.XAI_GROK_4_1_FAST.value)
    if OLLAMA_BASE_URL:
        models.extend(get_ollama_models())
    return sorted(models)


def get_system_prompt():
    """
    Fetch and return the default system prompt as a string.

    Returns:
        str: The system prompt content, or a fallback message if fetching fails.
    """
    try:
        prompt = fetch_prompt("ruska-default")
        # Try to extract content from LangSmith Prompt object
        if hasattr(prompt, "content"):
            return prompt.content
        elif hasattr(prompt, "template"):
            return prompt.template
        else:
            prompt = prompt.format_prompt()
            content = prompt.messages[-1].content
            return content
    except Exception as e:
        logger.error(f"Error fetching system prompt: {e}")
        return "You are a helpful AI assistant."


def get_default_chat_model():
    """Get the default chat model based on available API keys."""
    if OPENAI_API_KEY:
        return ChatModels.OPENAI_GPT_4_1_MINI.value
    if GOOGLE_API_KEY:
        return ChatModels.GOOGLE_GEMINI_3_FLASH_PREVIEW.value
    if XAI_API_KEY:
        return ChatModels.XAI_GROK_4_1_FAST.value
    
    if ANTHROPIC_API_KEY:
        return ChatModels.ANTHROPIC_CLAUDE_4_5_HAIKU.value
    if GROQ_API_KEY:
        return ChatModels.GROQ_LLAMA_3_3_70B_VERSATILE.value
    return None


def get_default_low_cost_model():
    """Get the default low-cost chat model based on available API keys."""
    if GOOGLE_API_KEY:
        return ChatModels.GOOGLE_GEMINI_3_FLASH_PREVIEW.value
    if OPENAI_API_KEY:
        return ChatModels.OPENAI_GPT_5_NANO.value
    if XAI_API_KEY:
        return ChatModels.XAI_GROK_4_1_FAST.value
    if ANTHROPIC_API_KEY:
        return ChatModels.ANTHROPIC_CLAUDE_4_5_HAIKU.value
    if GROQ_API_KEY:
        return ChatModels.GROQ_OPENAI_GPT_OSS_120B.value
    return None


DEFAULT_CHAT_MODEL = get_default_chat_model()
DEFAULT_CHAT_MODEL_BASIC = get_default_low_cost_model()
DEFAULT_CHAT_MODEL_ADVANCED = ChatModels.OPENAI_GPT_5_2.value

# Initialize default system prompt with error handling to prevent import-time failures
try:
    DEFAULT_SYSTEM_PROMPT = get_system_prompt()
except Exception as e:
    logger.error(f"Failed to initialize DEFAULT_SYSTEM_PROMPT at import time: {e}")
    DEFAULT_SYSTEM_PROMPT: str = "You are a helpful AI assistant."
