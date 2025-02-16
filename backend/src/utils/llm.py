from enum import Enum
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

from src.constants import OLLAMA_BASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, UserTokenKey
from src.constants.llm import ModelName
from src.repos.user_repo import UserRepo
from src.utils.auth import get_db
class LLMWrapper:
    def __init__(self, model_name: str, tools: list = None, **kwargs):
        self.model = None
        self.model_name = model_name
        self.kwargs = kwargs
        self.tools = tools
        self.user_repo = kwargs.get('user_repo')
        self.choose_model(model_name)
        
    def __getattr__(self, item):
        # Redirect attribute access to the wrapped model
        return getattr(self.model, item)
        
    def choose_model(self, model_name: str):
        chosen_model = None

        if model_name not in [e.value for e in ModelName]:
            raise ValueError(f"Model {model_name} not supported")
        
        if 'openai' in model_name:
            openai_token = self.user_repo.get_token(user_id=self.kwargs.get('user_id'), key=UserTokenKey.OPENAI_API_KEY.name)
            if not openai_token:
                raise ValueError("OpenAI API key not found")
            self.kwargs['api_key'] = openai_token
            model_name = model_name.replace('openai-', '')
            chosen_model = ChatOpenAI(model=model_name, **self.kwargs)
        elif 'anthropic' in model_name:
            anthropic_token = self.user_repo.get_token(user_id=self.kwargs.get('user_id'), key=UserTokenKey.ANTHROPIC_API_KEY.name)
            if not anthropic_token:
                raise ValueError("Anthropic API key not found") 
            self.kwargs['api_key'] = anthropic_token
            model_name = model_name.replace('anthropic-', '')
            chosen_model = ChatAnthropic(model=model_name, **self.kwargs)
        elif 'ollama' in model_name:
            ollama_base_url = self.user_repo.get_token(user_id=self.kwargs.get('user_id'), key=UserTokenKey.OLLAMA_BASE_URL.name)
            if not ollama_base_url:
                raise ValueError("Ollama base URL not found")
            self.kwargs['base_url'] = ollama_base_url
            model_name = model_name.replace('ollama-', '')
            chosen_model = ChatOllama(model=model_name, **self.kwargs)
        elif 'groq' in model_name:
            groq_token = self.user_repo.get_token(user_id=self.kwargs.get('user_id'), key=UserTokenKey.GROQ_API_KEY.name)
            if not groq_token:
                raise ValueError("Groq API key not found")
            self.kwargs['api_key'] = groq_token
            model_name = model_name.replace('groq-', '')
            chosen_model = ChatGroq(model=model_name, **self.kwargs)
        elif 'google' in model_name:
            gemini_token = self.user_repo.get_token(user_id=self.kwargs.get('user_id'), key=UserTokenKey.GEMINI_API_KEY.name)
            if not gemini_token:
                raise ValueError("Gemini API key not found")
            self.kwargs['api_key'] = gemini_token
            model_name = model_name.replace('google-', '')
            chosen_model = ChatGoogleGenerativeAI(model=model_name, **self.kwargs)
        else:
            raise ValueError(f"Provider {model_name} not supported")
            
        if self.tools and len(self.tools) > 0:
            self.model = chosen_model.bind_tools(tools=self.tools)
        else:
            self.model = chosen_model
            
    def embedding_model(self):
        chosen_model = None
        if 'openai' in self.model_name:
            model_name = self.model_name.replace('openai-', '')
            chosen_model = OpenAIEmbeddings(model=model_name, **self.kwargs)
        else:
            raise ValueError(f"Embedding model {model_name} not supported")
        return chosen_model
        
