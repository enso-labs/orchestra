import os
import unittest
from src.constants import TEST_USER_ID
from src.repos.tool_repo import ToolRepo, SavedTool, ToolConfig
from src.services.tool import ToolService
from tests.mock.tool import fake_tool_runtime, MockToolVars


class TestToolRepo(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up test fixtures before each test method"""

        os.environ["APP_ENV"] = "test"
        os.environ["TEST_WEBHOOK_URL"] = "https://example.com/webhook"

        self.tool_service = ToolService(user_id=TEST_USER_ID)
        created_tool = SavedTool(
            name=MockToolVars.TEST_TOOL_NAME,
            config=ToolConfig(base_tool=MockToolVars.BASE_TOOL),
            description="Send a message to the GridSite Microsoft Teams channel.",
            type="default",
            metadata={},
            env={"TEST_WEBHOOK_URL": os.getenv("TEST_WEBHOOK_URL")},
            tags=["test"],
            verbose=False,
            disabled=False,
            public=False,
        )
        self.tool_repo = ToolRepo(user_id=TEST_USER_ID)
        await self.tool_repo.create(created_tool)
        self.tools = await self.tool_repo.search(filter={"name": created_tool.name})
        self.tool = self.tools[0]

    async def asyncTearDown(self):
        """Clean up after each test method"""
        # Optionally, teardown steps here (e.g., deleting the tool)
        await self.tool_repo.delete(self.tool.name)
        pass

    async def test_invoke_saved_tool(self):
        """Test that the saved tool is converted to a structured tool correctly"""
        TEXT_TO_COMPARE = "Hello, world!"
        result = await self.tool_service.invoke_structured_tool(
            structured_tool=self.tool,
            input={
                "text": TEXT_TO_COMPARE,
                "runtime": fake_tool_runtime(),
            },
        )
        self.assertEqual(result, TEXT_TO_COMPARE)
