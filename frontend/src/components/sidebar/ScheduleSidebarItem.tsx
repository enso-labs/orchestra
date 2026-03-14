import { formatDistanceToNow } from "date-fns";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { ScheduleExecution } from "@/lib/entities/schedule";
import { getExecutionStatusColor } from "@/lib/utils/calendar";

interface ScheduleSidebarItemProps {
	execution: ScheduleExecution;
	scheduleName: string;
}

export function ScheduleSidebarItem({
	execution,
	scheduleName,
}: ScheduleSidebarItemProps) {
	const statusEmoji =
		execution.status === "success"
			? "🟢"
			: execution.status === "failure"
				? "🔴"
				: "🔵";
	const statusColor = getExecutionStatusColor(execution.status);
	const relativeTime = formatDistanceToNow(new Date(execution.scheduled_time), {
		addSuffix: true,
	});
	const hasThread = !!execution.thread_id;

	const handleClick = () => {
		if (hasThread) {
			window.open(
				`/thread/${execution.thread_id}`,
				"_blank",
				"noopener,noreferrer",
			);
		}
	};

	return (
		<SidebarMenuItem className="mb-1">
			<SidebarMenuButton
				asChild
				className={`h-auto px-3 py-2 rounded-lg border transition-all bg-transparent border-sidebar-border hover:bg-sidebar-accent/50 hover:border-sidebar-accent/50 ${
					!hasThread ? "opacity-60 cursor-default" : "cursor-pointer"
				}`}
			>
				<button
					onClick={handleClick}
					title={hasThread ? `Open thread` : "Execution pending"}
				>
					<div className="flex items-center gap-2 w-full min-w-0">
						<span className="shrink-0 text-xs" style={{ color: statusColor }}>
							{statusEmoji}
						</span>
						<div className="flex flex-col min-w-0 flex-1">
							<span className="text-sm font-medium text-sidebar-foreground truncate">
								{scheduleName}
							</span>
							<span className="text-[10px] text-sidebar-foreground/50">
								{relativeTime}
							</span>
						</div>
					</div>
				</button>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
