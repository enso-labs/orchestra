import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import AuthLayout from "../layouts/AuthLayout"
import { Search, X, PlusIcon } from "lucide-react"
import { getAgents, deleteAgent } from "../services/agentService"
import { toast } from "sonner"
import { Agent } from "@/entities"
import { EmptyState, AgentCard } from "@/components/cards/AgentCard"

export default function Dashboard() {
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

  // Toggle category selection
  // const toggleCategory = (category: string) => {
  //   setSelectedCategories((prev) =>
  //     prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
  //   )
  // }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategories([])
  }

  return (
    <AuthLayout>
      <main className="max-w-8xl mx-auto px-4 py-4 sm:px-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Choose Your Agent</h1>
              <p className="text-muted-foreground mt-1">Select an AI agent to help with your specific needs</p>
            </div>
            <Link 
              to="/create-agent" 
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
              Create New Agent
            </Link>
          </div>

          {/* Search and filters */}
          <div className="bg-background/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/70 transition-all"
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {selectedCategories.length > 0 && (
                  <button
                    className="h-10 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors"
                    onClick={clearFilters}
                  >
                    Clear Filters ({selectedCategories.length})
                    <X className="ml-2 h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

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
                Mine
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
    </AuthLayout>
  )
}