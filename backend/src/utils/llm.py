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
