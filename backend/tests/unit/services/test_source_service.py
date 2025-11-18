"""test example module."""

import os
import unittest
import asyncio

from langgraph.store.base import SearchItem
from tests import get_test_user
from seeds.user_seeder import seed_admin
from src.utils.migrations import run_migrations
from src.services.source import SourceService, Source
from src.services.db import get_async_db
from src.repos.user_repo import UserRepo


class TestSourceService(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        os.environ["APP_ENV"] = "test"
        run_migrations()
        seed_admin()
        self.user = await get_test_user()
        self.source_service = SourceService(user_id=self.user.id)

    # @unittest.skip("Skipping vector search test")
    async def test_source_lifecycle(self):
        VALID_SOURCES = [
            Source(
                name="Test Source",
                description="Test Source Description",
                type="website",
                metadata={
                    "url": "https://example.com",
                },
            ),
        ]
        await self.source_service.create(
            project_id="test-project", source=VALID_SOURCES[0]
        )
        results: list[SearchItem] = await self.source_service.search(
            query="test source"
        )
        result_source = results[0].value
        assert result_source.name == VALID_SOURCES[0].name
        assert result_source.description == VALID_SOURCES[0].description
        assert result_source.type == VALID_SOURCES[0].type
        assert result_source.metadata["url"] == VALID_SOURCES[0].metadata["url"]
        assert result_source.metadata["project_id"] == "test-project"
        assert result_source.id is not None
        assert result_source.created_at is not None
        assert result_source.updated_at is not None
