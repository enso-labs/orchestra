import { useState, useEffect } from "react"
import { getAgents, deleteAgent } from "@/services/agentService"
import { toast } from "sonner"
import { Agent } from "@/entities"
import { EmptyState, AgentCard } from "@/components/cards/AgentCard"
import DashboardHeader from "./dashboard-header"
import DashboardSearch from "./dashboard-search"

export default function DashboardSection() {
	const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [myAgents, setMyAgents] = useState<Agent[]>([])
  const [publicAgents, setPublicAgents] = useState<Agent[]>([])
  const [privateAgents, setPrivateAgents] = useState<Agent[]>([])
  const [filteredMyAgents, setFilteredMyAgents] = useState<Agent[]>([])
  const [filteredPublicAgents, setFilteredPublicAgents] = useState<Agent[]>([])
  const [filteredPrivateAgents, setFilteredPrivateAgents] = useState<Agent[]>([])
  const [activeTab, setActiveTab] = useState("mine") // Changed default to "mine"
  const [isLoading, setIsLoading] = useState(true)

  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setIsLoading(true)
        const result = await getAgents()
        const agents = result.agents || []
        
        // Filter agents into respective categories
        const myAgentsList = agents.filter((agent: Agent) => !agent.public)
        const publicAgentsList = agents.filter((agent: Agent) => agent.public)
        
        // For now, we'll keep privateAgents separate, but in a real app
        // this might be agents shared with you but not owned by you
        const privateAgentsList: Agent[] = []
        
        setMyAgents(myAgentsList)
        setPublicAgents(publicAgentsList)
        setPrivateAgents(privateAgentsList)
        
        setFilteredMyAgents(myAgentsList)
        setFilteredPublicAgents(publicAgentsList)
        setFilteredPrivateAgents(privateAgentsList)
      } catch (error) {
        console.error("Failed to fetch agents:", error)
        toast.error("Failed to load agents")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchAgents()
  }, [])

  // Handle agent deletion
  const handleDeleteAgent = async (agentId: string) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      try {
        await deleteAgent(agentId)
        
        // Update the agents list after deletion
        setMyAgents(prevAgents => prevAgents.filter(agent => agent.id !== agentId))
        setFilteredMyAgents(prevAgents => prevAgents.filter(agent => agent.id !== agentId))
        
        toast.success("Agent deleted successfully")
      } catch (error) {
        console.error("Failed to delete agent:", error)
        toast.error("Failed to delete agent")
      }
    }
  }

  // Filter agents based on search term and selected categories
  useEffect(() => {
    const filterAgents = (agents: Agent[]) => {
      return agents.filter((agent) => {
        const matchesSearch =
          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesCategories =
          selectedCategories.length === 0 || 
          (agent.categories && selectedCategories.some(cat => agent.categories?.includes(cat)))

        return matchesSearch && matchesCategories
      })
    }

    setFilteredMyAgents(filterAgents(myAgents))
    setFilteredPublicAgents(filterAgents(publicAgents))
    setFilteredPrivateAgents(filterAgents(privateAgents))
  }, [searchTerm, selectedCategories, myAgents, publicAgents, privateAgents])

  return (
    <main className="max-w-8xl mx-auto px-4 py-4 sm:px-6">
			<div className="flex flex-col space-y-4">
				<DashboardHeader />

				{/* Search and filters */}
				<DashboardSearch
					searchTerm={searchTerm}
					setSearchTerm={setSearchTerm}
					selectedCategories={selectedCategories}
					setSelectedCategories={setSelectedCategories}
				/>

				{/* Reordered Tabs - Mine first */}
				<div className="w-full">
					<div className="flex space-x-1 border-b border-border">
						<button
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "mine"
									? "border-b-2 border-primary text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => setActiveTab("mine")}
						>
							Agents
							{filteredMyAgents.length > 0 && (
								<span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
									{filteredMyAgents.length}
								</span>
							)}
						</button>
						<button
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "public"
									? "border-b-2 border-primary text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => setActiveTab("public")}
						>
							Public
							{filteredPublicAgents.length > 0 && (
								<span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
									{filteredPublicAgents.length}
								</span>
							)}
						</button>
						<button
							className={`px-4 py-2 text-sm font-medium ${
								activeTab === "private"
									? "border-b-2 border-primary text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => setActiveTab("private")}
						>
							Private
							{filteredPrivateAgents.length > 0 && (
								<span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
									{filteredPrivateAgents.length}
								</span>
							)}
						</button>
					</div>

					{/* Tab content */}
					<div className="mt-4">
						{activeTab === "mine" && (
							<div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-lg font-medium">My Agents</h2>
								</div>
								
								{isLoading ? (
									<div className="flex justify-center items-center h-40">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
									</div>
								) : filteredMyAgents.length > 0 ? (
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
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

						{activeTab === "public" && (
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

						{activeTab === "private" && (
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
				</div>
			</div>
		</main>
  )
}