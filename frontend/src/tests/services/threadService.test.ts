import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findThread } from "@/lib/services/threadService";
import apiClient from "@/lib/utils/apiClient";
import { mockThread } from "@/tests/mocks/thread";

// Mock the apiClient
vi.mock("../../lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
	},
}));

describe("threadService", () => {
	beforeEach(() => {
		// Clear mock calls before each test
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Reset mocks after each test
		vi.resetAllMocks();
	});

	describe.skip("findThread", () => {
		it("should fetch thread successfully", async () => {
			// Setup mock response
			(apiClient.get as any).mockResolvedValue({ data: mockThread });

			// Call the function
			const result = await findThread("thread-123");

			// Assertions
			expect(apiClient.get).toHaveBeenCalledWith("/thread/thread-123");
			expect(apiClient.get).toHaveBeenCalledTimes(1);
			expect(result).toEqual(mockThread);
		});

		it("should propagate errors from the API", async () => {
			// Setup mock error
			const mockError = new Error("Thread not found");
			(apiClient.get as any).mockRejectedValue(mockError);

			// Call and verify error is thrown
			await expect(findThread("invalid-id")).rejects.toThrow(
				"Thread not found",
			);
			expect(apiClient.get).toHaveBeenCalledWith("/thread/invalid-id");
			expect(apiClient.get).toHaveBeenCalledTimes(1);
		});
	});
});
