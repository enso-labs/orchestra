import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SandboxBackendSettings } from "@/components/settings/SandboxBackendSettings";

const mockGetSettings = vi.fn();
const mockUpdateSandboxBackend = vi.fn();

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: (...args: any[]) => mockGetSettings(...args),
	updateSandboxBackend: (...args: any[]) => mockUpdateSandboxBackend(...args),
}));

describe("SandboxBackendSettings", () => {
	beforeEach(() => {
		(globalThis as any).ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		};
		(Element.prototype as any).scrollIntoView = vi.fn();
		vi.clearAllMocks();
		mockGetSettings.mockResolvedValue({ sandbox_backend: null });
	});

	it("renders sandbox backend preference control", async () => {
		render(<SandboxBackendSettings />);
		expect(screen.getByText("Sandbox Backend")).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByRole("combobox")).toHaveTextContent("System default");
		});
	});

	it("selecting Daytona persists sandbox_backend=daytona", async () => {
		mockUpdateSandboxBackend.mockResolvedValue({ sandbox_backend: "daytona" });
		render(<SandboxBackendSettings />);

		fireEvent.click(screen.getByRole("combobox"));
		fireEvent.click(await screen.findByText("Daytona"));

		await waitFor(() => {
			expect(mockUpdateSandboxBackend).toHaveBeenCalledWith("daytona");
		});
	});

	it("clearing preference persists sandbox_backend=null", async () => {
		mockGetSettings.mockResolvedValue({ sandbox_backend: "daytona" });
		mockUpdateSandboxBackend.mockResolvedValue({ sandbox_backend: null });
		render(<SandboxBackendSettings />);

		const clearButton = await screen.findByTitle(
			"Clear sandbox backend preference",
		);
		fireEvent.click(clearButton);

		await waitFor(() => {
			expect(mockUpdateSandboxBackend).toHaveBeenCalledWith(null);
		});
	});
});
