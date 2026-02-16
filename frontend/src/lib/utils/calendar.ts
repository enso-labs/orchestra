import { addDays, subDays, isBefore, isAfter } from "date-fns";
import type { CronExecution, CronEvent, Cron } from "@/lib/entities/cron";

/**
 * Maps cron executions to calendar events.
 */
export function mapExecutionsToEvents(
	executions: CronExecution[],
	cronsMap: Map<string, Cron>,
): CronEvent[] {
	return executions.map((execution) => {
		const cron = cronsMap.get(execution.cron_id);
		const start = new Date(execution.scheduled_time);
		const end = execution.completed_at
			? new Date(execution.completed_at)
			: new Date(start.getTime() + 30 * 60 * 1000); // default 30min duration

		return {
			id: execution.id,
			title: cron?.title ?? "Unknown Cron",
			start,
			end,
			resource: {
				cron_id: execution.cron_id,
				execution_id: execution.id,
				thread_id: execution.thread_id,
				status: execution.status,
				agent_id: cron?.agent_id ?? null,
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
 * Maps cron definitions to projected calendar events using their next_run_time.
 * This ensures crons appear on the calendar even when they have no executions yet.
 */
export function mapCronsToProjectedEvents(crons: Cron[]): CronEvent[] {
	return crons
		.filter((s) => s.next_run_time)
		.map((cron) => {
			const start = new Date(cron.next_run_time);
			const end = new Date(start.getTime() + 30 * 60 * 1000);
			const agentId = cron.agent_id ?? cron.task?.metadata?.agent_id ?? null;

			return {
				id: `projected-${cron.id}`,
				title: cron.title ?? "Unknown Cron",
				start,
				end,
				resource: {
					cron_id: cron.id,
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
	executionEvents: CronEvent[],
	projectedEvents: CronEvent[],
): CronEvent[] {
	const coveredCronIds = new Set<string>();
	const ONE_HOUR_MS = 60 * 60 * 1000;

	for (const exec of executionEvents) {
		for (const proj of projectedEvents) {
			if (
				exec.resource.cron_id === proj.resource.cron_id &&
				Math.abs(exec.start.getTime() - proj.start.getTime()) < ONE_HOUR_MS
			) {
				coveredCronIds.add(proj.resource.cron_id);
			}
		}
	}

	const filteredProjected = projectedEvents.filter(
		(p) => !coveredCronIds.has(p.resource.cron_id),
	);

	return [...executionEvents, ...filteredProjected];
}

/**
 * Filters executions by period (PAST or FUTURE) and sorts descending by scheduled_time.
 */
export function filterExecutionsByPeriod(
	executions: CronExecution[],
	period: "PAST" | "FUTURE",
): CronExecution[] {
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
