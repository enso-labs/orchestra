import { useState, useMemo } from "react";
import { Search, Check, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Agent } from "@/lib/services/agentService";
import { cn } from "@/lib/utils";

interface SubagentsPanelProps {
	agents: Agent[];
	selectedSubagents: Agent[];
	onToggleSubagent: (agent: Agent) => void;
	isAgentSelected: (agentId: string) => boolean;
}

export function SubagentsPanel({
	agents,
	selectedSubagents,
	onToggleSubagent,
	isAgentSelected,
}: SubagentsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredAgents = useMemo(() => {
		if (!searchQuery.trim()) return agents;

		const query = searchQuery.toLowerCase();
		return agents.filter(
			(agent) =>
				agent.name.toLowerCase().includes(query) ||
				agent.description?.toLowerCase().includes(query) ||
				agent.model?.toLowerCase().includes(query),
		);
	}, [agents, searchQuery]);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex-shrink-0 border-b border-border px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-2">
				<h2 className="text-lg sm:text-xl font-semibold text-foreground">
					Subagents
				</h2>
				<p className="text-sm text-muted-foreground">
					Select agents to use as subagents in your current session
				</p>

				{/* Search */}
				<div className="pt-3 sm:pt-4">
					<div className="relative max-w-full sm:max-w-md">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search agents..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</div>
			</div>

			{/* Agent List */}
			<div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
				{filteredAgents.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{filteredAgents.map((agent) => {
							const selected = agent.id ? isAgentSelected(agent.id) : false;

							return (
								<button
									key={agent.id}
									onClick={() => onToggleSubagent(agent)}
									className={cn(
										"flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
										selected
											? "border-primary bg-primary/5"
											: "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
									)}
								>
									<div className="flex-shrink-0 mt-0.5">
										<div
											className={cn(
												"w-8 h-8 rounded-full flex items-center justify-center",
												selected
													? "bg-primary text-primary-foreground"
													: "bg-primary/10",
											)}
										>
											{selected ? (
												<Check className="h-4 w-4" />
											) : (
												<Bot className="h-4 w-4 text-primary" />
											)}
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm truncate">
											{agent.name}
										</div>
										{agent.description && (
											<div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
												{agent.description}
											</div>
										)}
										{agent.model && (
											<div className="text-xs text-muted-foreground/70 mt-1">
												{agent.model}
											</div>
										)}
									</div>
								</button>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<Bot className="h-12 w-12 text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground">
							{searchQuery
								? "No agents found matching your search"
								: "No agents available"}
						</p>
					</div>
				)}
			</div>

			{/* Status Bar */}
			<div className="flex-shrink-0 border-t border-border px-4 sm:px-6 py-3 sm:py-4 bg-background">
				<div className="text-sm text-muted-foreground">
					{selectedSubagents.length > 0 ? (
						<span>
							Selected: <strong>{selectedSubagents.length}</strong> subagent
							{selectedSubagents.length !== 1 ? "s" : ""}
						</span>
					) : (
						<span>No subagents selected</span>
					)}
				</div>
			</div>
		</div>
	);
}
