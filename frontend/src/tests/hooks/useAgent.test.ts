import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgent } from "@/hooks/useAgent";
import agentService from "@/lib/services/agentService";

// Mock agentService
vi.mock("@/lib/services/agentService", () => ({
	default: {
		search: vi.fn(),
		listPublic: vi.fn(),
	},
}));

// Mock useModel hook
vi.mock("@/hooks/useModel", () => ({
	default: () => ({
		model: "gpt-4",
		useModelsEffect: vi.fn(),
		updateQueryStateModel: vi.fn(),
	}),
}));

describe("useAgent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock localStorage
		Object.defineProperty(window, "localStorage", {
			value: {
				getItem: vi.fn(() => null),
				setItem: vi.fn(),
			},
			writable: true,
		});
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("handleGetPublicAgents", () => {
		it("should fetch public agents and update state", async () => {
			const mockPublicAgents = [
				{
					id: "1",
					name: "Public Agent 1",
					description: "Test description",
					model: "gpt-4",
					public: true,
				},
				{
					id: "2",
					name: "Public Agent 2",
					description: "Another description",
					model: "claude-3",
					public: true,
				},
			];

			(agentService.listPublic as any).mockResolvedValue({
				data: { assistants: mockPublicAgents },
			});

			const { result } = renderHook(() => useAgent());

			// Initial state should be empty
			expect(result.current.publicAgents).toEqual([]);
			expect(result.current.isLoadingPublicAgents).toBe(false);

			// Call handleGetPublicAgents
			await act(async () => {
				await result.current.handleGetPublicAgents();
			});

			// Should have updated publicAgents state
			expect(result.current.publicAgents).toEqual(mockPublicAgents);
			expect(result.current.isLoadingPublicAgents).toBe(false);
			expect(agentService.listPublic).toHaveBeenCalledWith(50, 0);
		});

		it("should handle errors gracefully", async () => {
			const mockError = new Error("Network error");
			(agentService.listPublic as any).mockRejectedValue(mockError);

			const { result } = renderHook(() => useAgent());

			// Call handleGetPublicAgents
			await act(async () => {
				await result.current.handleGetPublicAgents();
			});

			// Should have empty publicAgents and not loading
			expect(result.current.publicAgents).toEqual([]);
			expect(result.current.isLoadingPublicAgents).toBe(false);
		});

		it("should accept custom limit and offset", async () => {
			(agentService.listPublic as any).mockResolvedValue({
				data: { assistants: [] },
			});

			const { result } = renderHook(() => useAgent());

			await act(async () => {
				await result.current.handleGetPublicAgents(25, 10);
			});

			expect(agentService.listPublic).toHaveBeenCalledWith(25, 10);
		});
	});

	describe("handleGetAgents", () => {
		it("should fetch user agents and update state", async () => {
			const mockAgents = [
				{
					id: "1",
					name: "My Agent 1",
					description: "Test description",
					model: "gpt-4",
					public: false,
				},
			];

			(agentService.search as any).mockResolvedValue({
				data: { assistants: mockAgents },
			});

			const { result } = renderHook(() => useAgent());

			await act(async () => {
				await result.current.handleGetAgents();
			});

			expect(result.current.agents).toEqual(mockAgents);
			expect(agentService.search).toHaveBeenCalled();
		});
	});

	describe("initial state", () => {
		it("should have correct initial state for publicAgents", () => {
			(agentService.search as any).mockResolvedValue({
				data: { assistants: [] },
			});
			(agentService.listPublic as any).mockResolvedValue({
				data: { assistants: [] },
			});

			const { result } = renderHook(() => useAgent());

			expect(result.current.publicAgents).toEqual([]);
			expect(result.current.isLoadingPublicAgents).toBe(false);
		});
	});
});
