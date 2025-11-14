"""test example module."""

import unittest
import os
from uuid import uuid4
from langgraph.store.base import SearchItem
from src.services.source import Source
from src.utils.migrations import run_migrations
from seeds.user_seeder import seed_admin
from tests import get_test_user
from src.services.project import ProjectService
from langchain_core.documents import Document


class TestProjectService(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        os.environ["APP_ENV"] = "test"
        run_migrations()
        seed_admin()
        self.project_id = str(uuid4())
        self.user = await get_test_user()
        self.project_service = ProjectService(
            user_id=self.user.id,
        )
    
    async def test_vector_search(self):
        VALID_DOCS = [
            Document(
                page_content="Python is a programming language",
                metadata={
                    "language": "Python",
                    "topic": "programming",
                },
            ),
            Document(
                page_content="Tennis is a sport",
                metadata={
                    "sport": "Tennis",
                    "topic": "sports",
                },
            ),
        ]
        await self.project_service.add_docs(project_id=self.project_id, docs=VALID_DOCS)
        results: list[SearchItem] = await self.project_service.search_docs(
            project_id=self.project_id, query="python programming"
        )
        assert results[0].value["page_content"] == VALID_DOCS[0].model_dump()["page_content"]
        assert results[0].value["metadata"] == VALID_DOCS[0].model_dump()["metadata"]
        
        
    async def test_add_sources(self):
        VALID_SOURCES = [
            Source(
                id="test-source",
                name="Enso Website",
                description="",
                type="web_scrape",
                metadata={
                    "urls": ["https://enso.sh"],
                },
            ),
        ]
        await self.project_service.add_sources(project_id="test-project", sources=VALID_SOURCES)