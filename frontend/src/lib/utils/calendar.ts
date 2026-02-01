import { addDays, subDays, isBefore, isAfter } from "date-fns";
import type {
	ScheduleExecution,
	ScheduleEvent,
	Schedule,
} from "@/lib/entities/schedule";

/**
 * Maps schedule executions to calendar events.
 */
export function mapExecutionsToEvents(
	executions: ScheduleExecution[],
	schedulesMap: Map<string, Schedule>,
): ScheduleEvent[] {
	return executions.map((execution) => {
		const schedule = schedulesMap.get(execution.schedule_id);
		const start = new Date(execution.scheduled_time);
		const end = execution.completed_at
			? new Date(execution.completed_at)
			: new Date(start.getTime() + 30 * 60 * 1000); // default 30min duration

		return {
			id: execution.id,
			title: schedule?.title ?? "Unknown Schedule",
			start,
			end,
			resource: {
				schedule_id: execution.schedule_id,
				execution_id: execution.id,
				thread_id: execution.thread_id,
				status: execution.status,
				agent_id: schedule?.agent_id ?? null,
			},
		};
	});
}

/**
 * Returns a date range of 30 days past and 30 days future from the reference date.
 */
export function getCalendarDateRange(referenceDate?: Date): {
	startDate: Date;
	endDate: Date;
} {
	const ref = referenceDate ?? new Date();
	return {
		startDate: subDays(ref, 30),
		endDate: addDays(ref, 30),
	};
}

/**
 * Returns a hex color string for the given execution status.
 */
export function getExecutionStatusColor(status: string): string {
	switch (status) {
		case "scheduled":
		case "running":
			return "#3b82f6";
		case "success":
			return "#10b981";
		case "failure":
			return "#ef4444";
		default:
			return "#3b82f6";
	}
}

/**
 * Filters executions by period (PAST or FUTURE) and sorts descending by scheduled_time.
 */
export function filterExecutionsByPeriod(
	executions: ScheduleExecution[],
	period: "PAST" | "FUTURE",
): ScheduleExecution[] {
	const now = new Date();
	const filtered = executions.filter((e) => {
		const time = new Date(e.scheduled_time);
		return period === "PAST" ? isBefore(time, now) : isAfter(time, now);
	});

	return filtered.sort(
		(a, b) =>
			new Date(b.scheduled_time).getTime() -
			new Date(a.scheduled_time).getTime(),
	);
}
