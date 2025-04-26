import { Link } from "react-router-dom";
import { PlusIcon } from "lucide-react";

function DashboardHeader() {
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
				Create New Agent
			</Link>
		</div>
  )
}

export default DashboardHeader;