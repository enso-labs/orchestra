import unittest
from unittest.mock import patch

from langgraph.store.memory import InMemoryStore

from src.repos.user_settings_repo import UserSettingsRepo
from src.constants import UserTokenKey

TEST_USER_ID = "test-user-settings-001"


def _mock_encrypt(value: dict) -> str:
    """Deterministic fake encryption: just JSON-encode."""
    import json

    return "ENC:" + json.dumps(value, sort_keys=True)


def _mock_decrypt(value: str) -> dict:
    """Deterministic fake decryption matching _mock_encrypt."""
    import json

    if not value.startswith("ENC:"):
        raise ValueError("Bad ciphertext")
    return json.loads(value[4:])


@patch("src.repos.user_settings_repo.encrypt_value", side_effect=_mock_encrypt)
@patch("src.repos.user_settings_repo.decrypt_value", side_effect=_mock_decrypt)
class TestUserSettingsRepo(unittest.IsolatedAsyncioTestCase):
    """Unit tests for UserSettingsRepo: CRUD, encryption round-trip, validation."""

    async def asyncSetUp(self):
        self.store = InMemoryStore()
        self.repo = UserSettingsRepo(user_id=TEST_USER_ID, store=self.store)

    # ------------------------------------------------------------------
    # get_settings
    # ------------------------------------------------------------------

    async def test_get_settings_empty(self, _dec, _enc):
        """Fresh user returns empty settings with all providers is_set=False."""
        settings, statuses = await self.repo.get_settings()
        self.assertIsNone(settings.default_model)
        self.assertIsNone(settings.encrypted_keys)
        # Every UserTokenKey should appear with is_set=False
        self.assertEqual(len(statuses), len(UserTokenKey))
        for s in statuses:
            self.assertFalse(s.is_set)

    # ------------------------------------------------------------------
    # set_default_model
    # ------------------------------------------------------------------

    async def test_set_default_model(self, _dec, _enc):
        """Setting a default model persists and is returned."""
        await self.repo.set_default_model("openai/gpt-4")
        settings, _ = await self.repo.get_settings()
        self.assertEqual(settings.default_model, "openai/gpt-4")

    async def test_clear_default_model(self, _dec, _enc):
        """Setting model to None clears the default."""
        await self.repo.set_default_model("openai/gpt-4")
        await self.repo.set_default_model(None)
        settings, _ = await self.repo.get_settings()
        self.assertIsNone(settings.default_model)

    # ------------------------------------------------------------------
    # upsert / delete provider key
    # ------------------------------------------------------------------

    async def test_upsert_provider_key(self, _dec, _enc):
        """Upserting a valid provider key encrypts and stores it."""
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-test-123")
        settings, statuses = await self.repo.get_settings()
        # encrypted_keys should be set
        self.assertIsNotNone(settings.encrypted_keys)
        # status for OPENAI_API_KEY should be True
        openai_status = next(s for s in statuses if s.provider == "OPENAI_API_KEY")
        self.assertTrue(openai_status.is_set)

    async def test_upsert_multiple_keys(self, _dec, _enc):
        """Multiple provider keys coexist."""
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-1")
        await self.repo.upsert_provider_key("ANTHROPIC_API_KEY", "sk-ant-2")
        _, statuses = await self.repo.get_settings()
        openai = next(s for s in statuses if s.provider == "OPENAI_API_KEY")
        anthropic = next(s for s in statuses if s.provider == "ANTHROPIC_API_KEY")
        self.assertTrue(openai.is_set)
        self.assertTrue(anthropic.is_set)

    async def test_delete_provider_key(self, _dec, _enc):
        """Deleting a key removes it; other keys remain."""
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-1")
        await self.repo.upsert_provider_key("ANTHROPIC_API_KEY", "sk-2")
        await self.repo.delete_provider_key("OPENAI_API_KEY")
        _, statuses = await self.repo.get_settings()
        openai = next(s for s in statuses if s.provider == "OPENAI_API_KEY")
        anthropic = next(s for s in statuses if s.provider == "ANTHROPIC_API_KEY")
        self.assertFalse(openai.is_set)
        self.assertTrue(anthropic.is_set)

    async def test_delete_nonexistent_key(self, _dec, _enc):
        """Deleting a key that was never set doesn't error."""
        await self.repo.delete_provider_key("OPENAI_API_KEY")
        _, statuses = await self.repo.get_settings()
        openai = next(s for s in statuses if s.provider == "OPENAI_API_KEY")
        self.assertFalse(openai.is_set)

    # ------------------------------------------------------------------
    # encryption round-trip
    # ------------------------------------------------------------------

    async def test_encryption_round_trip(self, _dec, _enc):
        """Stored key can be decrypted back to original value."""
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-secret-value")
        decrypted = await self.repo.get_decrypted_key("OPENAI_API_KEY")
        self.assertEqual(decrypted, "sk-secret-value")

    async def test_get_all_decrypted_keys(self, _dec, _enc):
        """get_all_decrypted_keys returns all stored keys."""
        await self.repo.upsert_provider_key("OPENAI_API_KEY", "sk-1")
        await self.repo.upsert_provider_key("ANTHROPIC_API_KEY", "sk-2")
        keys = await self.repo.get_all_decrypted_keys()
        self.assertEqual(keys, {"OPENAI_API_KEY": "sk-1", "ANTHROPIC_API_KEY": "sk-2"})

    async def test_get_decrypted_key_missing(self, _dec, _enc):
        """get_decrypted_key returns None for unset provider."""
        result = await self.repo.get_decrypted_key("OPENAI_API_KEY")
        self.assertIsNone(result)

    # ------------------------------------------------------------------
    # set_default_sandbox
    # ------------------------------------------------------------------

    async def test_set_default_sandbox(self, _dec, _enc):
        """Setting a default sandbox persists and is returned."""
        await self.repo.set_default_sandbox("daytona")
        settings, _ = await self.repo.get_settings()
        self.assertEqual(settings.default_sandbox, "daytona")

    async def test_clear_default_sandbox(self, _dec, _enc):
        """Setting sandbox to None clears the default."""
        await self.repo.set_default_sandbox("state")
        await self.repo.set_default_sandbox(None)
        settings, _ = await self.repo.get_settings()
        self.assertIsNone(settings.default_sandbox)

    async def test_patch_defaults_persists_files_and_deleted_files(self, _dec, _enc):
        """patch_defaults stores persisted files and normalized tombstones."""
        await self.repo.patch_defaults(
            {
                "files": {
                    "/profile.md": {
                        "content": ["hello"],
                        "created_at": "2024-01-01T00:00:00Z",
                        "modified_at": "2024-01-02T00:00:00Z",
                    }
                },
                "deleted_files": ["/tmp.md", "/tmp.md", "/archive.md"],
            }
        )

        settings, _ = await self.repo.get_settings()
        assert settings.default_files is not None
        assert "/profile.md" in settings.default_files
        assert settings.default_files["/profile.md"].content == ["hello"]
        assert settings.default_deleted_files == ["/archive.md", "/tmp.md"]

    async def test_patch_defaults_rejects_invalid_file_paths(self, _dec, _enc):
        """patch_defaults rejects non-absolute persisted file paths."""
        with self.assertRaises(ValueError):
            await self.repo.patch_defaults(
                {
                    "files": {
                        "relative.txt": {
                            "content": ["hello"],
                        }
                    }
                }
            )

    async def test_patch_defaults_rejects_invalid_deleted_file_paths(self, _dec, _enc):
        """patch_defaults rejects non-absolute deleted file tombstones."""
        with self.assertRaises(ValueError):
            await self.repo.patch_defaults({"deleted_files": ["relative.txt"]})

    async def test_set_invalid_sandbox_raises(self, _dec, _enc):
        """Setting an invalid sandbox value raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            await self.repo.set_default_sandbox("invalid_backend")
        self.assertIn("Invalid sandbox", str(ctx.exception))

    # ------------------------------------------------------------------
    # invalid provider rejection
    # ------------------------------------------------------------------

    async def test_upsert_invalid_provider_raises(self, _dec, _enc):
        """Upserting with an invalid provider name raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            await self.repo.upsert_provider_key("INVALID_PROVIDER", "key")
        self.assertIn("Invalid provider", str(ctx.exception))

    async def test_delete_invalid_provider_raises(self, _dec, _enc):
        """Deleting an invalid provider name raises ValueError."""
        with self.assertRaises(ValueError):
            await self.repo.delete_provider_key("NOT_A_PROVIDER")

    async def test_get_decrypted_key_invalid_provider_raises(self, _dec, _enc):
        """get_decrypted_key with invalid provider raises ValueError."""
        with self.assertRaises(ValueError):
            await self.repo.get_decrypted_key("BAD_PROVIDER")


if __name__ == "__main__":
    unittest.main()
