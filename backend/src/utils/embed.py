import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from jose import JWTError, jwt

from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM
from src.constants.redis import REDIS_URL

# Rate limit defaults
EMBED_TOKEN_RATE_LIMIT = 100  # messages/day with token
EMBED_ANON_RATE_LIMIT = 10  # messages/day without token
EMBED_RATE_LIMIT_TTL = 86400  # 24 hours in seconds


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


def verify_embed_token(token: str, expected_agent_id: str) -> dict:
    """Verify an embed JWT and return the decoded payload.

    Validates:
    - JWT signature and expiry (handled by jose)
    - Token type is "embed"
    - agent_id matches the expected assistant

    Returns the decoded payload dict on success.
    Raises HTTPException on failure.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired embed token",
        )

    if payload.get("type") != "embed":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    if payload.get("agent_id") != expected_agent_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token agent_id mismatch",
        )

    return payload


async def check_embed_rate_limit(
    agent_id: str,
    jti: Optional[str] = None,
    rate_limit: Optional[int] = None,
    client_ip: Optional[str] = None,
) -> None:
    """Check and increment the embed rate limit counter in Redis.

    For token-authenticated requests: key = embed:{agent_id}:{jti}
    For anonymous requests: key = embed:{agent_id}:anon:{client_ip}

    Raises HTTPException 429 when rate limit is exceeded.
    """
    if jti:
        key = f"embed:{agent_id}:{jti}"
        limit = rate_limit or EMBED_TOKEN_RATE_LIMIT
    else:
        ip = client_ip or "unknown"
        key = f"embed:{agent_id}:anon:{ip}"
        limit = EMBED_ANON_RATE_LIMIT

    redis_client = aioredis.from_url(REDIS_URL)
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, EMBED_RATE_LIMIT_TTL)
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded ({limit} messages/day)",
            )
    finally:
        await redis_client.aclose()
