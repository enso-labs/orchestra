import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt

from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM


def create_embed_token(
    agent_id: str,
    rate_limit: int = 100,
    expires_days: int = 30,
) -> str:
    """Create a signed JWT for embedding an agent on external sites.

    The token contains:
    - agent_id: The public assistant ID
    - rate_limit: Max messages per day (default 100)
    - jti: Unique token ID for rate limiting
    - exp: Expiration timestamp
    - type: "embed" to distinguish from user auth tokens
    """
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    payload = {
        "agent_id": agent_id,
        "rate_limit": rate_limit,
        "jti": str(uuid.uuid4()),
        "exp": expire,
        "type": "embed",
    }

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
