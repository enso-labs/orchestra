"""Tests for Redis cache layer in UserSettingsRepo."""

import json
import unittest
from unittest.mock import AsyncMock, patch

import fakeredis.aioredis
from langgraph.store.memory import InMemoryStore

from src.repos.user_settings_repo import UserSettingsRepo, _CACHE_TTL

TEST_USER_ID = "cache-test-user-001"


def _mock_encrypt(value: dict) -> str:
    return "ENC:" + json.dumps(value, sort_keys=True)


def _mock_decrypt(value: str) -> dict:
    if not value.startswith("ENC:"):
        raise ValueError("Bad ciphertext")
    return json.loads(value[4:])


@patch("src.repos.user_settings_repo.encrypt_value", side_effect=_mock_encrypt)
@patch("src.repos.user_settings_repo.decrypt_value", side_effect=_mock_decrypt)
class TestUserSettingsCache(unittest.IsolatedAsyncioTestCase):
    """Tests for the Redis cache behaviour in UserSettingsRepo."""

    async def asyncSetUp(self):
        self.store = InMemoryStore()
        self.redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
        self.repo = UserSettingsRepo(user_id=TEST_USER_ID, store=self.store)
        # Patch get_redis_client to return our fake Redis
        self._redis_patch = patch(
            "src.common.utils.redis_cache.get_redis_client",
            return_value=self.redis,
        )
        self._redis_patch.start()

    async def asyncTearDown(self):
        self._redis_patch.stop()
        await self.redis.aclose()

    # ------------------------------------------------------------------
    # Cache population
    # ------------------------------------------------------------------

    async def test_first_call_populates_cache(self, _dec, _enc):
        """First _get_or_create hits DB and writes to Redis cache."""
        settings = await self.repo._get_or_create()
        cached_raw = await self.redis.get(self.repo._cache_key())
        self.assertIsNotNone(cached_raw)
        cached = json.loads(cached_raw)
        self.assertEqual(cached["user_id"], TEST_USER_ID)
        self.assertEqual(cached["id"], settings.id)

    async def test_second_call_uses_cache(self, _dec, _enc):
        """Second _get_or_create returns from cache without hitting DB."""
        await self.repo._get_or_create()

        # Patch DB access to verify it's not called
        with patch.object(self.repo, "_get", new_callable=AsyncMock) as mock_get:
            settings = await self.repo._get_or_create()
            mock_get.assert_not_called()
            self.assertEqual(settings.user_id, TEST_USER_ID)

    async def test_cache_ttl_is_set(self, _dec, _enc):
        """Cached entry has a TTL set."""
        await self.repo._get_or_create()
        ttl = await self.redis.ttl(self.repo._cache_key())
        self.assertGreater(ttl, 0)
        self.assertLessEqual(ttl, _CACHE_TTL)

    # ------------------------------------------------------------------
    # Cache invalidation on mutations
    # ------------------------------------------------------------------

    async def test_set_default_model_invalidates(self, _dec, _enc):
        """set_default_model removes the cached entry."""
        await self.repo._get_or_create()
        self.assertIsNotNone(await self.redis.get(self.repo._cache_key()))
        await self.repo.set_default_model("openai/gpt-4")
        self.assertIsNone(await self.redis.get(self.repo._cache_key()))

    async def test_set_default_sandbox_invalidates(self, _dec, _enc):
        """set_default_sandbox removes the cached entry."""
        await self.repo._get_or_create()
        await self.repo.set_default_sandbox("daytona")
        self.assertIsNone(await self.redis.get(self.repo._cache_key()))

    async def test_patch_defaults_invalidates(self, _dec, _enc):
        """patch_defaults removes the cached entry."""
        await self.repo._get_or_create()
        await self.repo.patch_defaults({"model": "test-model"})
        self.assertIsNone(await self.redis.get(self.repo._cache_key()))

    async def test_upsert_provider_key_invalidates(self, _dec, _enc):
        """upsert_provider_key removes the cached entry."""
        await self.repo._get_or_create()
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-test")
        self.assertIsNone(await self.redis.get(self.repo._cache_key()))

    async def test_delete_provider_key_invalidates(self, _dec, _enc):
        """delete_provider_key removes the cached entry."""
        await self.repo._get_or_create()
        await self.repo.delete_provider_key("OPENAI_API_KEY")
        self.assertIsNone(await self.redis.get(self.repo._cache_key()))

    # ------------------------------------------------------------------
    # Graceful degradation
    # ------------------------------------------------------------------

    async def test_redis_failure_falls_through_to_db(self, _dec, _enc):
        """When Redis raises an error, _get_or_create still works via DB."""
        # Make Redis raise on all operations
        self._redis_patch.stop()
        broken_redis = AsyncMock()
        broken_redis.get = AsyncMock(side_effect=ConnectionError("Redis down"))
        broken_redis.set = AsyncMock(side_effect=ConnectionError("Redis down"))
        broken_redis.delete = AsyncMock(side_effect=ConnectionError("Redis down"))
        self._redis_patch = patch(
            "src.common.utils.redis_cache.get_redis_client",
            return_value=broken_redis,
        )
        self._redis_patch.start()

        # Should still work -- falls through to DB
        settings = await self.repo._get_or_create()
        self.assertEqual(settings.user_id, TEST_USER_ID)

        # Mutations should also work without Redis
        await self.repo.set_default_model("test-model")
        settings, _ = await self.repo.get_settings()
        self.assertEqual(settings.default_model, "test-model")


if __name__ == "__main__":
    unittest.main()
