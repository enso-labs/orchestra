import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from src.services.tool import ToolService


class TestMcpServerFiltering(unittest.IsolatedAsyncioTestCase):
    """Test that disabled MCP servers are filtered out before connecting."""

    @patch("src.services.tool.MultiServerMCPClient")
    async def test_enabled_servers_are_passed_through(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.get_tools = AsyncMock(return_value=[])
        mock_client_cls.return_value = mock_client

        mcp = {
            "server_a": {"transport": "sse", "url": "http://a.com", "headers": {}, "enabled": True},
            "server_b": {"transport": "sse", "url": "http://b.com", "headers": {}},
        }
        await ToolService.mcp_tools(mcp)

        mock_client_cls.assert_called_once()
        call_arg = mock_client_cls.call_args[0][0]
        self.assertIn("server_a", call_arg)
        self.assertIn("server_b", call_arg)

    @patch("src.services.tool.MultiServerMCPClient")
    async def test_disabled_servers_are_filtered_out(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.get_tools = AsyncMock(return_value=[])
        mock_client_cls.return_value = mock_client

        mcp = {
            "server_a": {"transport": "sse", "url": "http://a.com", "headers": {}, "enabled": True},
            "server_b": {"transport": "sse", "url": "http://b.com", "headers": {}, "enabled": False},
        }
        await ToolService.mcp_tools(mcp)

        mock_client_cls.assert_called_once()
        call_arg = mock_client_cls.call_args[0][0]
        self.assertIn("server_a", call_arg)
        self.assertNotIn("server_b", call_arg)

    async def test_all_disabled_returns_empty(self):
        mcp = {
            "server_a": {"transport": "sse", "url": "http://a.com", "headers": {}, "enabled": False},
        }
        result = await ToolService.mcp_tools(mcp)
        self.assertEqual(result, [])

    @patch("src.services.tool.MultiServerMCPClient")
    async def test_missing_enabled_defaults_to_true(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.get_tools = AsyncMock(return_value=[])
        mock_client_cls.return_value = mock_client

        mcp = {
            "server_a": {"transport": "sse", "url": "http://a.com", "headers": {}},
        }
        await ToolService.mcp_tools(mcp)

        mock_client_cls.assert_called_once()
        call_arg = mock_client_cls.call_args[0][0]
        self.assertIn("server_a", call_arg)


if __name__ == "__main__":
    unittest.main()
