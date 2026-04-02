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
						"relative flex items-center justify-center w-full h-12 transition-colors",
						"hover:text-sidebar-foreground",
						isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/50",
					)}
				>
					{isActive && (
						<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-foreground rounded-r" />
					)}
					<Icon className="w-5 h-5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="right" sideOffset={8}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
