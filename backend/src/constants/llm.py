from enum import Enum

from src.constants import UserTokenKey
from src.repos.user_repo import UserRepo

class ModelName(str, Enum):
    OPENAI_GPT_4O = "openai-gpt-4o"
    OPENAI_GPT_4O_MINI = "openai-gpt-4o-mini"
    OPENAI_REASONING_O1 = "openai-o1-preview"
    OPENAI_REASONING_O1_MINI = "openai-o1-mini"
    OPENAI_REASONING_O3_MINI = "openai-o3-mini"
    OPENAI_EMBEDDING_LARGE = "openai-text-embedding-3-large"
    ANTHROPIC_CLAUDE_3_5_SONNET = "anthropic-claude-3-5-sonnet-20240620"
    OLLAMA_LLAMA_3_2_VISION = "ollama-llama3.2-vision"
    OLLAMA_DEEPSEEK_R1_8B = "ollama-deepseek-r1:8b"
    OLLAMA_DEEPSEEK_R1_14B = "ollama-deepseek-r1:14b"
    GROQ_DEEPSEEK_R1_DISTILL_LLAMA_70B = "deepseek-r1-distill-llama-70b"
    GROQ_LLAMA_3_3_70B_VERSATILE = "groq-llama-3.3-70b-versatile"
    GROQ_LLAMA_3_3_70B_SPECDEC = "groq-llama-3.3-70b-specdec"
    GROQ_LLAMA_3_2_90B_VISION = "groq-llama-3.2-90b-vision-preview"
    GEMINI_PRO_1_5 = "google-gemini-1.5-pro"
    GEMINI_PRO_2 = "google-gemini-2-pro"
    
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
        }
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
        }
    },
    {
        "id": ModelName.OPENAI_REASONING_O1,
        "label": "o1",
        "provider": "openai",
        "metadata": {
            "system_message": False,
            "reasoning": True,
            "tool_calling": False,
            "multimodal": False,
            "embedding": False,
        }
    },
    {
        "id": ModelName.OPENAI_REASONING_O1_MINI,
        "label": "o1 Mini",
        "provider": "openai",
        "metadata": {
            "system_message": False,
            "reasoning": True,
            "tool_calling": False,
            "multimodal": False,
            "embedding": False,
        }
    },
    {
        "id": ModelName.OPENAI_REASONING_O3_MINI,
        "label": "o3 Mini",
        "provider": "openai",
        "metadata": {
            "system_message": False,
            "reasoning": True,
            "tool_calling": False,
            "multimodal": False,
            "embedding": False,
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
    },
    {
        "id": ModelName.GROQ_LLAMA_3_2_90B_VISION,
        "label": "Llama 3.2 90B Vision",
        "provider": "groq",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
            "multimodal": True,
            "embedding": False,
        }
    },
    {
        "id": ModelName.GEMINI_PRO_1_5,
        "label": "Gemini 1.5 Pro",
        "provider": "google",
        "metadata": {
            "system_message": True,
            "reasoning": False,
            "tool_calling": True,
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

def get_available_models(user_repo: UserRepo, user_id: str):
    available_models = []
    user_tokens = {token["key"] for token in user_repo.get_all_tokens(user_id)}
    for model in MODEL_CONFIG:
        provider = model["provider"]
        
        # Check if the provider's API key exists
        if (
            (provider == "openai" and UserTokenKey.OPENAI_API_KEY.name in user_tokens) or
            (provider == "anthropic" and UserTokenKey.ANTHROPIC_API_KEY.name in user_tokens) or
            (provider == "ollama" and UserTokenKey.OLLAMA_BASE_URL.name in user_tokens) or
            (provider == "groq" and UserTokenKey.GROQ_API_KEY.name in user_tokens) or
            (provider == "google" and UserTokenKey.GEMINI_API_KEY.name in user_tokens)
        ):
            available_models.append(model)
    
    return available_models