import json
from cryptography.fernet import Fernet
from src.constants import APP_SECRET_KEY

def encrypt_value(value: dict):
    f = Fernet(APP_SECRET_KEY.encode())
    return f.encrypt(json.dumps(value).encode()).decode()

def decrypt_value(value: str):
    f = Fernet(APP_SECRET_KEY.encode())
    return json.loads(f.decrypt(value.encode()).decode())