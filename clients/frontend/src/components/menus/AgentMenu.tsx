import { useState } from "react";
import { useAgentContext } from "@/context/AgentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search, Bot, X } from "lucide-react";
import { Agent } from "@/lib/services/agentService";
import { cn } from "@/lib/utils";
import useAppHook from "@/hooks/useAppHook";
import { INIT_AGENT_STATE } from "@/hooks/useAgent";

const AgentSelectorContent = ({
	setOpen,
}: {
	setOpen: (open: boolean) => void;
}) => {
	const { isMobile } = useAppHook();
	const { agents, setAgent, agent } = useAgentContext();
	const [searchTerm, setSearchTerm] = useState("");

	const handleAgentSelect = (agent: Agent) => {
		setAgent(agent);
		setOpen(false);
		setSearchTerm("");
	};

	const clearSelection = () => {
		setOpen(false);
		setSearchTerm("");
		setAgent(INIT_AGENT_STATE.agent);
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
	const filteredAgents =
		agents?.filter(
			(agent: Agent) =>
				agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				agent.description?.toLowerCase().includes(searchTerm.toLowerCase()),
		) || [];

	return (
		<div className="flex flex-col">
			{/* Search Input */}
			<div
				className="flex items-center border-b px-3 py-2"
				onClick={handleSearchClick}
			>
				<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
				<Input
					placeholder="Search agents..."
					value={searchTerm}
					onChange={handleSearchChange}
					onClick={handleSearchClick}
					onKeyDown={handleSearchKeyDown}
					onFocus={(e: React.FocusEvent<HTMLInputElement>) =>
						handleSearchClick(e as unknown as React.MouseEvent)
					}
					className="border-0 px-0 py-1 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
			</div>

			{/* Clear Option */}
			{agent && (
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
			<div
				className={`${isMobile() ? "max-h-[60vh]" : "max-h-[200px]"} overflow-auto`}
			>
				{filteredAgents.length > 0 ? (
					<div className="p-1">
						{filteredAgents.map((filteredAgent: Agent) => (
							<div
								key={filteredAgent.id}
								className={cn(
									"flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-sm",
									agent?.id === filteredAgent.id &&
										"bg-accent text-accent-foreground",
								)}
								onClick={() => handleAgentSelect(filteredAgent)}
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="flex-shrink-0">
										<div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
											<Bot className="h-3 w-3 text-primary" />
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate">
											{filteredAgent.name}
										</div>
										{filteredAgent.description && (
											<div className="text-xs text-muted-foreground truncate">
												{filteredAgent.description}
											</div>
										)}
									</div>
								</div>
								<Check
									className={cn(
										"h-4 w-4 flex-shrink-0",
										agent?.id === filteredAgent.id
											? "opacity-100"
											: "opacity-0",
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
};

function AgentMenuMobile({
	open,
	setOpen,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
}) {
	const { setAgent, agent } = useAgentContext();

	const handleClearSelection = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setAgent(INIT_AGENT_STATE.agent);
	};
	return (
		<>
			<Button
				variant={agent.id ? "outline" : "default"}
				role="combobox"
				aria-expanded={open}
				className={cn(
					"rounded-xl h-9 text-sm font-normal",
					agent.id ? "w-full justify-between" : "w-9 p-0 justify-center",
				)}
				onClick={() => setOpen(true)}
			>
				{agent.id ? (
					<>
						<div className="flex items-center gap-2 flex-1 min-w-0">
							<Bot className="h-4 w-4 opacity-50 flex-shrink-0" />
							<span className="truncate">{agent.name}</span>
						</div>
						<div className="flex items-center gap-1 flex-shrink-0">
							<button
								onClick={handleClearSelection}
								className="rounded-full p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
								aria-label="Clear selection"
							>
								<X className="h-3 w-3" />
							</button>
							<ChevronsUpDown className="h-4 w-4 opacity-50" />
						</div>
					</>
				) : (
					<Bot className="h-5 w-5" />
				)}
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
								<AgentSelectorContent setOpen={setOpen} />
							</div>
						</div>
					</div>
				</>
			)}
		</>
	);
}

function AgentMenu() {
	const { setAgent, useEffectGetAgents, agent } = useAgentContext();
	const { isMobile } = useAppHook();
	const [open, setOpen] = useState(false);

	useEffectGetAgents();

	const handleClearSelection = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setAgent(INIT_AGENT_STATE.agent);
	};

	if (isMobile()) {
		return (
			<div className="w-full">
				<AgentMenuMobile open={open} setOpen={setOpen} />
			</div>
		);
	}

	return (
		<div className={agent.id ? "w-full" : "w-auto"}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant={agent.id ? "outline" : "default"}
						role="combobox"
						aria-expanded={open}
						className={cn(
							"rounded-xl h-9 text-sm font-normal",
							agent.id ? "w-full justify-between" : "w-9 p-0 justify-center",
						)}
					>
						{agent.id ? (
							<>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<Bot className="h-4 w-4 opacity-50 flex-shrink-0" />
									<span className="truncate">{agent.name}</span>
								</div>
								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										onClick={handleClearSelection}
										className="rounded-full p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
										aria-label="Clear selection"
									>
										<X className="h-3 w-3" />
									</button>
									<ChevronsUpDown className="h-4 w-4 opacity-50" />
								</div>
							</>
						) : (
							<Bot className="h-6 w-6" />
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-full p-0 rounded-xl border shadow-lg"
					align="start"
				>
					<AgentSelectorContent setOpen={setOpen} />
				</PopoverContent>
			</Popover>
		</div>
	);
}

export default AgentMenu;
