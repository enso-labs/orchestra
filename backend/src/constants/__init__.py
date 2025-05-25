import os
import json
import base64
from dotenv import load_dotenv
from enum import Enum
load_dotenv()

def fix_base64_padding(s):
    """Ensure base64 string has correct padding."""
    return s + '=' * (-len(s) % 4)

# Server
HOST = str(os.getenv("HOST", "0.0.0.0"))
PORT = int(os.getenv("PORT", 8000))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# OAuth2
OAUTH_GITHUB_CLIENT_ID = os.getenv("OAUTH_GITHUB_CLIENT_ID")
OAUTH_GITHUB_CLIENT_SECRET = os.getenv("OAUTH_GITHUB_CLIENT_SECRET")
OAUTH_GITHUB_REDIRECT_URI = os.getenv("OAUTH_GITHUB_REDIRECT_URI")

# JWT Settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "this-is-a-secret-key")  # Change this in production!
JWT_ALGORITHM = "HS256"
JWT_TOKEN_EXPIRE_MINUTES = 60 * 24

# App
APP_ENV = os.getenv("APP_ENV", "development")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_SECRET_KEY = os.getenv("APP_SECRET_KEY", "this-is-a-secret-key")
APP_LOG_LEVEL = os.getenv("APP_LOG_LEVEL", "INFO").upper()
DEFAULT_VECTOR_STORE_PATH = './sandbox/db/vectorstore.json'

# Database
DB_URI = os.getenv("POSTGRES_CONNECTION_STRING", "postgresql://admin:test1234@localhost:5432/lg_template_dev?sslmode=disable")
DB_URI_SANDBOX = os.getenv("POSTGRES_CONNECTION_STRING_SANDBOX", "postgresql://admin:test1234@localhost:5432/lg_template_agent?sslmode=disable")
CONNECTION_POOL_KWARGS = {
    "autocommit": True,
    "prepare_threshold": 0,
}

class UserTokenKey(Enum):
    
    ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY"
    OPENAI_API_KEY = "OPENAI_API_KEY"
    GROQ_API_KEY = "GROQ_API_KEY"
    GEMINI_API_KEY = "GEMINI_API_KEY"
    OLLAMA_BASE_URL = "OLLAMA_BASE_URL"
    ## TOOLS
    SHELL_EXEC_SERVER_URL = "SHELL_EXEC_SERVER_URL"
    SEARX_SEARCH_HOST_URL = "SEARX_SEARCH_HOST_URL"
    ARCADE_API_KEY = "ARCADE_API_KEY"
    LANGCONNECT_SERVER_URL = "LANGCONNECT_SERVER_URL"
    @classmethod
    def values(cls) -> list[str]:
        return [key.value for key in cls]

# LLM API Keys
ANTHROPIC_API_KEY = os.getenv(UserTokenKey.ANTHROPIC_API_KEY.value)
OPENAI_API_KEY = os.getenv(UserTokenKey.OPENAI_API_KEY.value)
OLLAMA_BASE_URL = os.getenv(UserTokenKey.OLLAMA_BASE_URL.value)
GROQ_API_KEY = os.getenv(UserTokenKey.GROQ_API_KEY.value)
GEMINI_API_KEY = os.getenv(UserTokenKey.GEMINI_API_KEY.value)
ARCADE_API_KEY = os.getenv(UserTokenKey.ARCADE_API_KEY.value)
# Tools
SHELL_EXEC_SERVER_URL = os.getenv(UserTokenKey.SHELL_EXEC_SERVER_URL.value, "http://localhost:3005/exec")
SEARX_SEARCH_HOST_URL = os.getenv(UserTokenKey.SEARX_SEARCH_HOST_URL.value, "http://localhost:8080")
LANGCONNECT_SERVER_URL = os.getenv(UserTokenKey.LANGCONNECT_SERVER_URL.value)

# Storage
MINIO_HOST = os.getenv("MINIO_HOST")
S3_REGION = os.getenv("S3_REGION", "us-east-2")
ACCESS_KEY_ID = os.getenv("ACCESS_KEY_ID")
ACCESS_SECRET_KEY = os.getenv("ACCESS_SECRET_KEY")
BUCKET = os.getenv("BUCKET", "lg_template_dev")
TEST_USER_ID = os.getenv("TEST_USER_ID", "1")