from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel

from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    GROQ_API_KEY,
    GEMINI_API_KEY,
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


def load_chat_model(fully_specified_name: str, delimiter: str = ":") -> BaseChatModel:
    """Load a chat model from a fully specified name.

    Args:
        fully_specified_name (str): String in the format 'provider/model'.
    """
    provider, model = fully_specified_name.split(delimiter, maxsplit=1)
    api_key = get_api_key(provider)
    return init_chat_model(model, model_provider=provider, api_key=api_key)


def get_provider(model_name: str):
    provider, model = model_name.split(":", maxsplit=1)
    return provider, model


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
