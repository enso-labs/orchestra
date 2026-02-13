import { describe, it, expect, vi, beforeEach } from "vitest";
import * as userSettingsService from "@/lib/services/userSettingsService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	},
}));

describe("userSettingsService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("persists daytona sandbox backend preference", async () => {
		(apiClient.put as any).mockResolvedValue({
			data: { sandbox_backend: "daytona" },
		});

		await userSettingsService.updateSandboxBackend("daytona");

		expect(apiClient.put).toHaveBeenCalledWith("/settings/sandbox-backend", {
			sandbox_backend: "daytona",
		});
	});

	it("clears sandbox backend preference", async () => {
		(apiClient.put as any).mockResolvedValue({
			data: { sandbox_backend: null },
		});

		await userSettingsService.updateSandboxBackend(null);

		expect(apiClient.put).toHaveBeenCalledWith("/settings/sandbox-backend", {
			sandbox_backend: null,
		});
	});
});
