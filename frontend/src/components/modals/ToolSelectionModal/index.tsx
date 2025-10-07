import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { PlatformToolsPanel } from "./PlatformToolsPanel";
import { useToolSelection } from "./hooks/useToolSelection";
import { ToolCategory, Tool } from "./types";
import { listTools } from "@/lib/services/toolService";

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
							<div className="flex items-center justify-center h-full">
								<p className="text-muted-foreground">
									MCP integration coming soon
								</p>
							</div>
						)}

						{activeCategory === "a2a" && (
							<div className="flex items-center justify-center h-full">
								<p className="text-muted-foreground">
									A2A integration coming soon
								</p>
							</div>
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
