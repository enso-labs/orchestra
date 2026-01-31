import { describe, it, expect, vi, beforeEach } from "vitest";
import MemoryService from "@/lib/services/memoryService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	},
}));

describe("MemoryService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list", () => {
		it("should call GET /memories with default params", async () => {
			const mockResponse = {
				data: { memories: [], total: 0, limit: 20, offset: 0 },
			};
			(apiClient.get as any).mockResolvedValue(mockResponse);

			const result = await MemoryService.list();

			expect(apiClient.get).toHaveBeenCalledWith("/memories", {
				params: { limit: 20, offset: 0 },
			});
			expect(result).toEqual(mockResponse.data);
		});

		it("should include query param when provided", async () => {
			const mockResponse = {
				data: { memories: [], total: 0, limit: 20, offset: 0 },
			};
			(apiClient.get as any).mockResolvedValue(mockResponse);

			await MemoryService.list({ query: "test" });

			expect(apiClient.get).toHaveBeenCalledWith("/memories", {
				params: { limit: 20, offset: 0, query: "test" },
			});
		});

		it("should pass custom limit and offset", async () => {
			const mockResponse = {
				data: { memories: [], total: 0, limit: 10, offset: 5 },
			};
			(apiClient.get as any).mockResolvedValue(mockResponse);

			await MemoryService.list({ limit: 10, offset: 5 });

			expect(apiClient.get).toHaveBeenCalledWith("/memories", {
				params: { limit: 10, offset: 5 },
			});
		});
	});

	describe("get", () => {
		it("should call GET /memories/:id", async () => {
			const mockMemory = { id: "memory_1", content: "test" };
			(apiClient.get as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.get("memory_1");

			expect(apiClient.get).toHaveBeenCalledWith("/memories/memory_1");
			expect(result).toEqual(mockMemory);
		});
	});

	describe("create", () => {
		it("should call POST /memories with payload", async () => {
			const payload = { content: "new memory" };
			const mockMemory = { id: "memory_1", content: "new memory" };
			(apiClient.post as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.create(payload);

			expect(apiClient.post).toHaveBeenCalledWith("/memories", payload);
			expect(result).toEqual(mockMemory);
		});

		it("should include metadata when provided", async () => {
			const payload = {
				content: "new memory",
				metadata: { tag: "important" },
			};
			const mockMemory = { id: "memory_1", ...payload };
			(apiClient.post as any).mockResolvedValue({ data: mockMemory });

			await MemoryService.create(payload);

			expect(apiClient.post).toHaveBeenCalledWith("/memories", payload);
		});
	});

	describe("update", () => {
		it("should call PUT /memories/:id with payload", async () => {
			const payload = { content: "updated memory" };
			const mockMemory = { id: "memory_1", content: "updated memory" };
			(apiClient.put as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.update("memory_1", payload);

			expect(apiClient.put).toHaveBeenCalledWith("/memories/memory_1", payload);
			expect(result).toEqual(mockMemory);
		});
	});

	describe("delete", () => {
		it("should call DELETE /memories/:id", async () => {
			(apiClient.delete as any).mockResolvedValue({});

			await MemoryService.delete("memory_1");

			expect(apiClient.delete).toHaveBeenCalledWith("/memories/memory_1");
		});
	});
});
