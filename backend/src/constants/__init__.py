import os
import json
import base64
from dotenv import load_dotenv
load_dotenv()

def fix_base64_padding(s):
    """Ensure base64 string has correct padding."""
    return s + '=' * (-len(s) % 4)

# Server
HOST = str(os.getenv("HOST", "0.0.0.0"))
PORT = int(os.getenv("PORT", 8000))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# App
DEFAULT_VECTOR_STORE_PATH = './sandbox/db/vectorstore.json'
DEFAULT_APP_USER_LIST = '[{"username": "admin", "password": "test1234", "name": "Admin User", "email": "admin@example.com"}]'
base64_str = os.getenv("APP_USER_LIST", base64.b64encode(DEFAULT_APP_USER_LIST.encode('utf-8')).decode('utf-8'))
fixed_base64_str = fix_base64_padding(base64_str)
APP_USER_LIST = json.loads(base64.b64decode(fixed_base64_str).decode('utf-8'))
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_LOG_LEVEL = os.getenv("APP_LOG_LEVEL", "INFO").upper()

# Database
DB_URI = os.getenv("POSTGRES_CONNECTION_STRING", "postgresql://admin:test1234@localhost:5432/lg_template_dev?sslmode=disable")
DB_URI_SANDBOX = os.getenv("POSTGRES_CONNECTION_STRING_SANDBOX", "postgresql://admin:test1234@localhost:5432/lg_template_agent?sslmode=disable")
CONNECTION_POOL_KWARGS = {
    "autocommit": True,
    "prepare_threshold": 0,
}

# LLM API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Tools
SHELL_EXEC_SERVER_URL = os.getenv("SHELL_EXEC_SERVER_URL", "http://exec_server:3005/exec")

# JWT Settings
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "this-is-a-secret-key")  # Change this in production!
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Token Encryption
TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY", "your-secret-key-here")  # Change this in production!
