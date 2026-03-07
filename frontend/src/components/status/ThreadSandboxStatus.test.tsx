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
			provider_keys: [{ provider: "DAYTONA_API_KEY", is_set: true }],
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
			provider_keys: [{ provider: "DAYTONA_API_KEY", is_set: true }],
		});

		render(<ThreadSandboxStatus />);

		await screen.findByRole("button", { name: "Sandbox: Daytona" });

		fireEvent.click(screen.getByRole("button", { name: "Sandbox: Daytona" }));
		fireEvent.click(
			screen.getByRole("button", {
				name: "Select State (Default) sandbox",
			}),
		);

		await waitFor(() => {
			expect(mockPatchDefaults).toHaveBeenCalledWith({ sandbox: "state" });
			expect(
				screen.getByRole("button", {
					name: "Sandbox: State (Default)",
				}),
			).toBeInTheDocument();
		});
		expect(mockToastSuccess).toHaveBeenCalledWith("Sandbox updated");
	});

	it("hides Daytona option when DAYTONA_API_KEY is not set", async () => {
		mockGetSettings.mockResolvedValue({
			defaults: { sandbox: "state" },
			provider_keys: [{ provider: "DAYTONA_API_KEY", is_set: false }],
		});

		render(<ThreadSandboxStatus />);

		await screen.findByRole("button", { name: "Sandbox: State (Default)" });

		fireEvent.click(
			screen.getByRole("button", { name: "Sandbox: State (Default)" }),
		);

		await waitFor(() => {
			expect(
				screen.getByRole("button", {
					name: "Select State (Default) sandbox",
				}),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Select Daytona sandbox" }),
			).not.toBeInTheDocument();
		});
	});
});
