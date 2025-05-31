import { useState, useEffect } from "react"
import {  deleteAgent } from "@/services/agentService"
import { toast } from "sonner"
import { Server, DashboardTabOption } from "@/entities"
import DashboardHeader from "./server-header"
import DashboardSearch from "./server-search"
import DashboardTabs from "./server-tabs"
import DashboardTabsContent from "./server-tabs-content"
import {listServers } from "@/services/serverService"

export default function ServerSection() {
	const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [myAgents, setMyAgents] = useState<Server[]>([])
  const [publicAgents, ] = useState<Server[]>([])
  const [privateAgents, setPrivateAgents] = useState<Server[]>([])
  const [filteredMyAgents, setFilteredMyAgents] = useState<Server[]>([])
  const [filteredPublicAgents, setFilteredPublicAgents] = useState<Server[]>([])
  const [filteredPrivateAgents, setFilteredPrivateAgents] = useState<Server[]>([])
  const [activeTab, setActiveTab] = useState<DashboardTabOption>("servers")
  const [isLoading, setIsLoading] = useState(true)
  // Fetch agents from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const res = await listServers();
        // const resPublic = await listPublicServers();
        const servers = res.data.servers || []
        // const publicServers = resPublic.data.servers || []

        // servers.push(...publicServers)
        
        // Filter agents into respective categories
        const privateServersList = servers
        // const publicServersList = servers

        setPrivateAgents(privateServersList)
        // setPublicAgents(publicServersList)

        // setFilteredPublicAgents(publicServersList)
        setFilteredPrivateAgents(privateServersList)
        
      } catch (error) {
        console.error("Failed to fetch agents:", error)
        toast.error("Failed to load agents")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
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
    const filterAgents = (agents: Server[]) => {
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
    <main className="px-4 py-4 sm:px-6">
			<div className="flex flex-col space-y-4">
				<DashboardHeader activeTab={activeTab} />

				{/* Search and filters */}
				<DashboardSearch
					searchTerm={searchTerm}
					setSearchTerm={setSearchTerm}
					selectedCategories={selectedCategories}
					setSelectedCategories={setSelectedCategories}
				/>

				{/* Reordered Tabs - Mine first */}
				<div className="w-full">
					<DashboardTabs
						activeTab={activeTab}
						setActiveTab={setActiveTab}
						filteredMyAgents={filteredMyAgents}
						filteredPublicAgents={filteredPublicAgents}
						filteredPrivateAgents={filteredPrivateAgents}
					/>

					{/* Tab content */}
					<DashboardTabsContent
						activeTab={activeTab}
						filteredMyAgents={filteredMyAgents}
						filteredPublicAgents={filteredPublicAgents}
						filteredPrivateAgents={filteredPrivateAgents}
						isLoading={isLoading}
						handleDeleteAgent={handleDeleteAgent}
					/>
				</div>
			</div>
		</main>
  )
}