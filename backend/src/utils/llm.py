import asyncio
from enum import Enum
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

from src.constants import UserTokenKey, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY
from src.constants.llm import ModelName
from src.repos.user_repo import UserRepo

from groq import Groq
from groq.types.audio.translation import Translation

def get_api_key(model_name: str):
    if 'openai' in model_name:
        return OPENAI_API_KEY
    elif 'anthropic' in model_name:
        return ANTHROPIC_API_KEY
    elif 'groq' in model_name:
        return GROQ_API_KEY
    elif 'google' in model_name:
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

class LLMWrapper:
    def __init__(self, model_name: str, tools: list = None, user_repo: UserRepo = None, **kwargs):
        self.model = None
        self.model_name = model_name
        self.kwargs = kwargs
        self.tools = tools
        self.user_repo: UserRepo = user_repo
        self.choose_model(model_name)
        
    def __getattr__(self, item):
        # Redirect attribute access to the wrapped model
        return getattr(self.model, item)
        
    def choose_model(self, model_name: str):
        chosen_model = None

        if model_name not in [e.value for e in ModelName]:
            raise ValueError(f"Model {model_name} not supported")
        
        # Langchain 
        chosen_model = load_chat_model(model_name, **self.kwargs)
        
        ## PRevious implementation
        # if 'openai' in model_name:
        #     openai_token = OPENAI_API_KEY
        #     if not openai_token:
        #         raise ValueError("OpenAI API key not found")
        #     self.kwargs['api_key'] = openai_token
        #     model_name = model_name.replace('openai-', '')
        #     chosen_model = ChatOpenAI(model=model_name, **self.kwargs)
        # elif 'anthropic' in model_name:
        #     anthropic_token = ANTHROPIC_API_KEY
        #     if not anthropic_token:
        #         raise ValueError("Anthropic API key not found") 
        #     self.kwargs['api_key'] = anthropic_token
        #     model_name = model_name.replace('anthropic-', '')
        #     chosen_model = ChatAnthropic(model=model_name, **self.kwargs)
        # elif 'ollama' in model_name:
        #     ollama_base_url = self.user_repo.get_token(key=UserTokenKey.OLLAMA_BASE_URL.name)
        #     if not ollama_base_url:
        #         raise ValueError("Ollama base URL not found")
        #     self.kwargs['base_url'] = ollama_base_url
        #     model_name = model_name.replace('ollama-', '')
        #     chosen_model = ChatOllama(model=model_name, **self.kwargs)
        # elif 'groq' in model_name:
        #     groq_token = GROQ_API_KEY
        #     if not groq_token:
        #         raise ValueError("Groq API key not found")
        #     self.kwargs['api_key'] = groq_token
        #     model_name = model_name.replace('groq-', '')
        #     chosen_model = ChatGroq(model=model_name, **self.kwargs)
        # elif 'google' in model_name:
        #     gemini_token = GEMINI_API_KEY
        #     if not gemini_token:
        #         raise ValueError("Gemini API key not found")
        #     self.kwargs['api_key'] = gemini_token
        #     model_name = model_name.replace('google-', '')
        #     chosen_model = ChatGoogleGenerativeAI(model=model_name, **self.kwargs)
        # else:
        #     raise ValueError(f"Provider {model_name} not supported")
            
        if self.tools and len(self.tools) > 0:
            self.model = chosen_model.bind_tools(tools=self.tools)
        else:
            self.model = chosen_model
            
    def embedding_model(self):
        chosen_model = None
        if 'openai' in self.model_name:
            openai_token = OPENAI_API_KEY
            if not openai_token:
                raise ValueError("OpenAI API key not found")
            self.kwargs['api_key'] = openai_token
            model_name = model_name.replace('openai-', '')
            chosen_model = OpenAIEmbeddings(model=model_name, **self.kwargs)
        else:
            raise ValueError(f"Embedding model {model_name} not supported")
        return chosen_model
        

def audio_to_text(
    filename: str, 
    file_bytes: bytes, 
    model: str, 
    prompt: str, 
    response_format: str, 
    temperature: float, 
    timeout: float
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
            file=(filename, file_bytes),
            model=model,
            **kwargs
        )
        return translation
    except Exception as e:
        raise e
