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
 * Maps schedule definitions to projected calendar events using their next_run_time.
 * This ensures schedules appear on the calendar even when they have no executions yet.
 */
export function mapSchedulesToProjectedEvents(
	schedules: Schedule[],
): ScheduleEvent[] {
	return schedules
		.filter((s) => s.next_run_time)
		.map((schedule) => {
			const start = new Date(schedule.next_run_time);
			const end = new Date(start.getTime() + 30 * 60 * 1000);
			const agentId =
				schedule.agent_id ?? schedule.task?.metadata?.agent_id ?? null;

			return {
				id: `projected-${schedule.id}`,
				title: schedule.title ?? "Unknown Schedule",
				start,
				end,
				resource: {
					schedule_id: schedule.id,
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: agentId,
				},
			};
		});
}

/**
 * Merges execution-based events with projected events, deduplicating
 * projected events that are already covered by an execution within 1 hour.
 */
export function mergeAndDeduplicateEvents(
	executionEvents: ScheduleEvent[],
	projectedEvents: ScheduleEvent[],
): ScheduleEvent[] {
	const coveredScheduleIds = new Set<string>();
	const ONE_HOUR_MS = 60 * 60 * 1000;

	for (const exec of executionEvents) {
		for (const proj of projectedEvents) {
			if (
				exec.resource.schedule_id === proj.resource.schedule_id &&
				Math.abs(exec.start.getTime() - proj.start.getTime()) < ONE_HOUR_MS
			) {
				coveredScheduleIds.add(proj.resource.schedule_id);
			}
		}
	}

	const filteredProjected = projectedEvents.filter(
		(p) => !coveredScheduleIds.has(p.resource.schedule_id),
	);

	return [...executionEvents, ...filteredProjected];
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
