import { useState } from "react";

type ServerConfig = {
    url: string;
    transport: string;
    headers: Record<string, string>;
}

type MCPServer = {
    name: string;
    description: string;
    config: ServerConfig;
}

const DEFAULT_SERVERS: MCPServer[] = [
	{
		name: "Enso MCP v2",
		description: "The official Enso MCP server",
		config: {
			url: "https://mcp.enso.sh/sse",
			transport: "sse",
			headers: {},
		}
	},
	{
		name: "mcp.enso.sh",
		description: "The official Enso MCP server",
		config: {
			url: "https://mcp.enso.sh",
			transport: "http",
			headers: {},
		}
	},
	{
		name: "playwright",
		description: "A playwright server",
		config: {
			url: "https://1013-99-36-3-176.ngrok-free.app/sse",
			transport: "sse",
			headers: {},
		}
	},
	{
		name: "mcp.enso.sh",
		description: "The official Enso MCP server",
		config: {
			url: "https://mcp.enso.sh",
			transport: "http",
			headers: {},
		}
	},
	{
		name: "playwright",
		description: "A playwright server",
		config: {
			url: "https://1013-99-36-3-176.ngrok-free.app/sse",
			transport: "sse",
			headers: {},
		}
	},
	{
		name: "playwright",
		description: "A playwright server",
		config: {
			url: "https://1013-99-36-3-176.ngrok-free.app/sse",
			transport: "sse",
			headers: {},
		}
	},
	{
		name: "playwright",
		description: "A playwright server",
		config: {
			url: "https://1013-99-36-3-176.ngrok-free.app/sse",
			transport: "sse",
			headers: {},
		}
	},
]

function ListMcpServers() {
	
	const [servers, setServers] = useState<MCPServer[]>(DEFAULT_SERVERS);

	return (
		<div>
			<div className="h-[200px] overflow-y-auto pr-1">
				<div className="space-y-3">
					{servers.map((server, index) => (
						<div key={index} className="bg-secondary/50 rounded-lg p-3 shadow-sm">
							<h3 className="font-medium text-sm">{server.name}</h3>
							<div className="mt-2 text-xs text-muted-foreground">
								<p>Transport: {server.config.transport}</p>
								{Object.keys(server.config.headers).length > 0 && (
									<div className="mt-1">
										<p>Headers:</p>
										<pre className="mt-1 bg-background/50 p-2 rounded overflow-x-auto">
											{JSON.stringify(server.config.headers, null, 2)}
										</pre>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default ListMcpServers;