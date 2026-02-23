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
});
