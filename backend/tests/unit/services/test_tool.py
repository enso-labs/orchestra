import unittest
import os
from src.constants import TEST_USER_ID
from src.repos.tool_repo import ToolRepo, SavedTool
from src.services.tool import ToolService


class TestToolRepo(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up test fixtures before each test method"""
        
        os.environ["APP_ENV"] = "test"
        os.environ["TEST_WEBHOOK_URL"] = "https://example.com/webhook"
        
        self.tool_service = ToolService(user_id=TEST_USER_ID)
        created_tool = SavedTool(
            name="NEW_send_webhook_to_channel",
            base_tool="send_webhook_to_channel",
            description="Send a message to the GridSite Microsoft Teams channel.",
            type="default",
            args={'text': 'Hello, world!'},
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
    
    async def asyncTearDown(self):
        """Clean up after each test method"""
        # Optionally, teardown steps here (e.g., deleting the tool)
        await self.tool_repo.delete(self.tools[0].name)
        pass
    
    async def test_saved_tool_is_invoked(self):
        """Test that the saved tool is invoked correctly"""
        tool: SavedTool = self.tools[0]
        result = await self.tool_service.invoke_tool(name=tool.base_tool, args=tool.args, config={"env": tool.env})
        self.assertEqual(result, True)