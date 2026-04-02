import { type LucideIcon } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/index";

interface ActivityBarItemProps {
	icon: LucideIcon;
	label: string;
	isActive: boolean;
	onClick: () => void;
	"data-tour"?: string;
}

export function ActivityBarItem({
	icon: Icon,
	label,
	isActive,
	onClick,
	...props
}: ActivityBarItemProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					onClick={onClick}
					data-tour={props["data-tour"]}
					className={cn(
						"relative flex items-center justify-center w-9 h-9 rounded-md transition-colors",
						"hover:bg-sidebar-accent hover:text-sidebar-foreground",
						isActive
							? "text-sidebar-foreground bg-sidebar-accent"
							: "text-sidebar-foreground/50",
					)}
				>
					{isActive && (
						<div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-5 bg-foreground rounded-t" />
					)}
					<Icon className="w-4.5 h-4.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={4}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
