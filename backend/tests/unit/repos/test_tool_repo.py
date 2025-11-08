import unittest
import asyncio

from src.repos.tool_repo import ToolRepo
from src.constants import TEST_USER_ID
from src.repos.tool_repo import SavedTool


class TestToolRepo(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up test fixtures before each test method"""
        self.tool_repo = ToolRepo(user_id=TEST_USER_ID)
        self.tool = SavedTool(
            name="test_tool",
            description="This is a test tool",
            type="default",
            args={},
            config={},
            env={
                "TEST_API_KEY": "test-api-key",
            },
            metadata={},
            tags=[],
            verbose=False,
            disabled=False,
            public=False,
        )
        await self.tool_repo.create(self.tool)
    
    async def asyncTearDown(self):
        """Clean up after each test method"""
        # Optionally, teardown steps here (e.g., deleting the tool)
        pass
    
    async def test_tool_is_created(self):
        """Test that the tool is created correctly"""
        self.assertEqual(self.tool.name, "test_tool")
        self.assertEqual(self.tool.description, "This is a test tool")
        self.assertEqual(self.tool.type, "default")
        
    async def test_tool_is_searched(self):
        """Test that the tool is searched correctly"""
        tools = await self.tool_repo.search(query="test_tool")
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0].name, "test_tool")
        self.assertEqual(tools[0].description, "This is a test tool")
        self.assertEqual(tools[0].type, "default")


if __name__ == '__main__':
    unittest.main()