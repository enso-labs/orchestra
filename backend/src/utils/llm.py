from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    GROQ_API_KEY,
    GEMINI_API_KEY,
    XAI_API_KEY,
    UserTokenKey,
)
from groq import Groq
from groq.types.audio.translation import Translation


def get_api_key(model_name: str):
    if "openai" in model_name:
        return OPENAI_API_KEY
    elif "anthropic" in model_name:
        return ANTHROPIC_API_KEY
    elif "groq" in model_name:
        return GROQ_API_KEY
    elif "google" in model_name:
        return GEMINI_API_KEY
    else:
        raise ValueError(f"Provider {model_name} not supported")


# Mapping from model provider prefix to UserTokenKey enum value
_PROVIDER_PREFIX_TO_KEY: dict[str, UserTokenKey] = {
    "openai": UserTokenKey.OPENAI_API_KEY,
    "anthropic": UserTokenKey.ANTHROPIC_API_KEY,
    "google_genai": UserTokenKey.GEMINI_API_KEY,
    "xai": UserTokenKey.XAI_API_KEY,
    "groq": UserTokenKey.GROQ_API_KEY,
}

# System-level env vars keyed by UserTokenKey value
_SYSTEM_KEYS: dict[str, str | None] = {
    UserTokenKey.OPENAI_API_KEY.value: OPENAI_API_KEY,
    UserTokenKey.ANTHROPIC_API_KEY.value: ANTHROPIC_API_KEY,
    UserTokenKey.GEMINI_API_KEY.value: GEMINI_API_KEY,
    UserTokenKey.XAI_API_KEY.value: XAI_API_KEY,
    UserTokenKey.GROQ_API_KEY.value: GROQ_API_KEY,
}


def resolve_api_key(model: str, user_keys: dict[str, str] | None) -> str | None:
    """Resolve the API key for a given model string.

    Checks user-provided keys first, then falls back to system env keys.
    Returns None if the provider is unknown.
    """
    # Find matching provider prefix
    token_key: UserTokenKey | None = None
    for prefix, key in _PROVIDER_PREFIX_TO_KEY.items():
        if prefix in model:
            token_key = key
            break

    if token_key is None:
        return None

    # Check user key first
    if user_keys and token_key.value in user_keys:
        return user_keys[token_key.value]

    # Fall back to system key
    return _SYSTEM_KEYS.get(token_key.value)


def audio_to_text(
    filename: str,
    file_bytes: bytes,
    model: str,
    prompt: str,
    response_format: str,
    temperature: float,
    timeout: float,
) -> Translation:
    try:
        kwargs = {}
        if prompt is not None:
            kwargs["prompt"] = prompt
        if response_format is not None:
            kwargs["response_format"] = response_format
        if temperature is not None:
            kwargs["temperature"] = temperature
        if timeout is not None:
            kwargs["timeout"] = timeout
        client = Groq(api_key=GROQ_API_KEY)
        translation = client.audio.translations.create(
            file=(filename, file_bytes), model=model, **kwargs
        )
        return translation
    except Exception as e:
        raise e


def filter_models(models: dict, **props):
    """
    Filter model dict by internal flags/properties.

    Example:
        filter_models(models, tool_call=True)
        filter_models(models, attachment=True, reasoning=False)
    """
    filtered = {}

    for name, data in models.items():
        # each model entry looks like {"id": "...", "attachment": True, ...}
        if all(data.get(k) == v for k, v in props.items()):
            filtered[name] = data

    return list(filtered.keys())


def filter_tool_call_models(provider_models: dict[str, dict]) -> list[str]:
    """Return all model IDs for this provider that support tool calling."""
    return [
        model_id for model_id, meta in provider_models.items() if meta.get("tool_call")
    ]
