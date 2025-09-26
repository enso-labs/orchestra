const DEFAULT_MCP_CONFIG = {
	enso_mcp: {
		transport: "sse",
		url: "https://mcp.enso.sh/sse",
		headers: { "x-mcp-key": "your_api_key" },
	},
};

const DEFAULT_A2A_CONFIG = {
	enso_a2a: {
		base_url: "https://a2a.enso.sh",
		agent_card_path: "/.well-known/agent.json",
	},
};

const DEFAULT_TOOLS = ["get_weather"];

class ToolConfig {
	static DEFAULT_MCP_CONFIG = DEFAULT_MCP_CONFIG;
	static DEFAULT_A2A_CONFIG = DEFAULT_A2A_CONFIG;
}

export default ToolConfig;
