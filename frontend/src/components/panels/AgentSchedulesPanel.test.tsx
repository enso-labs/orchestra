import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AgentSchedulesPanel } from "@/components/panels/AgentSchedulesPanel";
import { AGENT_SCHEDULES_LOAD_TOAST_ID } from "@/hooks/useAgentSchedules";
import { Agent } from "@/lib/services/agentService";
import { Schedule } from "@/lib/entities/schedule";
import { toast } from "sonner";

// `toast.info` survives in this component ("Duplicate ... coming soon"), so a
// two-method mock would TypeError. Stub the whole surface the tree can reach.
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		info: vi.fn(),
	},
}));

const mockGetAgentSchedules = vi.fn();
const mockCreateAgentSchedule = vi.fn();
const mockUpdateAgentSchedule = vi.fn();
const mockDeleteSchedule = vi.fn();
const mockGetSchedule = vi.fn();

vi.mock("@/lib/services/scheduleService", () => ({
	default: {
		getAgentSchedules: (...args: any[]) => mockGetAgentSchedules(...args),
		createAgentSchedule: (...args: any[]) => mockCreateAgentSchedule(...args),
		updateAgentSchedule: (...args: any[]) => mockUpdateAgentSchedule(...args),
		deleteSchedule: (...args: any[]) => mockDeleteSchedule(...args),
		getSchedule: (...args: any[]) => mockGetSchedule(...args),
	},
}));

// Render dialogs inline: the assertions are about how many toasts a handler
// fires, not about Radix portal/focus behaviour.
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children }: any) => <div>{children}</div>,
	DialogTrigger: ({ children }: any) => <div>{children}</div>,
	DialogContent: ({ children }: any) => <div>{children}</div>,
	DialogHeader: ({ children }: any) => <div>{children}</div>,
	DialogTitle: ({ children }: any) => <div>{children}</div>,
	DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

// Stand-in for the real form: exposes a single submit button per mode.
vi.mock("@/components/forms/AgentScheduleForm", () => ({
	AgentScheduleForm: ({ onSubmit, initialData }: any) => (
		<button
			data-testid={initialData ? "submit-edit" : "submit-create"}
			onClick={() =>
				onSubmit({
					title: "Daily digest",
					trigger: { type: "cron", expression: "0 9 * * *" },
					task: {
						input: { messages: [{ role: "user", content: "go" }] },
						model: "gpt-4o",
					},
				})
			}
		>
			submit
		</button>
	),
}));

vi.mock("@/components/cards/AgentScheduleCard", () => ({
	AgentScheduleCard: ({ schedule, onEdit, onDelete }: any) => (
		<div>
			<button
				data-testid={`edit-${schedule.id}`}
				onClick={() => onEdit(schedule.id)}
			>
				edit
			</button>
			<button
				data-testid={`delete-${schedule.id}`}
				onClick={() => onDelete(schedule.id)}
			>
				delete
			</button>
		</div>
	),
}));

const scheduleCreateFixture = {
	title: "Daily digest",
	trigger: { type: "cron" as const, expression: "0 9 * * *" },
	task: {
		input: { messages: [{ role: "user" as const, content: "go" }] },
		model: "gpt-4o",
	},
};

const scheduleFixture: Schedule = {
	id: "sched-1",
	...scheduleCreateFixture,
	next_run_time: new Date(Date.now() + 3_600_000).toISOString(),
};

const agent: Agent = {
	id: "agent-1",
	name: "Scheduler",
	description: "",
	model: "gpt-4o",
	tools: [],
};

const renderPanel = async (override: Partial<Agent> = {}) => {
	const view = render(
		<AgentSchedulesPanel agent={{ ...agent, ...override }} />,
	);
	// Let the mount fetch settle so its toasts (if any) are already counted.
	await waitFor(() =>
		expect(screen.getByTestId("submit-create")).toBeInTheDocument(),
	);
	return view;
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
	mockGetAgentSchedules.mockResolvedValue({ schedules: [scheduleFixture] });
	mockCreateAgentSchedule.mockResolvedValue({});
	mockUpdateAgentSchedule.mockResolvedValue({});
	mockDeleteSchedule.mockResolvedValue(undefined);
	mockGetSchedule.mockResolvedValue({ schedule: scheduleFixture });
	vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("AgentSchedulesPanel — one toast per operation", () => {
	it("fires exactly one success toast when a create succeeds", async () => {
		await renderPanel();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() =>
			expect(mockCreateAgentSchedule).toHaveBeenCalledTimes(1),
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule created successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when a create fails", async () => {
		mockCreateAgentSchedule.mockRejectedValue(new Error("boom"));
		await renderPanel();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to create schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("fires exactly one success toast when an update succeeds", async () => {
		await renderPanel();

		fireEvent.click(screen.getByTestId("edit-sched-1"));
		await waitFor(() =>
			expect(screen.getByTestId("submit-edit")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("submit-edit"));

		await waitFor(() =>
			expect(mockUpdateAgentSchedule).toHaveBeenCalledTimes(1),
		);
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule updated successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when an update fails", async () => {
		mockUpdateAgentSchedule.mockRejectedValue(new Error("boom"));
		await renderPanel();

		fireEvent.click(screen.getByTestId("edit-sched-1"));
		await waitFor(() =>
			expect(screen.getByTestId("submit-edit")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("submit-edit"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to update schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("fires exactly one success toast when a delete succeeds", async () => {
		await renderPanel();

		fireEvent.click(screen.getByTestId("delete-sched-1"));

		await waitFor(() => expect(mockDeleteSchedule).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule deleted successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when a delete fails", async () => {
		mockDeleteSchedule.mockRejectedValue(new Error("boom"));
		await renderPanel();

		fireEvent.click(screen.getByTestId("delete-sched-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to delete schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("fires exactly one notification when loading a schedule for editing fails", async () => {
		mockGetSchedule.mockRejectedValue(new Error("boom"));
		await renderPanel();

		fireEvent.click(screen.getByTestId("edit-sched-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).not.toHaveBeenCalledWith(
			"Failed to load schedule for editing",
		);
		// The one surviving message must name the operation that failed — not a
		// near-copy of the list-load message that fires from the same screen.
		const [message] = vi.mocked(toast.error).mock.calls[0];
		expect(message).toBe("Failed to open schedule");
		expect(message).not.toBe("Failed to load schedules");
	});

	it("does not toast the refetch failure when the create itself succeeded", async () => {
		// Mount fetch resolves; the post-create refresh is the one that fails.
		mockGetAgentSchedules
			.mockResolvedValueOnce({ schedules: [scheduleFixture] })
			.mockRejectedValue(new Error("boom"));
		await renderPanel();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(mockGetAgentSchedules).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("reports an error instead of failing silently when the agent has no id", async () => {
		await renderPanel({ id: "" });

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith(
			"Cannot create schedule: no agent selected",
		);
		expect(toast.success).not.toHaveBeenCalled();
		expect(mockCreateAgentSchedule).not.toHaveBeenCalled();
	});
});

describe("AgentSchedulesPanel — toast ids", () => {
	it("gives the mount-driven load failure a stable id", async () => {
		mockGetAgentSchedules.mockRejectedValue(new Error("boom"));
		await renderPanel();

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to load schedules", {
			id: AGENT_SCHEDULES_LOAD_TOAST_ID,
		});
	});

	it("gives write toasts no id, so repeated writes each notify", async () => {
		await renderPanel();

		fireEvent.click(screen.getByTestId("submit-create"));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		fireEvent.click(screen.getByTestId("submit-create"));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));

		for (const call of vi.mocked(toast.success).mock.calls) {
			expect(call).toHaveLength(1);
		}
	});
});
