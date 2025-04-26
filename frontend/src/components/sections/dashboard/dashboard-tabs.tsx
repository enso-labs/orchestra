import { Agent } from "@/entities"

function DashboardTabs({
	activeTab,
	setActiveTab,
	filteredMyAgents,
	filteredPublicAgents,
	filteredPrivateAgents,
}: {
	activeTab: string
	setActiveTab: (tab: string) => void
	filteredMyAgents: Agent[]
	filteredPublicAgents: Agent[]
	filteredPrivateAgents: Agent[]
}) {
	return (
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
	)
}

export default DashboardTabs;