"""test example module."""

import unittest
import asyncio

from langgraph.store.base import SearchItem
from tests import get_test_user
from src.services.project import ProjectService
from langchain_core.documents import Document


class TestProjectService(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        self.user = await get_test_user()
        self.project_service = ProjectService(
            user_id=self.user.id,
            project_id="test-project",
        )
    
    @unittest.skip("Skipping vector search test")
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
        await self.project_service.add_docs(VALID_DOCS)
        results: list[SearchItem] = await self.project_service.search_docs(query="python programming")
        assert results[0].value["page_content"] == VALID_DOCS[0].model_dump()["page_content"]
        assert results[0].value["metadata"] == VALID_DOCS[0].model_dump()["metadata"]