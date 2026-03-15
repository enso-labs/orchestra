import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeartbeatSection } from "@/components/heartbeat/HeartbeatSection";
import type {
	HeartbeatConfig,
	HeartbeatState,
	HeartbeatTickResult,
} from "@/lib/entities/heartbeat";

const mockAgents = [
	{ id: "agent-1", name: "Test Agent" },
	{ id: "agent-2", name: "Another Agent" },
];

const mockConfig: HeartbeatConfig = {
	user_id: "user-1",
	assistant_id: "agent-1",
	enabled: true,
	checklist: "- [ ] Check inbox\n- [ ] Review alerts",
	every_seconds: 3600,
	active_hours: { start: "09:00", end: "22:00", timezone: "UTC" },
	isolated_session: true,
	light_context: true,
	ack_max_chars: 300,
	prompt: "Test prompt",
	schedule_id: "sched-1",
};

const mockState: HeartbeatState = {
	last_run_at: "2026-03-15T10:00:00Z",
	last_result: "ok",
	consecutive_ok_count: 5,
	next_due_at: "2026-03-15T11:00:00Z",
	total_ticks: 10,
	total_escalations: 2,
	last_escalation_at: null,
};

const mockHistory: HeartbeatTickResult[] = [
	{
		action: "escalated",
		reason: "Issue found in monitoring",
		response: "Alert details here",
		tokens_used: 150,
		duration_ms: 1200,
		timestamp: "2026-03-15T09:00:00Z",
	},
	{
		action: "ok",
		reason: "All checks passed",
		response: "HEARTBEAT_OK",
		tokens_used: 50,
		duration_ms: 800,
		timestamp: "2026-03-15T08:00:00Z",
	},
];

const defaultProps = {
	config: null as HeartbeatConfig | null,
	state: null as HeartbeatState | null,
	history: [] as HeartbeatTickResult[],
	agents: mockAgents,
	loading: false,
	onSave: vi.fn(),
	onDelete: vi.fn(),
	onTriggerTick: vi.fn(),
};

describe("HeartbeatSection", () => {
	it("renders collapsed when no config", () => {
		render(<HeartbeatSection {...defaultProps} />);
		expect(screen.getByText("Heartbeat Monitor")).toBeDefined();
		// Should not show Active badge
		expect(screen.queryByText("Active")).toBeNull();
	});

	it("shows Active badge when enabled", () => {
		render(
			<HeartbeatSection
				{...defaultProps}
				config={mockConfig}
				state={mockState}
				history={mockHistory}
			/>,
		);
		expect(screen.getByText("Active")).toBeDefined();
	});

	it("calls onSave with form data on Save click", async () => {
		const onSave = vi.fn();
		render(
			<HeartbeatSection
				{...defaultProps}
				config={mockConfig}
				state={mockState}
				onSave={onSave}
			/>,
		);

		// Config is enabled so section starts open - no need to click trigger
		const saveButton = screen.getByText("Save");
		fireEvent.click(saveButton);

		expect(onSave).toHaveBeenCalledTimes(1);
		const callArg = onSave.mock.calls[0][0];
		expect(callArg.assistant_id).toBe("agent-1");
		expect(callArg.every_seconds).toBe(3600);
	});

	it("calls onTriggerTick on Test Tick click", () => {
		const onTriggerTick = vi.fn();
		render(
			<HeartbeatSection
				{...defaultProps}
				config={mockConfig}
				state={mockState}
				onTriggerTick={onTriggerTick}
			/>,
		);

		// Config is enabled so section starts open
		const testTickButton = screen.getByText("Test Tick");
		fireEvent.click(testTickButton);

		expect(onTriggerTick).toHaveBeenCalledTimes(1);
	});

	it("displays status card metrics from state", () => {
		render(
			<HeartbeatSection
				{...defaultProps}
				config={mockConfig}
				state={mockState}
			/>,
		);

		// Config is enabled so section starts open
		expect(screen.getByText("5")).toBeDefined(); // consecutive_ok_count
		expect(screen.getByText("10 / 2")).toBeDefined(); // total_ticks / total_escalations
	});

	it("renders activity timeline entries from history", () => {
		render(
			<HeartbeatSection
				{...defaultProps}
				config={mockConfig}
				state={mockState}
				history={mockHistory}
			/>,
		);

		// Config is enabled so section starts open
		expect(screen.getByText("Recent Activity")).toBeDefined();
		expect(screen.getByText(/Issue found in monitoring/)).toBeDefined();
		expect(screen.getByText(/All checks passed/)).toBeDefined();
	});
});
