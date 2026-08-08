import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SchedulesIndexPage from "@/pages/schedules/index";
import { SCHEDULES_LOAD_TOAST_ID } from "@/hooks/useSchedules";
import { Schedule } from "@/lib/entities/schedule";
import { toast } from "sonner";

// `toast.info` survives on this page ("Duplicate ... coming soon"), so a
// two-method mock would TypeError.
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		info: vi.fn(),
	},
}));

const mockGetAllSchedules = vi.fn();
const mockCreateSchedule = vi.fn();
const mockUpdateSchedule = vi.fn();
const mockDeleteSchedule = vi.fn();
const mockGetSchedule = vi.fn();

vi.mock("@/lib/services/scheduleService", () => ({
	default: {
		getAllSchedules: (...args: any[]) => mockGetAllSchedules(...args),
		createSchedule: (...args: any[]) => mockCreateSchedule(...args),
		updateSchedule: (...args: any[]) => mockUpdateSchedule(...args),
		deleteSchedule: (...args: any[]) => mockDeleteSchedule(...args),
		getSchedule: (...args: any[]) => mockGetSchedule(...args),
		getRecentExecutions: vi.fn().mockResolvedValue([]),
	},
}));

vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => ({
		agents: [
			{
				id: "agent-1",
				name: "Scheduler",
				description: "",
				model: "x",
				tools: [],
			},
		],
		useEffectGetAgents: () => {},
	}),
}));

// Render dialogs inline: the assertions are about how many toasts a handler
// fires, not about Radix portal/focus behaviour.
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children }: any) => <div>{children}</div>,
	DialogContent: ({ children }: any) => <div>{children}</div>,
	DialogHeader: ({ children }: any) => <div>{children}</div>,
	DialogTitle: ({ children }: any) => <div>{children}</div>,
	DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

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

vi.mock("@/components/calendar/ScheduleCalendar", () => ({
	ScheduleCalendar: () => <div data-testid="calendar" />,
}));

// The page only wires onEdit/onDelete through the table view.
vi.mock("@/components/tables/ScheduleTable", () => ({
	ScheduleTable: ({ onEdit, onDelete }: any) => (
		<div>
			<button data-testid="edit-sched-1" onClick={() => onEdit("sched-1")}>
				edit
			</button>
			<button data-testid="delete-sched-1" onClick={() => onDelete("sched-1")}>
				delete
			</button>
		</div>
	),
}));

vi.mock("@/components/toggles/ViewToggle", () => ({
	ViewToggle: ({ onViewChange }: any) => (
		<button data-testid="show-table" onClick={() => onViewChange("table")}>
			table
		</button>
	),
}));

const scheduleFixture: Schedule = {
	id: "sched-1",
	title: "Daily digest",
	trigger: { type: "cron", expression: "0 9 * * *" },
	task: {
		input: { messages: [{ role: "user", content: "go" }] },
		model: "gpt-4o",
		metadata: { agent_id: "agent-1" },
	},
	next_run_time: new Date(Date.now() + 3_600_000).toISOString(),
};

const renderPage = async () => {
	const view = render(
		<MemoryRouter>
			<SchedulesIndexPage />
		</MemoryRouter>,
	);
	// Pick the agent so the create dialog swaps its picker for the form.
	await waitFor(() =>
		expect(screen.getByText("Scheduler")).toBeInTheDocument(),
	);
	fireEvent.click(screen.getByText("Scheduler"));
	await waitFor(() =>
		expect(screen.getByTestId("submit-create")).toBeInTheDocument(),
	);
	return view;
};

const showTable = () => fireEvent.click(screen.getByTestId("show-table"));

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
	mockGetAllSchedules.mockResolvedValue({ schedules: [scheduleFixture] });
	mockCreateSchedule.mockResolvedValue({});
	mockUpdateSchedule.mockResolvedValue({});
	mockDeleteSchedule.mockResolvedValue(undefined);
	mockGetSchedule.mockResolvedValue({ schedule: scheduleFixture });
	vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("SchedulesIndexPage — one toast per operation", () => {
	it("fires exactly one success toast when a create succeeds", async () => {
		await renderPage();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(mockCreateSchedule).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule created successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when a create fails", async () => {
		mockCreateSchedule.mockRejectedValue(new Error("boom"));
		await renderPage();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to create schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("fires exactly one success toast when an update succeeds", async () => {
		await renderPage();
		showTable();

		fireEvent.click(screen.getByTestId("edit-sched-1"));
		await waitFor(() =>
			expect(screen.getByTestId("submit-edit")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("submit-edit"));

		await waitFor(() => expect(mockUpdateSchedule).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule updated successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when an update fails", async () => {
		mockUpdateSchedule.mockRejectedValue(new Error("boom"));
		await renderPage();
		showTable();

		fireEvent.click(screen.getByTestId("edit-sched-1"));
		await waitFor(() =>
			expect(screen.getByTestId("submit-edit")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("submit-edit"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to update schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	// Regression guard, not a falsifier: this handler already delegated its
	// toasts to the hook before the fix.
	it("fires exactly one success toast when a delete succeeds", async () => {
		await renderPage();
		showTable();

		fireEvent.click(screen.getByTestId("delete-sched-1"));

		await waitFor(() => expect(mockDeleteSchedule).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.success).toHaveBeenCalledWith("Schedule deleted successfully");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("fires exactly one error toast when a delete fails, without an unhandled rejection", async () => {
		mockDeleteSchedule.mockRejectedValue(new Error("boom"));
		await renderPage();
		showTable();

		fireEvent.click(screen.getByTestId("delete-sched-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to delete schedule");
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("fires exactly one notification when loading a schedule for editing fails", async () => {
		mockGetSchedule.mockRejectedValue(new Error("boom"));
		await renderPage();
		showTable();

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
		mockGetAllSchedules
			.mockResolvedValueOnce({ schedules: [scheduleFixture] })
			.mockRejectedValue(new Error("boom"));
		await renderPage();

		fireEvent.click(screen.getByTestId("submit-create"));

		await waitFor(() => expect(mockGetAllSchedules).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
		expect(toast.error).not.toHaveBeenCalled();
	});
});

describe("SchedulesIndexPage — toast ids", () => {
	it("gives the mount-driven load failure a stable id", async () => {
		mockGetAllSchedules.mockRejectedValue(new Error("boom"));
		render(
			<MemoryRouter>
				<SchedulesIndexPage />
			</MemoryRouter>,
		);

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Failed to load schedules", {
			id: SCHEDULES_LOAD_TOAST_ID,
		});
	});

	it("gives write toasts no id, so repeated writes each notify", async () => {
		await renderPage();

		fireEvent.click(screen.getByTestId("submit-create"));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

		// A successful create clears the agent selection, so re-pick before the
		// second identical create.
		await waitFor(() =>
			expect(screen.getByText("Scheduler")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByText("Scheduler"));
		await waitFor(() =>
			expect(screen.getByTestId("submit-create")).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("submit-create"));
		await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));

		for (const call of vi.mocked(toast.success).mock.calls) {
			expect(call).toHaveLength(1);
		}
	});
});
