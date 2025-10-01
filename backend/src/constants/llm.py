from enum import Enum

from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL,
    GROQ_API_KEY,
    GEMINI_API_KEY,
    GOOGLE_API_KEY,
)
from src.repos.user_repo import UserRepo


class ModelName(str, Enum):
    OPENAI_GPT_4O = "openai:gpt-4o"
    OPENAI_GPT_4O_MINI = "openai:gpt-4o-mini"
    OPENAI_GPT_4_1 = "openai:gpt-4.1"
    OPENAI_GPT_4_5 = "openai:gpt-4.5-preview"
    OPENAI_REASONING_O3 = "openai:o3"
    OPENAI_REASONING_O4_MINI = "openai:o4-mini"
    OPENAI_EMBEDDING_LARGE = "openai:text-embedding-3-large"
    ANTHROPIC_CLAUDE_3_5_SONNET = "anthropic:claude-3-5-sonnet-latest"
    ANTHROPIC_CLAUDE_3_7_SONNET_LATEST = "anthropic:claude-3-7-sonnet-latest"
    ANTHROPIC_CLAUDE_4_SONNET = "anthropic:claude-sonnet-4-20250514"
    ANTHROPIC_CLAUDE_4_OPUS = "anthropic:claude-opus-4-20250514"
    OLLAMA_LLAMA_3_2_VISION = "ollama:llama3.2-vision"
    OLLAMA_DEEPSEEK_R1_8B = "ollama:deepseek-r1:8b"
    OLLAMA_DEEPSEEK_R1_14B = "ollama:deepseek-r1:14b"
    GROQ_DEEPSEEK_R1_DISTILL_LLAMA_70B = "groq:deepseek-r1-distill-llama-70b"
    GROQ_LLAMA_3_3_70B_VERSATILE = "groq:llama-3.3-70b-versatile"
    GROQ_LLAMA_3_3_70B_SPECDEC = "groq:llama-3.3-70b-specdec"
    GROQ_LLAMA_3_2_90B_VISION = "groq:llama-3.2-90b-vision-preview"
    GEMINI_PRO_1_5 = "google_genai:gemini-1.5-pro"
    GEMINI_PRO_2 = "google_genai:gemini-2-pro"


class ChatModels(str, Enum):
    if OPENAI_API_KEY:
        OPENAI_GPT_5_NANO = "openai:gpt-5-nano"
        OPENAI_GPT_5_MINI = "openai:gpt-5-mini"
        OPENAI_GPT_5 = "openai:gpt-5"
        OPENAI_GPT_5_CODEX = "openai:gpt-5-codex"
    if ANTHROPIC_API_KEY:
        ANTHROPIC_CLAUDE_3_7_SONNET = "anthropic:claude-3-7-sonnet-20250219"
        ANTHROPIC_CLAUDE_4_SONNET = "anthropic:claude-sonnet-4-20250514"
        ANTHROPIC_CLAUDE_4_OPUS = "anthropic:claude-opus-4-20250514"
        ANTHROPIC_CLAUDE_4_1_OPUS = "anthropic:claude-opus-4-1-20250805"
        ANTHROPIC_CLAUDE_4_5_SONNET = "anthropic:claude-sonnet-4-5-20250929"
    if GOOGLE_API_KEY:
        XAI_GROK_4 = "xai:grok-4"
        XAI_GROK_4_FAST = "xai:grok-4-fast"
        XAI_GROK_4_FAST_NON_REASONING = "xai:grok-4-fast-non-reasoning"
        XAI_GROK_CODE_FAST_1 = "xai:grok-code-fast-1"
    if GOOGLE_API_KEY:
        GOOGLE_GEMINI_2_5_FLASH_LITE = "google_genai:gemini-2.5-flash-lite"
        GOOGLE_GEMINI_2_5_FLASH = "google_genai:gemini-2.5-flash"
        GOOGLE_GEMINI_2_5_PRO = "google_genai:gemini-2.5-pro"
    if GROQ_API_KEY:
        GROQ_OPENAI_GPT_OSS_120B = "groq:openai/gpt-oss-120b"
        GROQ_LLAMA_3_3_70B_VERSATILE = "groq:llama-3.3-70b-versatile"
    if OLLAMA_BASE_URL:
        OLLAMA_QWEN3 = "ollama:qwen3"


MODEL_CONFIG = [
    {
        "id": ModelName.OPENAI_GPT_4O,
        "label": "GPT-4o",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_GPT_4O_MINI,
        "label": "GPT-4o Mini",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_GPT_4_1,
        "label": "GPT-4.1",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_GPT_4_5,
        "label": "GPT-4.5",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_REASONING_O4_MINI,
        "label": "o4 Mini",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": True,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_REASONING_O3,
        "label": "o3",
        "provider": "openai",
        "metadata": {
            "system_message": True,
            "reasoning": True,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OPENAI_EMBEDDING_LARGE,
        "label": "Text Embedding 3 Large",
        "provider": "openai",
        "metadata": {
            "system_message": False,
            "reasoning": False,
            "tool_calling": False,
            "multimodal": False,
            "embedding": True,
        },
    },
    {
        "id": ModelName.ANTHROPIC_CLAUDE_3_5_SONNET,
        "label": "Claude 3.5 Sonnet",
        "provider": "anthropic",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.ANTHROPIC_CLAUDE_3_7_SONNET_LATEST,
        "label": "Claude 3.7 Sonnet",
        "provider": "anthropic",
        "metadata": {
            "system_message": True,
            "reasoning": True,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.ANTHROPIC_CLAUDE_4_SONNET,
        "label": "Claude 4 Sonnet",
        "provider": "anthropic",
        "metadata": {
            "system_message": True,
            "reasoning": True,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.ANTHROPIC_CLAUDE_4_OPUS,
        "label": "Claude 4 Opus",
        "provider": "anthropic",
        "metadata": {
            "system_message": True,
            "reasoning": True,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OLLAMA_LLAMA_3_2_VISION,
        "label": "Llama 3.2 Vision",
        "provider": "ollama",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OLLAMA_DEEPSEEK_R1_14B,
        "label": "DeepSeek R1 14B",
        "provider": "ollama",
        "metadata": {
            "system_message": False,
            "reasoning": True,
            "tool_calling": False,
            "multimodal": False,
            "embedding": False,
        },
    },
    {
        "id": ModelName.OLLAMA_DEEPSEEK_R1_8B,
        "label": "DeepSeek R1 8B",
        "provider": "ollama",
        "metadata": {
            "system_message": False,
            "reasoning": True,
            "tool_calling": False,
            "multimodal": False,
            "embedding": False,
        },
    },
    # {
    #     "id": ModelName.GROQ_DEEPSEEK_R1_DISTILL_LLAMA_70B,
    #     "label": "DeepSeek R1 Distill Llama 70B",
    #     "provider": "groq",
    #     "metadata": {
    #         "system_message": True,
    #         "reasoning": False,
    #         "tool_calling": True,
    #         "multimodal": True,
    #         "embedding": False,
    #     }
    # },
    {
        "id": ModelName.GROQ_LLAMA_3_3_70B_VERSATILE,
        "label": "Llama 3.3 70B Versatile",
        "provider": "groq",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.GROQ_LLAMA_3_2_90B_VISION,
        "label": "Llama 3.2 90B Vision",
        "provider": "groq",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": False,
            "multimodal": True,
            "embedding": False,
        },
    },
    {
        "id": ModelName.GEMINI_PRO_1_5,
        "label": "Gemini 1.5 Pro",
        "provider": "google",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": False,  # TODO: Add tool calling, bug in google lib
            # "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        },
    },
    # {
    #     "id": ModelName.GEMINI_PRO_2,
    #     "label": "Gemini 2 Pro",
    #     "provider": "google",
    #     "metadata": {
    #         "system_message": True,
    #         "reasoning": False,
    #         "tool_calling": False,
    #         "multimodal": True,
    #         "embedding": False,
    #     }
    # }
]


def get_available_models():
    available_models = []
    for model in MODEL_CONFIG:
        provider = model["provider"]

        # Check if the provider's API key exists
        if (
            (provider == "openai" and OPENAI_API_KEY)
            or (provider == "anthropic" and ANTHROPIC_API_KEY)
            or (provider == "ollama" and OLLAMA_BASE_URL)
            or (provider == "groq" and GROQ_API_KEY)
            or (provider == "google" and GEMINI_API_KEY)
        ):
            available_models.append(model)

    return available_models


def get_public_models():
    public_models = []

    # Only allow specific models for public use
    allowed_public_models = [ModelName.GEMINI_PRO_1_5, ModelName.OPENAI_GPT_4O_MINI]

    for model in MODEL_CONFIG:
        # Skip models not in our allowed list
        if model["id"] not in allowed_public_models:
            continue

        public_models.append(model)

    return public_models
