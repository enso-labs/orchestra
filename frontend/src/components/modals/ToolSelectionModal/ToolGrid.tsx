import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolCard } from "./ToolCard";
import { Tool } from "./types";

interface ToolGridProps {
	tools: Tool[];
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
}

export function ToolGrid({
	tools,
	selectedTools,
	onToggleSelection,
}: ToolGridProps) {
	if (tools.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center space-y-2">
					<p className="text-muted-foreground">No tools found</p>
					<p className="text-sm text-muted-foreground">
						Try adjusting your search or filters
					</p>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-12">
				{tools.map((tool) => (
					<ToolCard
						key={tool.name}
						tool={tool}
						isSelected={selectedTools.has(tool.name)}
						onToggle={onToggleSelection}
					/>
				))}
			</div>
		</ScrollArea>
	);
}
