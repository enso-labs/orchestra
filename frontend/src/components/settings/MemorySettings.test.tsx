import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemorySettings } from "./MemorySettings";

// Mock sonner
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock MemoryService
const mockList = vi.fn();
const mockDelete = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/services/memoryService", () => ({
	default: {
		list: (...args: any[]) => mockList(...args),
		delete: (...args: any[]) => mockDelete(...args),
		create: (...args: any[]) => mockCreate(...args),
		update: (...args: any[]) => mockUpdate(...args),
	},
}));

// Mock MemoryEditDialog
vi.mock("./MemoryEditDialog", () => ({
	MemoryEditDialog: ({
		open,
		onOpenChange,
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}) =>
		open ? (
			<div data-testid="edit-dialog">
				<button onClick={() => onOpenChange(false)}>Close Dialog</button>
			</div>
		) : null,
}));

const sampleMemories = [
	{
		id: "memory_1",
		content: "User prefers dark mode",
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	},
	{
		id: "memory_2",
		content: "User works with Python",
		created_at: "2026-01-02T00:00:00Z",
		updated_at: "2026-01-02T00:00:00Z",
	},
];

describe("MemorySettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockList.mockResolvedValue({
			memories: sampleMemories,
			total: 2,
			limit: 100,
			offset: 0,
		});
		mockDelete.mockResolvedValue(undefined);
	});

	it("renders loading skeletons then memories", async () => {
		render(<MemorySettings />);
		// Should show skeletons initially
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});
		expect(screen.getByText("User works with Python")).toBeInTheDocument();
		expect(screen.getByText("2 memories")).toBeInTheDocument();
	});

	it("shows empty state when no memories", async () => {
		mockList.mockResolvedValue({
			memories: [],
			total: 0,
			limit: 100,
			offset: 0,
		});
		render(<MemorySettings />);
		await waitFor(() => {
			expect(
				screen.getByText("No memories yet. Add one to get started."),
			).toBeInTheDocument();
		});
	});

	it("shows search empty state", async () => {
		mockList
			.mockResolvedValueOnce({
				memories: sampleMemories,
				total: 2,
				limit: 100,
				offset: 0,
			})
			.mockResolvedValueOnce({
				memories: [],
				total: 0,
				limit: 100,
				offset: 0,
			});

		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		const input = screen.getByPlaceholderText("Search memories...");
		fireEvent.change(input, { target: { value: "nonexistent" } });

		await waitFor(() => {
			expect(
				screen.getByText("No memories match your search."),
			).toBeInTheDocument();
		});
	});

	it("opens create dialog when Add Memory clicked", async () => {
		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		fireEvent.click(screen.getByText("Add Memory"));
		expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
	});

	it("opens edit dialog on pencil click", async () => {
		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		const editButtons = screen.getAllByLabelText("Edit memory");
		fireEvent.click(editButtons[0]);
		expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
	});

	it("shows delete confirmation dialog", async () => {
		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		const deleteButtons = screen.getAllByLabelText("Delete memory");
		fireEvent.click(deleteButtons[0]);

		expect(screen.getByText("Delete Memory")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Are you sure you want to delete this memory? This action cannot be undone.",
			),
		).toBeInTheDocument();
	});

	it("performs optimistic delete and calls service", async () => {
		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		// Click delete on first memory
		const deleteButtons = screen.getAllByRole("button").filter((btn) =>
			btn.className.includes("destructive"),
		);
		fireEvent.click(deleteButtons[0]);

		// Confirm delete
		fireEvent.click(screen.getByText("Delete"));

		await waitFor(() => {
			expect(mockDelete).toHaveBeenCalledWith("memory_1");
		});

		// Memory should be removed optimistically
		expect(
			screen.queryByText("User prefers dark mode"),
		).not.toBeInTheDocument();
	});

	it("rolls back on delete failure", async () => {
		mockDelete.mockRejectedValueOnce(new Error("fail"));
		render(<MemorySettings />);
		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});

		const deleteButtons = screen.getAllByRole("button").filter((btn) =>
			btn.className.includes("destructive"),
		);
		fireEvent.click(deleteButtons[0]);
		fireEvent.click(screen.getByText("Delete"));

		await waitFor(() => {
			expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
		});
	});

	it("handles fetch error", async () => {
		const { toast } = await import("sonner");
		mockList.mockRejectedValueOnce(new Error("network error"));
		render(<MemorySettings />);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("Failed to load memories");
		});
	});
});
