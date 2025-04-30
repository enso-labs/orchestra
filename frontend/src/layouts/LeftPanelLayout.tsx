import { Button } from "@/components/ui/button";
import { ChevronLeft, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LeftPanelLayoutProps {
	title?: string;
	status?: string;
	children: React.ReactNode;
	onCreate: () => void;
	loading: boolean;
	disabled?: boolean;
	onDelete?: () => void;
}	

export function LeftPanelLayout({ 
	title = "New Enso",
	status = "Draft",
	children, 
	onCreate, 
	loading,
	disabled = false,
	onDelete,

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
					<p className="text-xs text-muted-foreground">{status}</p>
				</div>
				<div className="ml-auto flex">
					{onDelete && (
						<Button 
							variant="destructive"
							size="icon"
							className="mr-2 h-9 w-9"
							onClick={onDelete}
						>
							<Trash className="h-5 w-5" />
						</Button>
					)}
					<Button 
						variant="default"
						size="icon"
						className="h-9 w-9"
						onClick={onCreate}
						disabled={loading || disabled}
					>
						{loading ? 
							<span className="h-5 w-5 animate-spin">⟳</span> : 
							<span className="h-5 w-5">💾</span>
						}
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
