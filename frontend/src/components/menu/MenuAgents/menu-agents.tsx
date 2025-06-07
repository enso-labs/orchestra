import { useState } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search, Bot, X } from "lucide-react";
import { Agent } from "@/entities";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/context/ChatContext";
import useAppHook from "@/hooks/useAppHook";

function MenuAgents() {
	const { setPayload } = useChatContext();
	const { agents, handleSelectAgent, setSelectedAgent, selectedAgent } = useAgentContext();
	const { isMobile } = useAppHook();
	const [open, setOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");

	const handleAgentSelect = (agent: Agent) => {
		setSelectedAgent(agent);
		handleSelectAgent(agent);
		setOpen(false);
		setSearchTerm("");
	};

	const handleClearSelection = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setSelectedAgent(null);
		setPayload((prev: any) => ({
			...prev,
			agentId: ''
		}));
	};

	const clearSelection = () => {
		setSelectedAgent(null);
		setOpen(false);
		setSearchTerm("");
		setPayload((prev: any) => ({
			...prev,
			agentId: ''
		}));
	};

	// Prevent input events from closing the menu
	const handleSearchClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		setSearchTerm(e.target.value);
	};

	const handleSearchKeyDown = (e: React.KeyboardEvent) => {
		e.stopPropagation();
	};

	// Filter agents based on search term
	const filteredAgents = agents?.filter((agent: Agent) =>
		agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		agent.description?.toLowerCase().includes(searchTerm.toLowerCase())
	) || [];

	// Shared content component for both popover and drawer
	const AgentSelectorContent = () => (
		<div className="flex flex-col">
			{/* Search Input */}
			<div className="flex items-center border-b px-3 py-2" onClick={handleSearchClick}>
				<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
				<Input
					placeholder="Search agents..."
					value={searchTerm}
					onChange={handleSearchChange}
					onClick={handleSearchClick}
					onKeyDown={handleSearchKeyDown}
					onFocus={handleSearchClick}
					className="border-0 px-0 py-1 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
			</div>

			{/* Clear Option */}
			{selectedAgent && (
				<div className="border-b">
					<div
						className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-sm text-muted-foreground"
						onClick={clearSelection}
					>
						<X className="h-4 w-4" />
						<span>Clear selection</span>
					</div>
				</div>
			)}

			{/* Agents List */}
			<div className={`${isMobile() ? 'max-h-[60vh]' : 'max-h-[200px]'} overflow-auto`}>
				{filteredAgents.length > 0 ? (
					<div className="p-1">
						{filteredAgents.map((agent: Agent) => (
							<div
								key={agent.id}
								className={cn(
									"flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-sm",
									selectedAgent?.id === agent.id && "bg-accent text-accent-foreground"
								)}
								onClick={() => handleAgentSelect(agent)}
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="flex-shrink-0">
										<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
											<Bot className="h-3 w-3 text-primary" />
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate">{agent.name}</div>
										{agent.description && (
											<div className="text-xs text-muted-foreground truncate">
												{agent.description}
											</div>
										)}
									</div>
								</div>
								<Check
									className={cn(
										"h-4 w-4 flex-shrink-0",
										selectedAgent?.id === agent.id ? "opacity-100" : "opacity-0"
									)}
								/>
							</div>
						))}
					</div>
				) : (
					<div className="p-4 text-center text-sm text-muted-foreground">
						{searchTerm ? "No agents found" : "No agents available"}
					</div>
				)}
			</div>
		</div>
	);

	return (
		<div className="w-full">
			{/* Mobile: Use drawer */}
			{isMobile() ? (
				<>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between rounded-xl h-9 text-sm font-normal"
						onClick={() => setOpen(true)}
					>
						<div className="flex items-center gap-2 flex-1 min-w-0">
							<Bot className="h-4 w-4 opacity-50 flex-shrink-0" />
							<span className="truncate">
								{selectedAgent ? selectedAgent.name : "Search agents..."}
							</span>
						</div>
						<div className="flex items-center gap-1 flex-shrink-0">
							{selectedAgent && (
								<button
									onClick={handleClearSelection}
									className="rounded-full p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
									aria-label="Clear selection"
								>
									<X className="h-3 w-3" />
								</button>
							)}
							<ChevronsUpDown className="h-4 w-4 opacity-50" />
						</div>
					</Button>

					{/* Mobile Drawer */}
					{open && (
						<>
							{/* Overlay */}
							<div 
								className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
								onClick={() => setOpen(false)}
							/>
							
							{/* Drawer */}
							<div 
								className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-2xl transform transition-transform duration-300 ease-in-out max-h-[80vh]"
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex flex-col h-full">
									{/* Header */}
									<div className="flex items-center justify-between p-4 border-b border-border">
										<h2 className="text-lg font-semibold">Select Agent</h2>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setOpen(false)}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
									
									{/* Content */}
									<div className="flex-1 overflow-hidden">
										<AgentSelectorContent />
									</div>
								</div>
							</div>
						</>
					)}
				</>
			) : (
				/* Desktop: Use popover */
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between rounded-xl h-9 text-sm font-normal"
						>
							<div className="flex items-center gap-2 flex-1 min-w-0">
								<Bot className="h-4 w-4 opacity-50 flex-shrink-0" />
								<span className="truncate">
									{selectedAgent ? selectedAgent.name : "Search agents..."}
								</span>
							</div>
							<div className="flex items-center gap-1 flex-shrink-0">
								{selectedAgent && (
									<button
										onClick={handleClearSelection}
										className="rounded-full p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
										aria-label="Clear selection"
									>
										<X className="h-3 w-3" />
									</button>
								)}
								<ChevronsUpDown className="h-4 w-4 opacity-50" />
							</div>
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-full p-0 rounded-xl border shadow-lg" align="start">
						<AgentSelectorContent />
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}

export default MenuAgents;