import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ScheduleEvent } from "@/lib/entities/schedule";

type TableView = "past" | "future";

interface ScheduleTableProps {
	events: ScheduleEvent[];
	view?: TableView;
	onViewChange?: (view: TableView) => void;
	onEdit?: (scheduleId: string) => void;
	onDelete?: (scheduleId: string) => void;
	onDuplicate?: (scheduleId: string) => void;
}

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "success":
			return "default";
		case "failure":
			return "destructive";
		case "running":
			return "secondary";
		default:
			return "outline";
	}
}

export function ScheduleTable({
	events,
	view: controlledView,
	onViewChange,
	onEdit,
	onDelete,
	onDuplicate,
}: ScheduleTableProps) {
	const [internalView, setInternalView] = useState<TableView>("future");
	const view = controlledView ?? internalView;

	const handleViewChange = (newView: TableView) => {
		if (onViewChange) {
			onViewChange(newView);
		} else {
			setInternalView(newView);
		}
	};

	const filteredEvents = useMemo(() => {
		const now = new Date();
		const filtered = events.filter((event) => {
			return view === "past" ? event.start < now : event.start >= now;
		});
		return filtered.sort((a, b) => b.start.getTime() - a.start.getTime());
	}, [events, view]);

	return (
		<div className="space-y-4">
			{/* PAST / FUTURE toggle */}
			<div className="flex gap-2">
				<Button
					variant={view === "past" ? "default" : "outline"}
					size="sm"
					onClick={() => handleViewChange("past")}
				>
					Past
				</Button>
				<Button
					variant={view === "future" ? "default" : "outline"}
					size="sm"
					onClick={() => handleViewChange("future")}
				>
					Future
				</Button>
			</div>

			{/* Table */}
			{filteredEvents.length > 0 ? (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="text-left p-3 font-medium">Schedule Name</th>
								<th className="text-left p-3 font-medium">Status</th>
								<th className="text-left p-3 font-medium">Agent/Skill</th>
								<th className="text-left p-3 font-medium">
									{view === "past" ? "Last Run" : "Next Run"}
								</th>
								<th className="text-right p-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredEvents.map((event) => (
								<tr
									key={event.id}
									className="border-b last:border-b-0 hover:bg-muted/50"
								>
									<td className="p-3 font-medium">{event.title}</td>
									<td className="p-3">
										<Badge variant={getStatusVariant(event.resource.status)}>
											{event.resource.status}
										</Badge>
									</td>
									<td className="p-3 text-muted-foreground">
										{event.resource.agent_id ?? "—"}
									</td>
									<td className="p-3 text-muted-foreground">
										{formatDistanceToNow(event.start, {
											addSuffix: true,
										})}
									</td>
									<td className="p-3 text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon" className="h-8 w-8">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => onEdit?.(event.resource.schedule_id)}
												>
													<Pencil className="h-4 w-4 mr-2" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														onDuplicate?.(event.resource.schedule_id)
													}
												>
													<Copy className="h-4 w-4 mr-2" />
													Duplicate
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-destructive"
													onClick={() => onDelete?.(event.resource.schedule_id)}
												>
													<Trash2 className="h-4 w-4 mr-2" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<p className="text-lg font-medium">No schedules found</p>
					<p className="text-sm">
						No {view === "past" ? "past" : "upcoming"} schedules to display.
					</p>
				</div>
			)}
		</div>
	);
}
