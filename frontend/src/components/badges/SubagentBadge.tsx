import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubagentBadgeProps {
	name: string;
	className?: string;
}

export function SubagentBadge({ name, className }: SubagentBadgeProps) {
	return (
		<span
			data-testid="subagent-badge"
			className={cn(
				"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground select-none",
				className,
			)}
		>
			<Bot className="h-3 w-3" />
			<span className="truncate max-w-[120px]">{name}</span>
		</span>
	);
}

export default SubagentBadge;
