import { AgentCard, EmptyState } from "@/components/cards/AgentCard"
import DashboardSearch from "@/components/sections/dashboard/dashboard-search";
import { useAgentContext } from "@/context/AgentContext";
import { useAppContext } from "@/context/AppContext"
import { Agent } from "@/lib/entities";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

function AgentIndex() {
	const { isLoading } = useAppContext();
	const { filteredAgents, handleDeleteAgent, useEffectGetAgents, useEffectGetFilteredAgents } = useAgentContext();
	const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

	useEffectGetAgents();
	useEffectGetFilteredAgents(searchTerm, selectedCategories);
	return (
		<main className="px-4 py-4 sm:px-6">
			<div className="flex flex-col space-y-4">

				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div>
						<h1 className="text-2xl font-semibold text-foreground">Choose Your Agent</h1>
						<p className="text-muted-foreground mt-1">Select an AI agent to help with your specific needs</p>
					</div>
					<Link 
						to="/agents/create" 
						className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
					>
						<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
						New Agent
					</Link>
				</div>

				<DashboardSearch
					searchTerm={searchTerm}
					setSearchTerm={setSearchTerm}
					selectedCategories={selectedCategories}
					setSelectedCategories={setSelectedCategories}
				/>

				<div className="overflow-auto pr-2">
			
					{isLoading ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						</div>
					) : filteredAgents.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-5">
							{filteredAgents.map((agent: Agent) => (
								<AgentCard 
									key={agent.id} 
									agent={agent} 
									editable={true}
									onDelete={handleDeleteAgent}
								/>
							))}
						</div>
					) : (
						<EmptyState message="You don't have any agents yet" />
					)}
				</div>
			</div>
		</main>
	)
}

export default AgentIndex;