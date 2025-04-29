import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LeftPanelLayoutProps {
	title?: string;
	status?: string;
	children: React.ReactNode;
	onCreate: () => void;
	isCreating: boolean;
}	

export function LeftPanelLayout({ 
	title = "New Enso",
	status = "Draft",
	children, 
	onCreate, 
	isCreating 
}: LeftPanelLayoutProps) {
	const navigate = useNavigate();
	
  return (
    <div className="p-4 h-full overflow-y-auto">
			<div className="flex items-center mb-6">
				<Button variant="ghost" size="icon" className="mr-2" onClick={() => navigate(-1)}>
					<ChevronLeft className="h-5 w-5" />
				</Button>
				<div>
					<h1 className="text-lg font-medium">{title}</h1>
					<p className="text-xs text-muted-foreground">• {status}</p>
				</div>
				<div className="ml-auto">
					<Button 
						className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" 
						onClick={onCreate}
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
