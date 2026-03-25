"""Per-model token pricing (USD per 1M tokens). Updated 2026-03."""

from typing import TypedDict

from src.utils.logger import logger


class ModelPricing(TypedDict):
    input: float  # USD per 1M input tokens
    output: float  # USD per 1M output tokens


# Pricing per 1M tokens
PRICING_TABLE: dict[str, ModelPricing] = {
    # OpenAI
    "openai:o3": {"input": 2.00, "output": 8.00},
    "openai:o4-mini": {"input": 1.10, "output": 4.40},
    "openai:gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "openai:gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "openai:gpt-5-nano": {"input": 0.15, "output": 0.60},
    "openai:gpt-5-mini": {"input": 0.50, "output": 2.00},
    "openai:gpt-5": {"input": 2.00, "output": 8.00},
    "openai:gpt-5.1": {"input": 2.50, "output": 10.00},
    "openai:gpt-5.2": {"input": 3.00, "output": 12.00},
    "openai:gpt-5.2-chat-latest": {"input": 3.00, "output": 12.00},
    "openai:gpt-5.2-pro": {"input": 15.00, "output": 60.00},
    # Anthropic
    "anthropic:claude-3-7-sonnet-latest": {"input": 3.00, "output": 15.00},
    "anthropic:claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "anthropic:claude-opus-4-1": {"input": 15.00, "output": 75.00},
    "anthropic:claude-haiku-4-5": {"input": 0.80, "output": 4.00},
    "anthropic:claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    # xAI
    "xai:grok-4-1-fast": {"input": 3.00, "output": 12.00},
    "xai:grok-4-1-fast-non-reasoning": {"input": 3.00, "output": 12.00},
    "xai:grok-4": {"input": 3.00, "output": 15.00},
    "xai:grok-4-fast": {"input": 5.00, "output": 25.00},
    "xai:grok-4-fast-non-reasoning": {"input": 5.00, "output": 25.00},
    "xai:grok-code-fast-1": {"input": 3.00, "output": 12.00},
    # Google
    "google_genai:gemini-2.5-flash-lite": {"input": 0.02, "output": 0.10},
    "google_genai:gemini-2.5-flash": {"input": 0.15, "output": 0.60},
    "google_genai:gemini-2.5-pro": {"input": 1.25, "output": 10.00},
    "google_genai:gemini-flash-lite-latest": {"input": 0.02, "output": 0.10},
    "google_genai:gemini-3-flash-preview": {"input": 0.15, "output": 0.60},
    # Groq
    "groq:llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "groq:openai/gpt-oss-120b": {"input": 0.59, "output": 0.79},
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated cost in USD for a model call."""
    pricing = PRICING_TABLE.get(model)
    if pricing is None:
        logger.debug(f"pricing_fallback model={model} — not in pricing table, cost=$0.00")
        return 0.0
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)
