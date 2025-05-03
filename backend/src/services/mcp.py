from langchain_mcp_adapters.client import MultiServerMCPClient
from src.utils.logger import logger
import httpx

class McpService:
    def __init__(self):
        self.mcp_client = None
        self.agent = None
        
    async def setup(self, config: dict):    
        try:
            self.mcp_client = MultiServerMCPClient(config)
            await self.mcp_client.__aenter__()
        except* Exception as e:
            for err in e.exceptions:
                logger.error(f"Error setting up MCP client: {str(err)}")
                raise err
        
    def tools(self):
        return self.mcp_client.get_tools()
    
    async def cleanup(self):
        if self.mcp_client:
            await self.mcp_client.__aexit__(None, None, None)