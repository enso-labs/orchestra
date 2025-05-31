import { Agent } from "@/entities"
import { AgentCard, EmptyState } from "@/components/cards/AgentCard"

function DashboardTabsContent({
	activeTab,
	filteredMyAgents,
	filteredPublicAgents,
	filteredPrivateAgents,
	isLoading,
	handleDeleteAgent,
}: {
	activeTab: string
	filteredMyAgents: Agent[]
	filteredPublicAgents: Agent[]
	filteredPrivateAgents: Agent[]
	isLoading: boolean
	handleDeleteAgent: (agentId: string) => void
}) {
	return (
		<div className="mt-4">
			{activeTab === "agents" && (
				<div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-lg font-medium">My Agents</h2>
					</div>
					
					{isLoading ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						</div>
					) : filteredMyAgents.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-5">
							{filteredMyAgents.map((agent) => (
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
			)}

			{activeTab === "workflows" && (
				<div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
					{isLoading ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						</div>
					) : filteredPublicAgents.length > 0 ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
							{filteredPublicAgents.map((agent) => (
								<AgentCard key={agent.id} agent={agent} />
							))}
						</div>
					) : (
						<EmptyState message="No public agents found" />
					)}
				</div>
			)}

			{activeTab === "servers" && (
				<div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
					{isLoading ? (
						<div className="flex justify-center items-center h-40">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
						</div>
					) : filteredPrivateAgents.length > 0 ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
							{filteredPrivateAgents.map((agent) => (
								<AgentCard key={agent.id} agent={agent} />
							))}
						</div>
					) : (
						<EmptyState message="No private agents found" />
					)}
				</div>
			)}
		</div>
	)
}

export default DashboardTabsContent;