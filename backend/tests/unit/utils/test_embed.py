"""Unit tests for embed utility functions (token creation, verification, rate limiting)."""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException
from jose import jwt

from src.constants import JWT_SECRET_KEY, JWT_ALGORITHM
from src.utils.embed import (
    create_embed_token,
    verify_embed_token,
    check_embed_rate_limit,
    EMBED_RATE_LIMIT_TTL,
)


class TestCreateEmbedToken(unittest.TestCase):
    """Tests for create_embed_token()."""

    def test_creates_valid_jwt(self):
        """Test that create_embed_token returns a decodable JWT."""
        agent_id = str(uuid4())
        token = create_embed_token(agent_id)

        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        self.assertEqual(payload["agent_id"], agent_id)
        self.assertEqual(payload["type"], "embed")

    def test_token_contains_required_fields(self):
        """Test that token payload contains agent_id, rate_limit, jti, exp, type."""
        agent_id = str(uuid4())
        token = create_embed_token(agent_id)

        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        self.assertIn("agent_id", payload)
        self.assertIn("rate_limit", payload)
        self.assertIn("jti", payload)
        self.assertIn("exp", payload)
        self.assertIn("type", payload)

    def test_default_rate_limit_is_100(self):
        """Test that the default rate limit is 100 messages/day."""
        token = create_embed_token(str(uuid4()))
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        self.assertEqual(payload["rate_limit"], 100)

    def test_custom_rate_limit(self):
        """Test that a custom rate limit is stored in the token."""
        token = create_embed_token(str(uuid4()), rate_limit=50)
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        self.assertEqual(payload["rate_limit"], 50)

    def test_jti_is_unique_per_token(self):
        """Test that each token gets a unique jti."""
        agent_id = str(uuid4())
        token1 = create_embed_token(agent_id)
        token2 = create_embed_token(agent_id)

        payload1 = jwt.decode(token1, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        payload2 = jwt.decode(token2, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        self.assertNotEqual(payload1["jti"], payload2["jti"])

    def test_expiry_defaults_to_30_days(self):
        """Test that token expires approximately 30 days from now."""
        before = datetime.now(timezone.utc)
        token = create_embed_token(str(uuid4()))
        after = datetime.now(timezone.utc)

        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        self.assertGreaterEqual(exp, before + timedelta(days=29, hours=23))
        self.assertLessEqual(exp, after + timedelta(days=30, minutes=1))

    def test_custom_expiry(self):
        """Test that custom expiry is respected."""
        before = datetime.now(timezone.utc)
        token = create_embed_token(str(uuid4()), expires_days=7)

        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        self.assertGreaterEqual(exp, before + timedelta(days=6, hours=23))
        self.assertLessEqual(exp, before + timedelta(days=7, minutes=1))


class TestVerifyEmbedToken(unittest.TestCase):
    """Tests for verify_embed_token()."""

    def _make_token(self, agent_id: str, **overrides) -> str:
        """Helper to create a token with optional payload overrides."""
        payload = {
            "agent_id": agent_id,
            "rate_limit": 100,
            "jti": str(uuid4()),
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
            "type": "embed",
        }
        payload.update(overrides)
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    def test_valid_token_returns_payload(self):
        """Test that a valid token returns the decoded payload."""
        agent_id = str(uuid4())
        token = self._make_token(agent_id)

        result = verify_embed_token(token, agent_id)

        self.assertEqual(result["agent_id"], agent_id)
        self.assertEqual(result["type"], "embed")
        self.assertIn("jti", result)

    def test_expired_token_raises_401(self):
        """Test that an expired token raises HTTP 401."""
        agent_id = str(uuid4())
        token = self._make_token(agent_id, exp=datetime.now(timezone.utc) - timedelta(hours=1))

        with self.assertRaises(HTTPException) as ctx:
            verify_embed_token(token, agent_id)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_invalid_signature_raises_401(self):
        """Test that a token signed with wrong key raises HTTP 401."""
        agent_id = str(uuid4())
        payload = {
            "agent_id": agent_id,
            "rate_limit": 100,
            "jti": str(uuid4()),
            "exp": datetime.now(timezone.utc) + timedelta(days=30),
            "type": "embed",
        }
        token = jwt.encode(payload, "wrong-secret-key", algorithm=JWT_ALGORITHM)

        with self.assertRaises(HTTPException) as ctx:
            verify_embed_token(token, agent_id)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_type_raises_401(self):
        """Test that a token with type != 'embed' raises HTTP 401."""
        agent_id = str(uuid4())
        token = self._make_token(agent_id, type="user")

        with self.assertRaises(HTTPException) as ctx:
            verify_embed_token(token, agent_id)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid token type", ctx.exception.detail)

    def test_agent_id_mismatch_raises_401(self):
        """Test that a token for a different agent_id raises HTTP 401."""
        agent_id = str(uuid4())
        different_agent_id = str(uuid4())
        token = self._make_token(agent_id)

        with self.assertRaises(HTTPException) as ctx:
            verify_embed_token(token, different_agent_id)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("agent_id mismatch", ctx.exception.detail)

    def test_malformed_token_raises_401(self):
        """Test that a completely invalid token string raises HTTP 401."""
        with self.assertRaises(HTTPException) as ctx:
            verify_embed_token("not.a.valid.jwt", str(uuid4()))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_roundtrip_with_create_embed_token(self):
        """Test that a token from create_embed_token() passes verify_embed_token()."""
        agent_id = str(uuid4())
        token = create_embed_token(agent_id, rate_limit=75)

        result = verify_embed_token(token, agent_id)

        self.assertEqual(result["agent_id"], agent_id)
        self.assertEqual(result["rate_limit"], 75)
        self.assertEqual(result["type"], "embed")


class TestCheckEmbedRateLimit(unittest.IsolatedAsyncioTestCase):
    """Tests for check_embed_rate_limit() with mocked Redis."""

    @patch("src.utils.embed.aioredis")
    async def test_token_rate_limit_allows_under_limit(self, mock_aioredis):
        """Test that requests under the token rate limit are allowed."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        # Should not raise
        await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=100)

        mock_redis.incr.assert_called_once_with(f"embed:{agent_id}:{jti}")
        mock_redis.expire.assert_called_once_with(f"embed:{agent_id}:{jti}", EMBED_RATE_LIMIT_TTL)

    @patch("src.utils.embed.aioredis")
    async def test_token_rate_limit_returns_429_when_exceeded(self, mock_aioredis):
        """Test that exceeding the token rate limit returns HTTP 429."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 101  # Over the 100 default limit
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        with self.assertRaises(HTTPException) as ctx:
            await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=100)
        self.assertEqual(ctx.exception.status_code, 429)

    @patch("src.utils.embed.aioredis")
    async def test_anon_rate_limit_uses_ip_key(self, mock_aioredis):
        """Test that anonymous requests use IP-based rate limit key."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())

        await check_embed_rate_limit(agent_id=agent_id, client_ip="192.168.1.1")

        mock_redis.incr.assert_called_once_with(f"embed:{agent_id}:anon:192.168.1.1")

    @patch("src.utils.embed.aioredis")
    async def test_anon_rate_limit_returns_429_when_exceeded(self, mock_aioredis):
        """Test that exceeding anonymous rate limit returns HTTP 429."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 11  # Over the 10 anon limit
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())

        with self.assertRaises(HTTPException) as ctx:
            await check_embed_rate_limit(agent_id=agent_id, client_ip="10.0.0.1")
        self.assertEqual(ctx.exception.status_code, 429)

    @patch("src.utils.embed.aioredis")
    async def test_first_request_sets_ttl(self, mock_aioredis):
        """Test that the first request (count=1) sets the Redis TTL."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=100)

        key = f"embed:{agent_id}:{jti}"
        mock_redis.expire.assert_called_once_with(key, 86400)

    @patch("src.utils.embed.aioredis")
    async def test_subsequent_request_does_not_reset_ttl(self, mock_aioredis):
        """Test that subsequent requests (count>1) do not call expire."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 5  # Not the first request
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=100)

        mock_redis.expire.assert_not_called()

    @patch("src.utils.embed.aioredis")
    async def test_anon_defaults_to_unknown_ip(self, mock_aioredis):
        """Test that anonymous requests without client_ip default to 'unknown'."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())

        await check_embed_rate_limit(agent_id=agent_id)

        mock_redis.incr.assert_called_once_with(f"embed:{agent_id}:anon:unknown")

    @patch("src.utils.embed.aioredis")
    async def test_custom_token_rate_limit(self, mock_aioredis):
        """Test that a custom rate_limit from the token is respected."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 51  # Over custom limit of 50
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        with self.assertRaises(HTTPException) as ctx:
            await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=50)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("50", ctx.exception.detail)

    @patch("src.utils.embed.aioredis")
    async def test_at_exact_limit_is_allowed(self, mock_aioredis):
        """Test that the request at exactly the limit is allowed (count == limit)."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 100  # Exactly at the limit
        mock_aioredis.from_url.return_value = mock_redis

        agent_id = str(uuid4())
        jti = str(uuid4())

        # Should NOT raise — limit is exceeded only when count > limit
        await check_embed_rate_limit(agent_id=agent_id, jti=jti, rate_limit=100)

    @patch("src.utils.embed.aioredis")
    async def test_redis_connection_closed_after_check(self, mock_aioredis):
        """Test that Redis connection is properly closed after rate limit check."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 1
        mock_aioredis.from_url.return_value = mock_redis

        await check_embed_rate_limit(agent_id=str(uuid4()), jti=str(uuid4()), rate_limit=100)

        mock_redis.aclose.assert_called_once()

    @patch("src.utils.embed.aioredis")
    async def test_redis_closed_even_on_rate_limit_exceeded(self, mock_aioredis):
        """Test that Redis connection is closed even when rate limit is exceeded."""
        mock_redis = AsyncMock()
        mock_redis.incr.return_value = 200
        mock_aioredis.from_url.return_value = mock_redis

        with self.assertRaises(HTTPException):
            await check_embed_rate_limit(agent_id=str(uuid4()), jti=str(uuid4()), rate_limit=100)

        mock_redis.aclose.assert_called_once()


if __name__ == "__main__":
    unittest.main()
