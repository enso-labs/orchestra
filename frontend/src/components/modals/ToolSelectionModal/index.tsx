import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sidebar } from "./Sidebar";
import { PlatformToolsPanel } from "./PlatformToolsPanel";
import { CustomToolsPanel } from "./CustomToolsPanel";
import { McpServerPanel } from "./McpServerPanel";
import { A2aAgentPanel } from "./A2aAgentPanel";
import { SubagentsPanel } from "./SubagentsPanel";
import { useToolSelection } from "./hooks/useToolSelection";
import { useSubagentSelection } from "./hooks/useSubagentSelection";
import { ToolCategory, Tool, McpServerConfig, A2aServerConfig } from "./types";
import {
	listTools,
	getMcpTools,
	getA2aAgents,
} from "@/lib/services/toolService";
import { useAgentContext } from "@/context/AgentContext";
import { Agent } from "@/lib/services/agentService";
import { patchDefaults } from "@/lib/services/userSettingsService";
import { getAuthToken } from "@/lib/utils/auth";
import { toast } from "sonner";
import { X } from "lucide-react";

const FALLBACK_TOOLS: Tool[] = [
	{ name: "web_search", description: "Search the web", tags: ["search"] },
	{ name: "web_scrape", description: "Scrape web pages", tags: ["search"] },
	{
		name: "math_calculator",
		description: "Calculate math expressions",
		tags: ["utility"],
	},
	{ name: "think_tool", description: "Think step by step", tags: ["utility"] },
];

interface ToolSelectionModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialSelectedTools?: string[];
	initialMcpConfig?: Record<string, McpServerConfig>;
	initialA2aConfig?: Record<string, A2aServerConfig>;
}

export function ToolSelectionModal({
	isOpen,
	onClose,
	initialSelectedTools = [],
	initialMcpConfig = {},
	initialA2aConfig = {},
}: ToolSelectionModalProps) {
	const { setAgent, agents, agent } = useAgentContext();
	const [activeCategory, setActiveCategory] =
		useState<ToolCategory>("platform");
	const [platformTools, setPlatformTools] = useState<Tool[]>([]);
	const [mcpServers, setMcpServers] =
		useState<Record<string, McpServerConfig>>(initialMcpConfig);
	const [mcpTools, setMcpTools] = useState<Tool[]>([]);
	const [isMcpLoading, setIsMcpLoading] = useState(false);
	const [a2aServers, setA2aServers] =
		useState<Record<string, A2aServerConfig>>(initialA2aConfig);
	const [a2aAgents, setA2aAgents] = useState<any[]>([]);
	const [isA2aLoading, setIsA2aLoading] = useState(false);
	const [isToolFormActive, setIsToolFormActive] = useState(false);

	const {
		selectedTools,
		toggleTool,
		selectMultiple,
		deselectMultiple,
		selectedCount,
		flushPersist,
	} = useToolSelection(initialSelectedTools);
	const {
		toggleSubagent,
		isAgentSelected,
		flushPersist: flushSubagentPersist,
	} = useSubagentSelection();

	const isAuthenticated = !!getAuthToken();

	// Derive visible categories based on auth state
	const visibleCategories: ToolCategory[] = isAuthenticated
		? ["platform", "api", "mcp", "a2a", "subagents"]
		: ["platform", "mcp", "a2a"];

	// Fetch platform tools
	useEffect(() => {
		if (isOpen && activeCategory === "platform") {
			if (!isAuthenticated) {
				setPlatformTools(FALLBACK_TOOLS);
				return;
			}
			listTools()
				.then((data) => {
					setPlatformTools(data.tools || []);
				})
				.catch((error) => {
					console.error("Failed to load tools:", error);
				});
		}
	}, [isOpen, activeCategory]);

	// Auto-fetch MCP tools if servers are pre-configured
	useEffect(() => {
		if (isOpen && Object.keys(mcpServers).length > 0 && mcpTools.length === 0) {
			handleFetchMcpTools(mcpServers);
		}
	}, [isOpen, mcpServers]);

	// Auto-fetch A2A agents if servers are pre-configured
	useEffect(() => {
		if (
			isOpen &&
			Object.keys(a2aServers).length > 0 &&
			a2aAgents.length === 0
		) {
			handleFetchA2aAgents(a2aServers);
		}
	}, [isOpen, a2aServers]);

	const handleClose = () => {
		flushPersist();
		flushSubagentPersist();
		onClose();
	};

	const handleAddMcpServer = (name: string, config: McpServerConfig) => {
		setMcpServers((prev) => {
			const updated = { ...prev, [name]: config };
			setAgent((prev: Agent) => ({ ...prev, mcp: updated }));
			if (getAuthToken()) {
				patchDefaults({ mcp: updated }).catch(() =>
					toast.error("Failed to save MCP defaults"),
				);
			}
			return updated;
		});
	};

	const handleRemoveMcpServer = (name: string) => {
		setMcpServers((prev) => {
			const updated = { ...prev };
			delete updated[name];
			setAgent((prev: Agent) => ({ ...prev, mcp: updated }));
			if (getAuthToken()) {
				patchDefaults({ mcp: updated }).catch(() =>
					toast.error("Failed to save MCP defaults"),
				);
			}
			return updated;
		});
	};

	const handleFetchMcpTools = async (
		servers: Record<string, McpServerConfig>,
	) => {
		setIsMcpLoading(true);
		try {
			const response = await getMcpTools(servers);
			const tools = response.mcp || [];
			setMcpTools(
				tools.map((tool: any) => ({
					name: tool.name,
					description: tool.description || "",
					tags: tool.tags || [],
					metadata: tool.metadata || {},
					args: tool.args || {},
					category: "mcp" as const,
				})),
			);
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		} finally {
			setIsMcpLoading(false);
		}
	};

	const handleAddA2aServer = (name: string, config: A2aServerConfig) => {
		setA2aServers((prev) => {
			const updated = { ...prev, [name]: config };
			setAgent((prev: Agent) => ({ ...prev, a2a: updated }));
			if (getAuthToken()) {
				patchDefaults({ a2a: updated }).catch(() =>
					toast.error("Failed to save A2A defaults"),
				);
			}
			return updated;
		});
	};

	const handleRemoveA2aServer = (name: string) => {
		setA2aServers((prev) => {
			const updated = { ...prev };
			delete updated[name];
			setAgent((prev: Agent) => ({ ...prev, a2a: updated }));
			if (getAuthToken()) {
				patchDefaults({ a2a: updated }).catch(() =>
					toast.error("Failed to save A2A defaults"),
				);
			}
			return updated;
		});
	};

	const handleFetchA2aAgents = async (
		servers: Record<string, A2aServerConfig>,
	) => {
		setIsA2aLoading(true);
		try {
			const response = await getA2aAgents(servers);
			setA2aAgents(response.agent_cards || []);
		} catch (error) {
			console.error("Failed to load A2A agents:", error);
		} finally {
			setIsA2aLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-[1400px] w-full sm:w-[95vw] h-[100vh] sm:h-[90vh] max-h-none sm:max-h-[900px] p-0 gap-0">
				<DialogTitle className="sr-only">Tool Selection</DialogTitle>
				<button
					onClick={handleClose}
					className="absolute right-3 top-3 z-10 rounded-sm p-1 opacity-70 hover:opacity-100 sm:hidden"
					aria-label="Close"
				>
					<X className="h-5 w-5" />
				</button>

				<div className="flex flex-col sm:flex-row h-full overflow-hidden">
					<Sidebar
						activeCategory={activeCategory}
						onCategoryChange={setActiveCategory}
						visibleCategories={visibleCategories}
					/>

					<div className="flex-1 flex flex-col overflow-hidden">
						{activeCategory === "platform" && (
							<PlatformToolsPanel
								tools={platformTools}
								selectedTools={selectedTools}
								onToggleSelection={toggleTool}
								onSelectMultiple={selectMultiple}
								onDeselectMultiple={deselectMultiple}
							/>
						)}

						{activeCategory === "api" && (
							<CustomToolsPanel
								selectedTools={selectedTools}
								onToggleSelection={toggleTool}
								onViewModeChange={setIsToolFormActive}
							/>
						)}

						{activeCategory === "mcp" && (
							<McpServerPanel
								mcpServers={mcpServers}
								mcpTools={mcpTools}
								selectedTools={selectedTools}
								onToggleSelection={toggleTool}
								onAddServer={handleAddMcpServer}
								onRemoveServer={handleRemoveMcpServer}
								onTestConnection={handleFetchMcpTools}
								isLoading={isMcpLoading}
							/>
						)}

						{activeCategory === "a2a" && (
							<A2aAgentPanel
								a2aServers={a2aServers}
								a2aAgents={a2aAgents}
								selectedTools={selectedTools}
								onToggleSelection={toggleTool}
								onAddServer={handleAddA2aServer}
								onRemoveServer={handleRemoveA2aServer}
								onFetchAgents={handleFetchA2aAgents}
								isLoading={isA2aLoading}
							/>
						)}

						{activeCategory === "subagents" && (
							<SubagentsPanel
								agents={agents}
								selectedSubagents={agent.subagents || []}
								onToggleSubagent={toggleSubagent}
								isAgentSelected={isAgentSelected}
							/>
						)}

						{/* Status Bar */}
						{!isToolFormActive && activeCategory !== "subagents" && (
							<div className="flex-shrink-0 border-t border-border px-4 sm:px-6 py-3 sm:py-4 bg-background">
								<div className="text-sm text-muted-foreground">
									{selectedCount > 0 ? (
										<span>
											Selected: <strong>{selectedCount}</strong> tool
											{selectedCount !== 1 ? "s" : ""}
										</span>
									) : (
										<span>No tools selected</span>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
