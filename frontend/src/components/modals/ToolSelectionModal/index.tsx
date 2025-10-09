import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { PlatformToolsPanel } from "./PlatformToolsPanel";
import { McpServerPanel } from "./McpServerPanel";
import { A2aAgentPanel } from "./A2aAgentPanel";
import { useToolSelection } from "./hooks/useToolSelection";
import { ToolCategory, Tool, McpServerConfig, A2aServerConfig } from "./types";
import {
	listTools,
	getMcpTools,
	getA2aAgents,
} from "@/lib/services/toolService";

interface ToolSelectionModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialSelectedTools?: string[];
	onApply: (selectedTools: string[]) => void;
}

export function ToolSelectionModal({
	isOpen,
	onClose,
	initialSelectedTools = [],
	onApply,
}: ToolSelectionModalProps) {
	const [activeCategory, setActiveCategory] =
		useState<ToolCategory>("platform");
	const [platformTools, setPlatformTools] = useState<Tool[]>([]);
	const [mcpServers, setMcpServers] = useState<Record<string, McpServerConfig>>(
		{},
	);
	const [mcpTools, setMcpTools] = useState<Tool[]>([]);
	const [isMcpLoading, setIsMcpLoading] = useState(false);
	const [a2aServers, setA2aServers] = useState<Record<string, A2aServerConfig>>(
		{},
	);
	const [a2aAgents, setA2aAgents] = useState<any[]>([]);
	const [isA2aLoading, setIsA2aLoading] = useState(false);

	const { selectedTools, toggleTool, selectedArray, selectedCount } =
		useToolSelection(initialSelectedTools);

	// Fetch platform tools
	useEffect(() => {
		if (isOpen && activeCategory === "platform") {
			listTools()
				.then((data) => {
					setPlatformTools(data.tools || []);
				})
				.catch((error) => {
					console.error("Failed to load tools:", error);
				});
		}
	}, [isOpen, activeCategory]);

	const handleApply = () => {
		onApply(selectedArray);
		onClose();
	};

	const handleClose = () => {
		// Optionally: confirm if changes were made
		onClose();
	};

	const handleAddMcpServer = (name: string, config: McpServerConfig) => {
		setMcpServers((prev) => ({ ...prev, [name]: config }));
	};

	const handleRemoveMcpServer = (name: string) => {
		setMcpServers((prev) => {
			const updated = { ...prev };
			delete updated[name];
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
		setA2aServers((prev) => ({ ...prev, [name]: config }));
	};

	const handleRemoveA2aServer = (name: string) => {
		setA2aServers((prev) => {
			const updated = { ...prev };
			delete updated[name];
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
				<div className="flex flex-col sm:flex-row h-full overflow-hidden">
					<Sidebar
						activeCategory={activeCategory}
						onCategoryChange={setActiveCategory}
					/>

					<div className="flex-1 flex flex-col overflow-hidden">
						{activeCategory === "platform" && (
							<PlatformToolsPanel
								tools={platformTools}
								selectedTools={selectedTools}
								onToggleSelection={toggleTool}
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

						{activeCategory === "arcade" && (
							<div className="flex items-center justify-center h-full">
								<p className="text-muted-foreground">
									Arcade integration coming soon
								</p>
							</div>
						)}

						{/* Action Bar */}
						<div className="flex-shrink-0 border-t border-border px-4 sm:px-6 py-3 sm:py-4 bg-background">
							<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
								<div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
									<Button
										variant="outline"
										onClick={handleClose}
										className="flex-1 sm:flex-none"
									>
										Cancel
									</Button>
									<Button onClick={handleApply} className="flex-1 sm:flex-none">
										Apply Changes
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
