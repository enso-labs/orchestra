import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToolGrid } from "./ToolGrid";
import { Tool } from "./types";

interface PlatformToolsPanelProps {
	tools: Tool[];
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
}

export function PlatformToolsPanel({
	tools,
	selectedTools,
	onToggleSelection,
}: PlatformToolsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredTools = useMemo(() => {
		if (!searchQuery.trim()) return tools;

		const query = searchQuery.toLowerCase();
		return tools.filter(
			(tool) =>
				tool.name.toLowerCase().includes(query) ||
				tool.description.toLowerCase().includes(query) ||
				tool.tags.some((tag) => tag.toLowerCase().includes(query)),
		);
	}, [tools, searchQuery]);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-4 sm:px-8 lg:px-12 py-4 sm:py-6 space-y-2">
				<h2 className="text-xl sm:text-2xl font-semibold text-foreground">
					Tools & Integrations
				</h2>
				<p className="text-sm text-muted-foreground">
					Connect tools to extend your agent's capabilities
				</p>

				{/* Search */}
				<div className="pt-3 sm:pt-4">
					<div className="relative max-w-full sm:max-w-md">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search tools..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>
			</div>

			{/* Tool Grid */}
			<div className="flex-1 overflow-hidden">
				<ToolGrid
					tools={filteredTools}
					selectedTools={selectedTools}
					onToggleSelection={onToggleSelection}
				/>
			</div>
		</div>
	);
}
