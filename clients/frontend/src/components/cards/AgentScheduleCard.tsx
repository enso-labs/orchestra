import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Schedule } from "@/lib/entities/schedule";
import { Agent } from "@/lib/services/agentService";
import { getHumanReadableCron, getStatusColor } from "@/lib/utils/schedule";
import {
	Clock,
	Calendar,
	MoreHorizontal,
	Pause,
	Trash2,
	Copy,
	Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AgentScheduleCardProps {
	schedule: Schedule;
	agent: Agent;
	onEdit?: (id: string) => void;
	onDelete?: (id: string) => void;
	onDuplicate?: (schedule: Schedule) => void;
	onToggle?: (id: string, enabled: boolean) => void;
}

export const AgentScheduleCard: React.FC<AgentScheduleCardProps> = ({
	schedule,
	agent,
	onEdit,
	onDelete,
	onDuplicate,
	onToggle,
}) => {
	const getStatusText = (nextRunTime: string) => {
		const nextRun = new Date(nextRunTime);
		const now = new Date();

		if (nextRun < now) return "Overdue";
		return `Next: ${formatDistanceToNow(nextRun, { addSuffix: true })}`;
	};

	const getTaskSummary = () => {
		const message = schedule.task.messages?.[0]?.content;
		if (typeof message === "string") {
			return message.length > 60 ? `${message.substring(0, 60)}...` : message;
		}
		return "Complex message";
	};

	const isInherited = schedule.task.metadata?.inherited_from_agent;

	return (
		<Card className="hover:shadow-md transition-shadow duration-200">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-primary" />
						<Badge
							variant={getStatusColor(schedule.next_run_time)}
							className="text-xs"
						>
							{getStatusText(schedule.next_run_time)}
						</Badge>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onEdit && (
								<DropdownMenuItem onClick={() => onEdit(schedule.id)}>
									<Settings className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
							)}
							{onDuplicate && (
								<DropdownMenuItem onClick={() => onDuplicate(schedule)}>
									<Copy className="mr-2 h-4 w-4" />
									Duplicate
								</DropdownMenuItem>
							)}
							{onToggle && (
								<DropdownMenuItem onClick={() => onToggle(schedule.id, false)}>
									<Pause className="mr-2 h-4 w-4" />
									Pause
								</DropdownMenuItem>
							)}
							{onDelete && (
								<DropdownMenuItem
									onClick={() => onDelete(schedule.id)}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<CardTitle className="text-base line-clamp-2">
					{schedule.title}
				</CardTitle>
				<CardDescription className="text-sm">
					<div className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{getHumanReadableCron(schedule.trigger.expression)}
					</div>
					<div className="mt-1 text-xs text-muted-foreground line-clamp-1">
						{getTaskSummary()}
					</div>
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="space-y-3">
					{/* Schedule Details */}
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline" className="text-xs">
							{schedule.task.model}
						</Badge>
						{isInherited && (
							<Badge variant="secondary" className="text-xs">
								Inherited from Agent
							</Badge>
						)}
					</div>

					{/* Agent Context */}
					<div className="text-xs text-muted-foreground">
						<div className="flex items-center justify-between">
							<span>Agent: {agent.name}</span>
							<span className="font-mono">{schedule.trigger.expression}</span>
						</div>
					</div>

					{/* Tools */}
					{schedule.task.tools && schedule.task.tools.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{schedule.task.tools.slice(0, 3).map((tool, index) => (
								<Badge key={index} variant="outline" className="text-xs">
									{tool}
								</Badge>
							))}
							{schedule.task.tools.length > 3 && (
								<Badge variant="outline" className="text-xs">
									+{schedule.task.tools.length - 3} more
								</Badge>
							)}
						</div>
					)}

					{/* Next Run Details */}
					<div className="text-xs text-muted-foreground border-t pt-2">
						<div className="flex items-center justify-between">
							<span>Next run:</span>
							<span>{new Date(schedule.next_run_time).toLocaleString()}</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
