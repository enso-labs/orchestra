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
						"relative flex items-center justify-center w-10 h-10 rounded-lg transition-all",
						"hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
						isActive
							? "text-sidebar-foreground"
							: "text-sidebar-foreground/40 hover:text-sidebar-foreground/70",
					)}
				>
					<Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
					{isActive && (
						<div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-5 bg-foreground rounded-full" />
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
