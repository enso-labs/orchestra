from enum import Enum
from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL,
    GROQ_API_KEY,
    GOOGLE_API_KEY,
)


class ChatModels(str, Enum):
    if OPENAI_API_KEY:
        OPENAI_GPT_5_NANO = "openai:gpt-5-nano"
        OPENAI_GPT_5_MINI = "openai:gpt-5-mini"
        OPENAI_GPT_5 = "openai:gpt-5"
        # OPENAI_GPT_5_CODEX = "openai:gpt-5-codex"
    if ANTHROPIC_API_KEY:
        ANTHROPIC_CLAUDE_3_7_SONNET = "anthropic:claude-3-7-sonnet-20250219"
        ANTHROPIC_CLAUDE_4_SONNET = "anthropic:claude-sonnet-4-20250514"
        ANTHROPIC_CLAUDE_4_OPUS = "anthropic:claude-opus-4-20250514"
        # ANTHROPIC_CLAUDE_4_1_OPUS = "anthropic:claude-opus-4-1-20250805"
        # ANTHROPIC_CLAUDE_4_5_SONNET = "anthropic:claude-sonnet-4-5-20250929"
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
