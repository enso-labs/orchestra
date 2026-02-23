import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useModelVisibility } from "./useModelVisibility";

const mockGetSettings = vi.fn();
const mockPatchDefaults = vi.fn();

vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: (...args: unknown[]) => mockGetSettings(...args),
	patchDefaults: (...args: unknown[]) => mockPatchDefaults(...args),
}));

const makeSettingsResponse = (model_visibility: string[] | null) => ({
	defaults: {
		model: null,
		sandbox: null,
		tools: null,
		mcp: null,
		a2a: null,
		subagents: null,
		model_visibility,
	},
	provider_keys: [],
});

describe("useModelVisibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		mockGetSettings.mockResolvedValue(makeSettingsResponse(null));
		mockPatchDefaults.mockResolvedValue(makeSettingsResponse(null));
	});

	it("should default-enable the approved model list when backend returns null", async () => {
		const { result } = renderHook(() => useModelVisibility());
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true);
		expect(result.current.isModelVisible("openai:gpt-4o")).toBe(true);
	});

	it("should use backend model_visibility when present", async () => {
		mockGetSettings.mockResolvedValue(
			makeSettingsResponse(["google_genai:gemini-3-pro-preview"]),
		);
		const { result } = renderHook(() => useModelVisibility());
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(
			result.current.isModelVisible("google_genai:gemini-3-pro-preview"),
		).toBe(true);
		expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(false);
	});

	it("should toggle visibility and call patchDefaults", async () => {
		mockPatchDefaults.mockResolvedValue(
			makeSettingsResponse(["openai:some-experimental-model"]),
		);
		const { result } = renderHook(() => useModelVisibility());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		act(() => {
			result.current.toggleModelVisibility("openai:some-experimental-model");
		});

		expect(
			result.current.isModelVisible("openai:some-experimental-model"),
		).toBe(true);
		expect(mockPatchDefaults).toHaveBeenCalledWith({
			model_visibility: expect.arrayContaining([
				"openai:some-experimental-model",
			]),
		});

		act(() => {
			result.current.toggleModelVisibility("openai:some-experimental-model");
		});

		expect(
			result.current.isModelVisible("openai:some-experimental-model"),
		).toBe(false);
		expect(mockPatchDefaults).toHaveBeenCalledTimes(2);
	});

	it("should set error when getSettings fails", async () => {
		mockGetSettings.mockRejectedValue(new Error("Network error"));
		const { result } = renderHook(() => useModelVisibility());
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.error).toBe(
			"Failed to load model visibility settings",
		);
	});

	it("should revert toggle when patchDefaults fails", async () => {
		mockGetSettings.mockResolvedValue(makeSettingsResponse(["openai:gpt-5.2"]));
		mockPatchDefaults.mockRejectedValue(new Error("Network error"));

		const { result } = renderHook(() => useModelVisibility());
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true);

		// Toggle off — optimistic update
		act(() => {
			result.current.toggleModelVisibility("openai:gpt-5.2");
		});
		expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(false);

		// After rejection, should revert
		await waitFor(() =>
			expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true),
		);
	});

	it("should expose isLoading state", async () => {
		let resolveSettings: (value: unknown) => void;
		mockGetSettings.mockReturnValue(
			new Promise((resolve) => {
				resolveSettings = resolve;
			}),
		);

		const { result } = renderHook(() => useModelVisibility());
		expect(result.current.isLoading).toBe(true);

		await act(async () => {
			resolveSettings!(makeSettingsResponse(null));
		});

		expect(result.current.isLoading).toBe(false);
	});

	describe("localStorage migration", () => {
		it("should migrate localStorage data to backend when backend returns null", async () => {
			const localModels = ["openai:gpt-5", "anthropic:claude-sonnet-4-5"];
			localStorage.setItem(
				"orchestra_model_visibility",
				JSON.stringify(localModels),
			);
			mockPatchDefaults.mockResolvedValue(makeSettingsResponse(localModels));

			const { result } = renderHook(() => useModelVisibility());
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			expect(result.current.isModelVisible("openai:gpt-5")).toBe(true);
			expect(result.current.isModelVisible("anthropic:claude-sonnet-4-5")).toBe(
				true,
			);
			expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(false);
			expect(mockPatchDefaults).toHaveBeenCalledWith({
				model_visibility: localModels,
			});
		});

		it("should clear localStorage after successful migration", async () => {
			const localModels = ["openai:gpt-5"];
			localStorage.setItem(
				"orchestra_model_visibility",
				JSON.stringify(localModels),
			);
			mockPatchDefaults.mockResolvedValue(makeSettingsResponse(localModels));

			const { result } = renderHook(() => useModelVisibility());
			await waitFor(() => expect(result.current.isLoading).toBe(false));
			await waitFor(() =>
				expect(localStorage.getItem("orchestra_model_visibility")).toBeNull(),
			);
		});

		it("should prefer backend data over localStorage when both exist", async () => {
			const backendModels = ["openai:gpt-5.2"];
			const localModels = ["openai:gpt-5", "anthropic:claude-sonnet-4-5"];
			localStorage.setItem(
				"orchestra_model_visibility",
				JSON.stringify(localModels),
			);
			mockGetSettings.mockResolvedValue(makeSettingsResponse(backendModels));

			const { result } = renderHook(() => useModelVisibility());
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true);
			expect(result.current.isModelVisible("openai:gpt-5")).toBe(false);
			// Should NOT call patchDefaults for migration
			expect(mockPatchDefaults).not.toHaveBeenCalled();
		});

		it("should not migrate if localStorage has no data", async () => {
			const { result } = renderHook(() => useModelVisibility());
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Should use defaults, no migration PATCH
			expect(result.current.isModelVisible("openai:gpt-5.2")).toBe(true);
			expect(mockPatchDefaults).not.toHaveBeenCalled();
		});

		it("should keep localStorage if migration PATCH fails", async () => {
			const localModels = ["openai:gpt-5"];
			localStorage.setItem(
				"orchestra_model_visibility",
				JSON.stringify(localModels),
			);
			mockPatchDefaults.mockRejectedValue(new Error("Network error"));

			const { result } = renderHook(() => useModelVisibility());
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			// Should still use localStorage values in state
			expect(result.current.isModelVisible("openai:gpt-5")).toBe(true);
			// localStorage should NOT be cleared since PATCH failed
			await waitFor(() =>
				expect(
					localStorage.getItem("orchestra_model_visibility"),
				).not.toBeNull(),
			);
		});
	});
});
