import { useState } from "react";
import { Plus, Server, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tool, McpServerConfig } from "./types";
import { ToolGrid } from "./ToolGrid";

interface McpServerPanelProps {
	mcpServers: Record<string, McpServerConfig>;
	mcpTools: Tool[];
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
	onAddServer: (name: string, config: McpServerConfig) => void;
	onRemoveServer: (name: string) => void;
	onTestConnection: (config: Record<string, McpServerConfig>) => Promise<void>;
	isLoading: boolean;
}

const MCP_TEMPLATES = {
	custom: {
		name: "Custom",
		transport: "sse" as const,
		url: "",
		headers: {},
	},
	enso: {
		name: "Enso MCP",
		transport: "sse" as const,
		url: "https://mcp.enso.sh/sse",
		headers: { "x-mcp-key": "" },
	},
	github: {
		name: "GitHub MCP",
		transport: "sse" as const,
		url: "https://mcp.github.com/sse",
		headers: { Authorization: "Bearer " },
	},
};

export function McpServerPanel({
	mcpServers,
	mcpTools,
	selectedTools,
	onToggleSelection,
	onAddServer,
	onRemoveServer,
	onTestConnection,
	isLoading,
}: McpServerPanelProps) {
	const [showAddForm, setShowAddForm] = useState(false);
	const [serverName, setServerName] = useState("");
	const [selectedTemplate, setSelectedTemplate] =
		useState<keyof typeof MCP_TEMPLATES>("custom");
	const [transport, setTransport] = useState<
		"sse" | "streamable_http" | "stdio"
	>("sse");
	const [url, setUrl] = useState("");
	const [headerKey, setHeaderKey] = useState("");
	const [headerValue, setHeaderValue] = useState("");

	const handleTemplateChange = (template: keyof typeof MCP_TEMPLATES) => {
		setSelectedTemplate(template);
		const config = MCP_TEMPLATES[template];
		setTransport(config.transport);
		setUrl(config.url);

		// Set first header if exists
		const firstHeader = Object.entries(config.headers)[0];
		if (firstHeader) {
			setHeaderKey(firstHeader[0]);
			setHeaderValue(firstHeader[1]);
		} else {
			setHeaderKey("");
			setHeaderValue("");
		}
	};

	const handleAddServer = () => {
		if (!serverName.trim() || !url.trim()) return;

		const headers: Record<string, string> = {};
		if (headerKey.trim() && headerValue.trim()) {
			headers[headerKey.trim()] = headerValue.trim();
		}

		onAddServer(serverName.trim(), {
			transport,
			url: url.trim(),
			headers,
		});

		// Reset form
		setServerName("");
		setSelectedTemplate("custom");
		setTransport("sse");
		setUrl("");
		setHeaderKey("");
		setHeaderValue("");
		setShowAddForm(false);
	};

	const handleTestConnection = async () => {
		await onTestConnection(mcpServers);
	};

	const serverCount = Object.keys(mcpServers).length;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-4 sm:px-8 lg:px-12 py-4 sm:py-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-xl sm:text-2xl font-semibold text-foreground">
							MCP Servers
						</h2>
						<p className="text-sm text-muted-foreground">
							Configure Model Context Protocol servers
						</p>
					</div>
					<Button
						onClick={() => setShowAddForm(!showAddForm)}
						size="sm"
						variant={showAddForm ? "outline" : "default"}
					>
						<Plus className="h-4 w-4 mr-2" />
						{showAddForm ? "Cancel" : "Add Server"}
					</Button>
				</div>

				{/* Add Server Form */}
				{showAddForm && (
					<Card className="p-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="template">Template</Label>
							<Select
								value={selectedTemplate}
								onValueChange={handleTemplateChange}
							>
								<SelectTrigger id="template">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(MCP_TEMPLATES).map(([key, template]) => (
										<SelectItem key={key} value={key}>
											{template.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="serverName">Server Name</Label>
								<Input
									id="serverName"
									placeholder="my_mcp_server"
									value={serverName}
									onChange={(e) => setServerName(e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="transport">Transport</Label>
								<Select
									value={transport}
									onValueChange={(v: any) => setTransport(v)}
								>
									<SelectTrigger id="transport">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="sse">SSE</SelectItem>
										<SelectItem value="streamable_http">
											Streamable HTTP
										</SelectItem>
										<SelectItem value="stdio">STDIO</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="url">URL</Label>
							<Input
								id="url"
								placeholder="https://mcp.example.com/sse"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
							/>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="headerKey">Header Key (optional)</Label>
								<Input
									id="headerKey"
									placeholder="x-api-key"
									value={headerKey}
									onChange={(e) => setHeaderKey(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="headerValue">Header Value</Label>
								<Input
									id="headerValue"
									placeholder="your_api_key"
									type="password"
									value={headerValue}
									onChange={(e) => setHeaderValue(e.target.value)}
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setShowAddForm(false);
									setServerName("");
									setUrl("");
									setHeaderKey("");
									setHeaderValue("");
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleAddServer}
								disabled={!serverName.trim() || !url.trim()}
							>
								Add Server
							</Button>
						</div>
					</Card>
				)}

				{/* Server List */}
				{serverCount > 0 && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium text-foreground">
								Configured Servers ({serverCount})
							</p>
							<Button
								size="sm"
								variant="outline"
								onClick={handleTestConnection}
								disabled={isLoading}
							>
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Loading Tools...
									</>
								) : (
									<>
										<Server className="h-4 w-4 mr-2" />
										Fetch Tools
									</>
								)}
							</Button>
						</div>

						<div className="space-y-2">
							{Object.entries(mcpServers).map(([name, config]) => (
								<Card key={name} className="p-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Server className="h-4 w-4 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium text-foreground">
													{name}
												</p>
												<p className="text-xs text-muted-foreground">
													{config.transport} • {config.url}
												</p>
											</div>
										</div>
										<Button
											size="icon"
											variant="ghost"
											onClick={() => onRemoveServer(name)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</Card>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Tool Grid */}
			<div className="flex-1 overflow-hidden">
				{mcpTools.length > 0 ? (
					<ToolGrid
						tools={mcpTools}
						selectedTools={selectedTools}
						onToggleSelection={onToggleSelection}
					/>
				) : (
					<div className="flex items-center justify-center h-full">
						<div className="text-center space-y-2">
							<Server className="h-12 w-12 text-muted-foreground mx-auto" />
							<p className="text-muted-foreground">
								{serverCount === 0
									? "Add an MCP server to get started"
									: "Click 'Fetch Tools' to load available tools"}
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
