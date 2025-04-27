import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function LeftPanelLayout({ 
	children, 
	processCreateAgent, 
	isCreating 
}: { children: React.ReactNode, processCreateAgent: () => void, isCreating: boolean }) {
	const navigate = useNavigate();
	
  return (
    <div className="p-4 h-full overflow-y-auto">
			<div className="flex items-center mb-6">
				<Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate("/")}>
					<ChevronLeft className="h-5 w-5" />
				</Button>
				<div>
					<h1 className="text-lg font-medium">New Enso</h1>
					<p className="text-xs text-muted-foreground">• Draft</p>
				</div>
				<div className="ml-auto">
					<Button 
						className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" 
						onClick={processCreateAgent}
						disabled={isCreating}
					>
						{isCreating ? "Creating..." : "Create"}
					</Button>
				</div>
			</div>

			{/* Desktop Tabs - Only visible on desktop */}
			<div className="hidden md:block">
				{children}
			</div>
		</div>
  )
}

export default LeftPanelLayout;
