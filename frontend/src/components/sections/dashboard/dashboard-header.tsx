import { Link } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { DashboardTabOption } from "@/entities";

function AgentHeader() {
	return (
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
				New Agent
			</Link>
		</div>
	)
}

function WorkflowHeader() {
	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
			<div>
				<h1 className="text-2xl font-semibold text-foreground">Choose Your Workflow</h1>
				<p className="text-muted-foreground mt-1">Select an AI workflow to help with your specific needs</p>
			</div>
			<Link 
				to="/create-agent" 
				className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
			>
				<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
				New Workflow
			</Link>
		</div>
	)
}

function ServerHeader() {
	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
			<div>
				<h1 className="text-2xl font-semibold text-foreground">Choose Your Server</h1>
				<p className="text-muted-foreground mt-1">Select an AI server to help with your specific needs</p>
			</div>
			<Link 
				to="/create-agent" 
				className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
			>
				<PlusIcon className="mr-1.5 h-3.5 w-3.5" />
				New Server
			</Link>
		</div>
	)
}


function DashboardHeader({ activeTab }: { activeTab: DashboardTabOption }) {
  if (activeTab === "agents") {
    return <AgentHeader />
  } else if (activeTab === "workflows") {
    return <WorkflowHeader />
  } else if (activeTab === "servers") {
    return <ServerHeader />
  }
}

export default DashboardHeader;