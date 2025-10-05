import React from "react";
import { AgentScheduleCard } from "@/components/cards/AgentScheduleCard";
import { Schedule } from "@/lib/entities/schedule";
import { Agent } from "@/lib/services/agentService";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface AgentScheduleListProps {
	schedules: Schedule[];
	agent: Agent;
	onEdit?: (id: string) => void;
	onDelete?: (id: string) => void;
	onDuplicate?: (schedule: Schedule) => void;
	onToggle?: (id: string, enabled: boolean) => void;
	loading?: boolean;
	emptyMessage?: string;
	emptyDescription?: string;
}

export const AgentScheduleList: React.FC<AgentScheduleListProps> = ({
	schedules,
	agent,
	onEdit,
	onDelete,
	onDuplicate,
	onToggle,
	loading = false,
	emptyMessage = "No schedules found",
	emptyDescription = "Create your first schedule to get started",
}) => {
	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, index) => (
					<Card key={index} className="animate-pulse">
						<CardContent className="p-6">
							<div className="space-y-3">
								<div className="h-4 bg-muted rounded w-3/4"></div>
								<div className="h-3 bg-muted rounded w-1/2"></div>
								<div className="h-3 bg-muted rounded w-2/3"></div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (schedules.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Calendar className="h-12 w-12 text-muted-foreground mb-4" />
					<CardTitle className="text-lg mb-2">{emptyMessage}</CardTitle>
					<CardDescription className="text-center">
						{emptyDescription}
					</CardDescription>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{schedules.map((schedule) => (
				<AgentScheduleCard
					key={schedule.id}
					schedule={schedule}
					agent={agent}
					onEdit={onEdit}
					onDelete={onDelete}
					onDuplicate={onDuplicate}
					onToggle={onToggle}
				/>
			))}
		</div>
	);
};
