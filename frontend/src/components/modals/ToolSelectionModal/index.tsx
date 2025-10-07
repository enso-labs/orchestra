import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
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
			<DialogContent className="max-w-[1400px] w-[95vw] h-[90vh] max-h-[900px] p-0">
				<DialogHeader className="absolute top-4 right-4 z-10">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleClose}
						className="rounded-full"
					>
						<X className="h-4 w-4" />
					</Button>
				</DialogHeader>

				<div className="flex h-full">
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
						<div className="flex-shrink-0 border-t border-border px-6 py-4 bg-background">
							<div className="flex items-center justify-between">
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
								<div className="flex items-center gap-3">
									<Button variant="outline" onClick={handleClose}>
										Cancel
									</Button>
									<Button onClick={handleApply}>Apply Changes</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
