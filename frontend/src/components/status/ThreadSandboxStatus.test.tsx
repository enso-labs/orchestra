import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThreadSandboxStatus from "./ThreadSandboxStatus";

const mockGetSettings = vi.fn();
const mockPatchDefaults = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: () => mockGetSettings(),
	patchDefaults: (data: unknown) => mockPatchDefaults(data),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (message: string) => mockToastSuccess(message),
		error: (message: string) => mockToastError(message),
	},
}));

describe("ThreadSandboxStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSettings.mockResolvedValue({
			defaults: {
				sandbox: "daytona",
			},
		});
	});

	it("loads and displays the current sandbox setting", async () => {
		render(<ThreadSandboxStatus />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Sandbox: Daytona" }),
			).toBeInTheDocument();
		});
	});

	it("updates the sandbox from the popover selection", async () => {
		mockPatchDefaults.mockResolvedValue({
			defaults: {
				sandbox: "state",
			},
		});

		render(<ThreadSandboxStatus />);

		await screen.findByRole("button", { name: "Sandbox: Daytona" });

		fireEvent.click(screen.getByRole("button", { name: "Sandbox: Daytona" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Select Local sandbox" }),
		);

		await waitFor(() => {
			expect(mockPatchDefaults).toHaveBeenCalledWith({ sandbox: "state" });
			expect(
				screen.getByRole("button", { name: "Sandbox: Local" }),
			).toBeInTheDocument();
		});
		expect(mockToastSuccess).toHaveBeenCalledWith("Sandbox updated");
	});
});
