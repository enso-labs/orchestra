import { describe, it, expect } from "vitest";
import {
	mapSchedulesToProjectedEvents,
	mergeAndDeduplicateEvents,
	mapExecutionsToEvents,
} from "./calendar";
import type {
	Schedule,
	ScheduleEvent,
	ScheduleExecution,
} from "@/lib/entities/schedule";

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
	return {
		id: "sched-1",
		title: "Test Schedule",
		trigger: { type: "cron", expression: "0 * * * *" },
		task: {
			input: { messages: [{ role: "user", content: "hello" }] },
			model: "gpt-4",
			metadata: { agent_id: "agent-1" },
		},
		next_run_time: "2026-03-01T12:00:00Z",
		...overrides,
	};
}

function makeScheduleEvent(
	overrides: Partial<ScheduleEvent> = {},
): ScheduleEvent {
	return {
		id: "exec-1",
		title: "Test Schedule",
		start: new Date("2026-03-01T12:00:00Z"),
		end: new Date("2026-03-01T12:30:00Z"),
		resource: {
			schedule_id: "sched-1",
			execution_id: "exec-1",
			thread_id: "thread-1",
			status: "success",
			agent_id: "agent-1",
		},
		...overrides,
	};
}

describe("mapSchedulesToProjectedEvents", () => {
	it("returns empty array for empty input", () => {
		expect(mapSchedulesToProjectedEvents([])).toEqual([]);
	});

	it("creates a projected event with correct field mapping", () => {
		const schedule = makeSchedule();
		const events = mapSchedulesToProjectedEvents([schedule]);

		expect(events).toHaveLength(1);
		const event = events[0];
		expect(event.id).toBe("projected-sched-1");
		expect(event.title).toBe("Test Schedule");
		expect(event.start).toEqual(new Date("2026-03-01T12:00:00Z"));
		expect(event.end).toEqual(
			new Date(new Date("2026-03-01T12:00:00Z").getTime() + 30 * 60 * 1000),
		);
		expect(event.resource.schedule_id).toBe("sched-1");
		expect(event.resource.execution_id).toBe("");
		expect(event.resource.thread_id).toBeNull();
		expect(event.resource.status).toBe("scheduled");
		expect(event.resource.agent_id).toBe("agent-1");
	});

	it("uses schedule.agent_id when available", () => {
		const schedule = makeSchedule({ agent_id: "top-level-agent" });
		const events = mapSchedulesToProjectedEvents([schedule]);
		expect(events[0].resource.agent_id).toBe("top-level-agent");
	});

	it("falls back to task.metadata.agent_id when agent_id is missing", () => {
		const schedule = makeSchedule({ agent_id: undefined });
		const events = mapSchedulesToProjectedEvents([schedule]);
		expect(events[0].resource.agent_id).toBe("agent-1");
	});

	it("filters out schedules with missing next_run_time", () => {
		const schedules = [
			makeSchedule({ id: "sched-1", next_run_time: "2026-03-01T12:00:00Z" }),
			makeSchedule({ id: "sched-2", next_run_time: "" }),
		];
		const events = mapSchedulesToProjectedEvents(schedules);
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe("projected-sched-1");
	});
});

describe("mergeAndDeduplicateEvents", () => {
	it("returns all execution events when there are no projected events", () => {
		const execEvents = [makeScheduleEvent()];
		const result = mergeAndDeduplicateEvents(execEvents, []);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("exec-1");
	});

	it("returns all projected events when there are no execution events", () => {
		const projected = [
			makeScheduleEvent({
				id: "projected-sched-1",
				resource: {
					schedule_id: "sched-1",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-1",
				},
			}),
		];
		const result = mergeAndDeduplicateEvents([], projected);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("projected-sched-1");
	});

	it("deduplicates projected events covered by an execution within 1 hour", () => {
		const execEvents = [
			makeScheduleEvent({
				id: "exec-1",
				start: new Date("2026-03-01T12:15:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "exec-1",
					thread_id: "thread-1",
					status: "success",
					agent_id: "agent-1",
				},
			}),
		];
		const projected = [
			makeScheduleEvent({
				id: "projected-sched-1",
				start: new Date("2026-03-01T12:00:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-1",
				},
			}),
		];

		const result = mergeAndDeduplicateEvents(execEvents, projected);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("exec-1");
	});

	it("keeps projected events when no execution is within 1 hour", () => {
		const execEvents = [
			makeScheduleEvent({
				id: "exec-1",
				start: new Date("2026-03-01T10:00:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "exec-1",
					thread_id: "thread-1",
					status: "success",
					agent_id: "agent-1",
				},
			}),
		];
		const projected = [
			makeScheduleEvent({
				id: "projected-sched-1",
				start: new Date("2026-03-01T14:00:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-1",
				},
			}),
		];

		const result = mergeAndDeduplicateEvents(execEvents, projected);
		expect(result).toHaveLength(2);
		expect(result.map((e) => e.id)).toContain("exec-1");
		expect(result.map((e) => e.id)).toContain("projected-sched-1");
	});

	it("preserves all execution events regardless of dedup", () => {
		const execEvents = [
			makeScheduleEvent({ id: "exec-1" }),
			makeScheduleEvent({ id: "exec-2" }),
		];
		const projected = [
			makeScheduleEvent({
				id: "projected-sched-1",
				resource: {
					schedule_id: "sched-1",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-1",
				},
			}),
		];

		const result = mergeAndDeduplicateEvents(execEvents, projected);
		// Both execution events should be present (projected gets deduped)
		expect(result.filter((e) => !e.id.startsWith("projected-"))).toHaveLength(
			2,
		);
	});

	it("handles different schedule IDs independently", () => {
		const execEvents = [
			makeScheduleEvent({
				id: "exec-1",
				start: new Date("2026-03-01T12:00:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "exec-1",
					thread_id: "thread-1",
					status: "success",
					agent_id: "agent-1",
				},
			}),
		];
		const projected = [
			makeScheduleEvent({
				id: "projected-sched-1",
				start: new Date("2026-03-01T12:00:00Z"),
				resource: {
					schedule_id: "sched-1",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-1",
				},
			}),
			makeScheduleEvent({
				id: "projected-sched-2",
				start: new Date("2026-03-01T12:00:00Z"),
				resource: {
					schedule_id: "sched-2",
					execution_id: "",
					thread_id: null,
					status: "scheduled",
					agent_id: "agent-2",
				},
			}),
		];

		const result = mergeAndDeduplicateEvents(execEvents, projected);
		// sched-1 projected is deduped, sched-2 projected is kept
		expect(result).toHaveLength(2);
		expect(result.map((e) => e.id)).toContain("exec-1");
		expect(result.map((e) => e.id)).toContain("projected-sched-2");
	});
});
