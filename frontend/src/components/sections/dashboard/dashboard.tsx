import { useState } from "react"
import { DashboardTabOption } from "@/entities"
import DashboardHeader from "./dashboard-header"
import DashboardSearch from "./dashboard-search"
import DashboardTabs from "./dashboard-tabs"
import DashboardTabsContent from "./dashboard-tabs-content"
import { useAgentContext } from "@/context/AgentContext"
import { useAppContext } from "@/context/AppContext"

export default function DashboardSection() {
  const { loading } = useAppContext();
  const { 
    filteredAgents,
    publicAgents,
    privateAgents,
    useEffectGetAgents, 
    handleDeleteAgent, 
    useEffectGetFilteredAgents 
  } = useAgentContext();
	const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTabOption>("agents");

  useEffectGetAgents();
  useEffectGetFilteredAgents(searchTerm, selectedCategories);

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
						filteredMyAgents={filteredAgents}
						filteredPublicAgents={publicAgents}
						filteredPrivateAgents={privateAgents}
					/>

					{/* Tab content */}
					<DashboardTabsContent
						activeTab={activeTab}
						filteredMyAgents={filteredAgents}
						filteredPublicAgents={publicAgents}
						filteredPrivateAgents={privateAgents}
						isLoading={loading}
						handleDeleteAgent={handleDeleteAgent}
					/>
				</div>
			</div>
		</main>
  )
}