import unittest
from unittest.mock import patch

from src.repos.tool_repo import ToolRepo, SavedTool, ToolConfig
from src.constants import TEST_USER_ID
from src.tools.test import TEST_TOOLS


TEST_TOOL_NAME = "TEST_webhook_marketing_channel"
BASE_TOOL = "send_webhook_to_channel"


class TestToolRepo(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        """Start mocking TOOL_LIBRARY before async setup."""
        self.patcher = patch("src.repos.tool_repo.TOOL_LIBRARY", TEST_TOOLS)
        self.patcher.start()

    def tearDown(self):
        """Stop mocking TOOL_LIBRARY after async teardown."""
        self.patcher.stop()

    async def asyncSetUp(self):
        """Set up test fixtures before each test method"""
        self.tool_repo = ToolRepo(user_id=TEST_USER_ID)
        created_tool = SavedTool(
            name=TEST_TOOL_NAME,
            config=ToolConfig(base_tool=BASE_TOOL),
            description="Send a message to the GridSite Microsoft Teams channel.",
            type="default",
            metadata={},
            env={"TEST_WEBHOOK_URL": "https://example.com/webhook"},
            tags=["example"],
            verbose=False,
            disabled=False,
            public=False,
        )
        await self.tool_repo.create(created_tool)
        self.tools = await self.tool_repo.search(filter={"name": TEST_TOOL_NAME})
        self.tool = self.tools[0]

    async def asyncTearDown(self):
        """Clean up after each test method"""
        # Optionally, teardown steps here (e.g., deleting the tool)
        pass

    async def test_tool_lifecycle(self):
        """Test the full tool lifecycle in order: create, filter, delete"""
        # 1. Tool is created correctly
        self.assertEqual(self.tool.name, TEST_TOOL_NAME)
        self.assertEqual(self.tool.metadata["base_tool"], BASE_TOOL)
        # 2. Tool is filtered by name
        self.assertEqual(len(self.tools), 1)
        # 3. Tool is deleted successfully
        await self.tool_repo.delete(self.tool.name)
        self.tools = await self.tool_repo.search(filter={"name": TEST_TOOL_NAME})
        self.assertEqual(len(self.tools), 0)


if __name__ == "__main__":
    unittest.main()
