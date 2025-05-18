from langchain_mcp_adapters.client import MultiServerMCPClient

class McpService:
    def __init__(self, config: dict):
        self.config = config
        self.client = MultiServerMCPClient(config)
        
    async def get_tools(self):
        return await self.client.get_tools()