from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

class McpService:
    def __init__(self):
        self.mcp_client = None
        self.agent = None
        
    async def setup(self, config: dict):    
        self.mcp_client = MultiServerMCPClient(config)
        await self.mcp_client.__aenter__()
        
    def tools(self):
        return self.mcp_client.get_tools()
    
    async def cleanup(self):
        if self.mcp_client:
            await self.mcp_client.__aexit__(None, None, None)