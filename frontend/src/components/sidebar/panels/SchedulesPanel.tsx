import * as React from "react";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarMenu } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { useScheduleExecutions } from "@/hooks/useScheduleExecutions";
import { useSchedules } from "@/hooks/useSchedules";
import { ScheduleSidebarItem } from "@/components/sidebar/ScheduleSidebarItem";

export function SchedulesPanel() {
	const { executions, loading } = useScheduleExecutions({ limit: 10 });
	const { schedules, fetchSchedules } = useSchedules();
	const navigate = useNavigate();

	React.useEffect(() => {
		fetchSchedules();
	}, [fetchSchedules]);

	const schedulesMap = React.useMemo(() => {
		const map = new Map<string, string>();
		for (const s of schedules) {
			map.set(s.id, s.title);
		}
		return map;
	}, [schedules]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
				<span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/70">
					Schedules
				</span>
			</div>
			<div className="overflow-auto flex-1 px-1 pt-1">
				<div className="px-2 pb-2">
					<Button
						variant="outline"
						size="sm"
						className="w-full justify-start gap-2"
						onClick={() => navigate("/schedules")}
					>
						<Calendar className="h-4 w-4" />
						View All Schedules
					</Button>
				</div>
				<SidebarMenu className="gap-0">
					{loading ? (
						<div className="flex items-center justify-center gap-2 p-3 text-sm text-sidebar-foreground/60">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Loading...</span>
						</div>
					) : executions.length > 0 ? (
						executions.map((execution) => (
							<ScheduleSidebarItem
								key={execution.id}
								execution={execution}
								scheduleName={
									schedulesMap.get(execution.schedule_id) ?? "Unknown Schedule"
								}
							/>
						))
					) : (
						<div className="px-3 py-4 text-center text-sm text-sidebar-foreground/50">
							No recent executions
						</div>
					)}
				</SidebarMenu>
			</div>
		</div>
	);
}
