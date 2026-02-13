import { describe, it, expect, vi, beforeEach } from "vitest";
import * as toolService from "@/lib/services/toolService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn(),
	},
}));

describe("toolService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createTool", () => {
		it("should call apiClient.post with /tools and payload", async () => {
			const payload = { name: "test_tool", type: "api" };
			(apiClient.post as any).mockResolvedValue({ data: { success: true } });

			await toolService.createTool(payload);

			expect(apiClient.post).toHaveBeenCalledWith("/tools", payload);
		});
	});

	describe("deleteTool", () => {
		it("should call apiClient.delete with /tools/{name}", async () => {
			const name = "test_tool";
			(apiClient.delete as any).mockResolvedValue({ data: { success: true } });

			await toolService.deleteTool(name);

			expect(apiClient.delete).toHaveBeenCalledWith(`/tools/${name}`);
		});
	});

	describe("listTools", () => {
		it("should exclude daytona_sandbox from platform tool listings", async () => {
			const mockTools = [
				{ name: "search_engine", tags: ["platform"] },
				{ name: "daytona_sandbox", tags: ["platform"] },
			];
			(apiClient.get as any).mockResolvedValue({
				data: { tools: mockTools },
			});

			const result = await toolService.listTools();

			expect(apiClient.get).toHaveBeenCalledWith("/tools");
			expect(result.tools).toEqual([
				{ name: "search_engine", tags: ["platform"] },
			]);
		});
	});

	describe("getUserTools", () => {
		it("should filter tools with 'custom' tag", async () => {
			const mockTools = [
				{ name: "platform_tool", tags: ["platform"] },
				{ name: "custom_tool", tags: ["api_tool"] },
				{ name: "mixed_tool", tags: ["api_tool", "other"] },
			];
			(apiClient.get as any).mockResolvedValue({
				data: { tools: mockTools },
			});

			const result = await toolService.getUserTools();

			expect(apiClient.get).toHaveBeenCalledWith("/tools");
			expect(result).toHaveLength(2);
			expect(result.map((t: any) => t.name)).toEqual([
				"custom_tool",
				"mixed_tool",
			]);
		});

		it("should return empty array if no tools returned", async () => {
			(apiClient.get as any).mockResolvedValue({
				data: { tools: [] },
			});

			const result = await toolService.getUserTools();
			expect(result).toEqual([]);
		});
	});
});
