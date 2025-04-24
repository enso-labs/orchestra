export const config = [
  {
    id: "srv-001",
    user_id: "usr-acme-001",
    name: "Enso MCP Server",
    slug: "enso-mcp-server",
    description: "Includes web scraping, shell commands, and search tools",
    type: "mcp",
    config: {
      "transport": "sse",
      "url": "https://mcp.enso.sh/sse"
    },
    documentation: "Standard production server configuration with full monitoring capabilities.",
    documentation_url: "https://demo.enso.sh/servers/production",
    public: true,
    created_at: "2023-01-15T08:30:00Z",
    updated_at: "2023-06-22T14:15:30Z"
  },
  {
    id: "srv-002",
    user_id: "usr-acme-001",
    name: "Enso A2A Server",
    slug: "enso-a2a-server",
    description: "Currency Agent A2A Server",
    type: "a2a",
    config: {
      "agent_card_path": "/.well-known/agent.json",
      "base_url": "https://a2a.enso.sh"
    },
    documentation: "Currency Agent A2A Server",
    documentation_url: "https://demo.enso.sh/docs/tools",
    public: true,
    created_at: "2023-02-10T10:45:00Z",
    updated_at: "2023-05-18T09:20:15Z"
  }
];