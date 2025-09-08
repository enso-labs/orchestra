import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listTools } from "@/lib/services/toolService";
import apiClient from "@/lib/utils/apiClient";
import { mockTools } from "@/tests/mocks/tools";

// Mock the apiClient
vi.mock("../../lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
	},
}));

describe("toolService", () => {
	beforeEach(() => {
		// Clear mock calls before each test
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Reset mocks after each test
		vi.resetAllMocks();
	});

	describe("listTools", () => {
		it("should fetch tools successfully", async () => {
			// Setup mock response
			(apiClient.get as any).mockResolvedValue({ data: mockTools });

			// Call the function
			const result = await listTools();
			//   console.log(result);

			// Assertions
			expect(apiClient.get).toHaveBeenCalledWith("/tools");
			expect(apiClient.get).toHaveBeenCalledTimes(1);
			expect(result).toEqual(mockTools);
		});

		it("should propagate errors from the API", async () => {
			// Setup mock error
			const mockError = new Error("API Error");
			(apiClient.get as any).mockRejectedValue(mockError);

			// Call and verify error is thrown
			await expect(listTools()).rejects.toThrow("API Error");
			expect(apiClient.get).toHaveBeenCalledWith("/tools");
			expect(apiClient.get).toHaveBeenCalledTimes(1);
		});
	});
});
