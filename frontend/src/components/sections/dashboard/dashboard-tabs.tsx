import { Agent, DashboardTabOption } from "@/entities"
import { useNavigate } from "react-router-dom";
function DashboardTabs({
	activeTab,
	setActiveTab,
	filteredMyAgents,
	// filteredPublicAgents,
	// filteredPrivateAgents,
}: {
	activeTab: string
	setActiveTab: (tab: DashboardTabOption) => void
	filteredMyAgents: Agent[]
	filteredPublicAgents: Agent[]
	filteredPrivateAgents: Agent[]
}) {
	const navigate = useNavigate();

	return (
		<div className="flex space-x-1 border-b border-border">
			<button
				className={`px-4 py-2 text-sm font-medium ${
					window.location.pathname === "/dashboard"
						? "border-b-2 border-primary text-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => navigate("/dashboard")}
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
					window.location.pathname === "/servers"
						? "border-b-2 border-primary text-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => navigate("/servers")}
			>
				Servers
			</button>
			<button
				className={`px-4 py-2 text-sm font-medium ${
					activeTab === "workflows"
						? "border-b-2 border-primary text-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => setActiveTab("workflows")}
			>
				Workflows
			</button>
			<button
				className={`px-4 py-2 text-sm font-medium ${
					activeTab === "chat"
						? "border-b-2 border-primary text-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => navigate("/chat")}
			>
				Chat
			</button>
		</div>
	)
}

export default DashboardTabs;