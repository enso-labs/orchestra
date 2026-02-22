import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToolGrid } from "./ToolGrid";
import { Tool } from "./types";
import { toast } from "sonner";

interface PlatformToolsPanelProps {
	tools: Tool[];
	selectedTools: Set<string>;
	onToggleSelection: (toolName: string) => void;
	onSelectMultiple?: (tools: string[]) => void;
	onDeselectMultiple?: (tools: string[]) => void;
}

export function PlatformToolsPanel({
	tools,
	selectedTools,
	onToggleSelection,
	onSelectMultiple,
	onDeselectMultiple,
}: PlatformToolsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTag, setActiveTag] = useState<string | null>(null);

	// Collect unique tags sorted alphabetically
	const allTags = useMemo(() => {
		const tagSet = new Set<string>();
		tools.forEach((tool) => {
			(tool.tags ?? []).forEach((tag) => tagSet.add(tag));
		});
		return Array.from(tagSet).sort();
	}, [tools]);

	// Tools filtered by text search only (for computing tag counts)
	const searchFilteredTools = useMemo(() => {
		if (!searchQuery.trim()) return tools;

		const query = searchQuery.toLowerCase();
		return tools.filter(
			(tool) =>
				tool.name.toLowerCase().includes(query) ||
				tool.description.toLowerCase().includes(query) ||
				(tool.tags ?? []).some((tag) => tag.toLowerCase().includes(query)),
		);
	}, [tools, searchQuery]);

	// Count of tools per tag after text search filtering
	const tagCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		allTags.forEach((tag) => {
			counts[tag] = searchFilteredTools.filter((tool) =>
				(tool.tags ?? []).includes(tag),
			).length;
		});
		return counts;
	}, [allTags, searchFilteredTools]);

	// Final filtered tools: text search + tag filter combined
	const filteredTools = useMemo(() => {
		if (!activeTag) return searchFilteredTools;

		return searchFilteredTools.filter((tool) =>
			(tool.tags ?? []).includes(activeTag),
		);
	}, [searchFilteredTools, activeTag]);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-2">
				<h2 className="text-lg sm:text-xl font-semibold text-foreground">
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

				{/* Tag Filter Chips */}
				{allTags.length > 0 && (
					<div className="overflow-x-auto pt-2 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
						<div className="flex gap-1.5 flex-nowrap pb-1 items-center">
							<button
								onClick={() => setActiveTag(null)}
								className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
									activeTag === null
										? "bg-primary text-primary-foreground"
										: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
								}`}
							>
								All ({searchFilteredTools.length})
							</button>
							{allTags.map((tag) => {
								const count = tagCounts[tag];
								const isDimmed = count === 0;
								return (
									<button
										key={tag}
										onClick={() => setActiveTag(activeTag === tag ? null : tag)}
										className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
											activeTag === tag
												? "bg-primary text-primary-foreground"
												: isDimmed
													? "bg-secondary/50 text-muted-foreground/50 cursor-pointer"
													: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
										}`}
									>
										{tag} ({count})
									</button>
								);
							})}
							{/* Batch Enable/Disable buttons - visible when a tag is active */}
							{activeTag && onSelectMultiple && onDeselectMultiple && (
								<>
									<span className="flex-shrink-0 w-px h-4 bg-border mx-1" />
									<button
										onClick={() => {
											const toolNames = filteredTools.map((t) => t.name);
											onSelectMultiple(toolNames);
											toast.success(
												`Enabled ${toolNames.length} ${activeTag} tools`,
											);
										}}
										className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer bg-green-500/15 text-green-500 hover:bg-green-500/25"
									>
										Enable All
									</button>
									<button
										onClick={() => {
											const toolNames = filteredTools.map((t) => t.name);
											onDeselectMultiple(toolNames);
											toast.success(
												`Disabled ${toolNames.length} ${activeTag} tools`,
											);
										}}
										className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer bg-red-500/15 text-red-500 hover:bg-red-500/25"
									>
										Disable All
									</button>
								</>
							)}
						</div>
					</div>
				)}
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
