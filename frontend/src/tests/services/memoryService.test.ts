import { describe, it, expect, vi, beforeEach } from "vitest";
import MemoryService from "@/lib/services/memoryService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		patch: vi.fn(),
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
			const mockMemory = { id: "AGENTS.md", content: "test", enabled: true };
			(apiClient.get as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.get("AGENTS.md");

			expect(apiClient.get).toHaveBeenCalledWith("/memories/AGENTS.md");
			expect(result).toEqual(mockMemory);
		});
	});

	describe("create", () => {
		it("should call POST /memories with payload including path", async () => {
			const payload = { content: "new memory", path: "AGENTS.md" };
			const mockMemory = {
				id: "AGENTS.md",
				content: "new memory",
				enabled: true,
			};
			(apiClient.post as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.create(payload);

			expect(apiClient.post).toHaveBeenCalledWith("/memories", payload);
			expect(result).toEqual(mockMemory);
		});

		it("should include metadata when provided", async () => {
			const payload = {
				content: "new memory",
				path: "USER.md",
				metadata: { tag: "important" },
			};
			const mockMemory = { id: "USER.md", ...payload, enabled: true };
			(apiClient.post as any).mockResolvedValue({ data: mockMemory });

			await MemoryService.create(payload);

			expect(apiClient.post).toHaveBeenCalledWith("/memories", payload);
		});
	});

	describe("update", () => {
		it("should call PUT /memories/:id with payload", async () => {
			const payload = { content: "updated memory" };
			const mockMemory = {
				id: "AGENTS.md",
				content: "updated memory",
				enabled: true,
			};
			(apiClient.put as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.update("AGENTS.md", payload);

			expect(apiClient.put).toHaveBeenCalledWith(
				"/memories/AGENTS.md",
				payload,
			);
			expect(result).toEqual(mockMemory);
		});

		it("should pass enabled in payload", async () => {
			const payload = { content: "test", enabled: false };
			const mockMemory = {
				id: "AGENTS.md",
				content: "test",
				enabled: false,
			};
			(apiClient.put as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.update("AGENTS.md", payload);

			expect(apiClient.put).toHaveBeenCalledWith(
				"/memories/AGENTS.md",
				payload,
			);
			expect(result.enabled).toBe(false);
		});
	});

	describe("delete", () => {
		it("should call DELETE /memories/:id", async () => {
			(apiClient.delete as any).mockResolvedValue({});

			await MemoryService.delete("AGENTS.md");

			expect(apiClient.delete).toHaveBeenCalledWith("/memories/AGENTS.md");
		});
	});

	describe("getFiles", () => {
		it("should call GET /memories/files", async () => {
			const mockFiles = {
				"/AGENTS.md": {
					content: ["line1"],
					created_at: "2026-01-01T00:00:00Z",
					modified_at: "2026-01-01T00:00:00Z",
				},
			};
			(apiClient.get as any).mockResolvedValue({ data: mockFiles });

			const result = await MemoryService.getFiles();

			expect(apiClient.get).toHaveBeenCalledWith("/memories/files");
			expect(result).toEqual(mockFiles);
		});

		it("should return empty object when no files", async () => {
			(apiClient.get as any).mockResolvedValue({ data: {} });

			const result = await MemoryService.getFiles();

			expect(result).toEqual({});
		});
	});

	describe("toggle", () => {
		it("should call PATCH /memories/:id/toggle", async () => {
			const mockMemory = {
				id: "AGENTS.md",
				content: "test",
				enabled: false,
			};
			(apiClient.patch as any).mockResolvedValue({ data: mockMemory });

			const result = await MemoryService.toggle("AGENTS.md");

			expect(apiClient.patch).toHaveBeenCalledWith(
				"/memories/AGENTS.md/toggle",
			);
			expect(result).toEqual(mockMemory);
		});
	});
});
