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
                type="web_scrape",
                content={
                    "urls": ["https://example.com"],
                },
            ),
        ]
        created_source = await self.source_service.create(
            project_id="test-project", source=VALID_SOURCES[0]
        )
        
        # Verify the created source
        assert created_source.type == VALID_SOURCES[0].type
        assert created_source.content == VALID_SOURCES[0].content
        assert created_source.id is not None
        assert created_source.created_at is not None
        assert created_source.updated_at is not None
        
        # Verify we can search for it
        results: list[Source] = await self.source_service.search(
            query="example"
        )
        assert len(results) >= 1
        # Verify the source is in the results
        found = any(r.id == created_source.id for r in results)
        assert found
