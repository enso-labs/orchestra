import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AgentService from "@/lib/services/agentService";
import apiClient from "@/lib/utils/apiClient";

// Mock the apiClient
vi.mock("../../lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	},
}));

describe("AgentService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("listPublic", () => {
		it("should fetch public agents successfully", async () => {
			const mockPublicAgents = {
				assistants: [
					{
						id: "1",
						name: "Public Agent 1",
						description: "A public agent",
						model: "gpt-4",
						public: true,
						owner_id: "user-123",
					},
					{
						id: "2",
						name: "Public Agent 2",
						description: "Another public agent",
						model: "claude-3",
						public: true,
						owner_id: "user-456",
					},
				],
				limit: 50,
				offset: 0,
			};

			(apiClient.get as any).mockResolvedValue({ data: mockPublicAgents });

			const result = await AgentService.listPublic();

			expect(apiClient.get).toHaveBeenCalledWith("/assistants/public", {
				params: { limit: 50, offset: 0 },
			});
			expect(apiClient.get).toHaveBeenCalledTimes(1);
			expect(result.data.assistants).toHaveLength(2);
			expect(result.data.assistants[0].public).toBe(true);
		});

		it("should respect limit and offset parameters", async () => {
			(apiClient.get as any).mockResolvedValue({
				data: { assistants: [], limit: 10, offset: 20 },
			});

			await AgentService.listPublic(10, 20);

			expect(apiClient.get).toHaveBeenCalledWith("/assistants/public", {
				params: { limit: 10, offset: 20 },
			});
		});

		it("should propagate errors from the API", async () => {
			const mockError = new Error("Network error");
			(apiClient.get as any).mockRejectedValue(mockError);

			await expect(AgentService.listPublic()).rejects.toThrow("Network error");
		});
	});

	describe("getPublic", () => {
		it("should fetch a single public agent by ID", async () => {
			const mockAgent = {
				id: "agent-123",
				name: "Test Public Agent",
				description: "Test description",
				model: "gpt-4",
				public: true,
			};

			(apiClient.get as any).mockResolvedValue({ data: mockAgent });

			const result = await AgentService.getPublic("agent-123");

			expect(apiClient.get).toHaveBeenCalledWith(
				"/assistants/public/agent-123",
			);
			expect(result.data.id).toBe("agent-123");
		});

		it("should handle 404 for non-existent public agent", async () => {
			const mockError = {
				response: {
					status: 404,
					data: { detail: "Public assistant not found" },
				},
			};
			(apiClient.get as any).mockRejectedValue(mockError);

			await expect(AgentService.getPublic("nonexistent")).rejects.toEqual(
				mockError,
			);
		});
	});

	describe("publish", () => {
		it("should publish an agent successfully", async () => {
			(apiClient.post as any).mockResolvedValue({
				data: { assistant_id: "agent-123", public: true },
			});

			const result = await AgentService.publish("agent-123");

			expect(apiClient.post).toHaveBeenCalledWith(
				"/assistants/agent-123/publish",
			);
			expect(result.data.public).toBe(true);
		});
	});

	describe("unpublish", () => {
		it("should unpublish an agent successfully", async () => {
			(apiClient.delete as any).mockResolvedValue({
				data: { assistant_id: "agent-123", public: false },
			});

			const result = await AgentService.unpublish("agent-123");

			expect(apiClient.delete).toHaveBeenCalledWith(
				"/assistants/agent-123/publish",
			);
			expect(result.data.public).toBe(false);
		});
	});

	describe("search", () => {
		it("should search agents with default parameters", async () => {
			const mockAgents = {
				assistants: [
					{ id: "1", name: "Agent 1", description: "Test", model: "gpt-4" },
				],
			};
			(apiClient.post as any).mockResolvedValue({ data: mockAgents });

			await AgentService.search();

			expect(apiClient.post).toHaveBeenCalledWith("/assistants/search", {
				limit: 200,
				offset: 0,
				filter: {},
			});
		});

		it("should search agents with custom filter", async () => {
			(apiClient.post as any).mockResolvedValue({
				data: { assistants: [] },
			});

			await AgentService.search({ filter: { id: "agent-123" } });

			expect(apiClient.post).toHaveBeenCalledWith("/assistants/search", {
				limit: 200,
				offset: 0,
				filter: { id: "agent-123" },
			});
		});
	});
});
