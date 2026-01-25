import json
from cryptography.fernet import Fernet, InvalidToken
from src.constants import APP_SECRET_KEY


def _get_fernet() -> Fernet:
    """
    Create a Fernet instance from APP_SECRET_KEY.

    APP_SECRET_KEY must be a **Fernet key** (urlsafe base64-encoded 32 bytes).
    """

    key = (APP_SECRET_KEY or "").strip().strip('"').strip("'")
    if not key:
        raise ValueError(
            "APP_SECRET_KEY is not set. It must be a Fernet key (e.g. generated via "
            '`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).'
        )

    try:
        return Fernet(key.encode())
    except Exception as e:
        raise ValueError(
            "APP_SECRET_KEY is not a valid Fernet key. It must be a urlsafe base64-encoded 32-byte key."
        ) from e


def encrypt_value(value: dict) -> str:
    f = _get_fernet()
    return f.encrypt(json.dumps(value).encode()).decode()


def decrypt_value(value: str) -> dict:
    f = _get_fernet()
    try:
        return json.loads(f.decrypt(value.encode()).decode())
    except InvalidToken as e:
        raise ValueError(
            "Failed to decrypt value with APP_SECRET_KEY. This usually means the ciphertext was produced "
            "with a different APP_SECRET_KEY (key rotation/mismatch) or the stored value was corrupted."
        ) from e
