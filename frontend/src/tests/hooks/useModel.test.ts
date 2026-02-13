import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useModel } from "@/hooks/useModel";

// Mock dependencies
vi.mock("@/lib/services/modelService", () => ({
	listModels: vi.fn().mockResolvedValue({
		data: {
			default: "openai:gpt-4o",
			models: ["openai:gpt-4o", "anthropic:claude-sonnet-4-20250514"],
			free: [],
		},
	}),
}));

vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: vi.fn().mockResolvedValue({
		default_model: "anthropic:claude-sonnet-4-20250514",
	}),
}));

vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: vi.fn().mockReturnValue("fake-token"),
}));

describe("useModel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initializes with null model before defaults resolve", () => {
		const { result } = renderHook(() => useModel());
		// Before effects run, model starts as null
		expect(result.current.model).toBeNull();
	});

	it("resolves model from user settings default", async () => {
		const { result } = renderHook(() => useModel());

		await waitFor(() => {
			expect(result.current.model).toBe("anthropic:claude-sonnet-4-20250514");
		});
	});

	it("falls back to system default when user settings unavailable", async () => {
		const { getSettings } = await import(
			"@/lib/services/userSettingsService"
		);
		vi.mocked(getSettings).mockRejectedValueOnce(new Error("fail"));

		// useModelsEffect returns a function containing useEffect, so we need
		// a wrapper component that calls it during render
		const { result } = renderHook(() => {
			const hook = useModel();
			hook.useModelsEffect();
			return hook;
		});

		await waitFor(() => {
			expect(result.current.model).toBe("openai:gpt-4o");
		});
	});

	it("falls back to system default when no auth token", async () => {
		const { getAuthToken } = await import("@/lib/utils/auth");
		vi.mocked(getAuthToken).mockReturnValueOnce(null);

		const { result } = renderHook(() => {
			const hook = useModel();
			hook.useModelsEffect();
			return hook;
		});

		await waitFor(() => {
			expect(result.current.model).toBe("openai:gpt-4o");
		});
	});

	it("setModel updates model value (for thread loading)", async () => {
		const { result } = renderHook(() => useModel());

		act(() => {
			result.current.setModel("openai:gpt-4o-mini");
		});

		expect(result.current.model).toBe("openai:gpt-4o-mini");
	});

	it("resetToDefault clears model so default re-applies", async () => {
		const { result } = renderHook(() => useModel());

		// Set a specific model first
		act(() => {
			result.current.setModel("openai:gpt-4o-mini");
		});
		expect(result.current.model).toBe("openai:gpt-4o-mini");

		// Reset
		act(() => {
			result.current.resetToDefault();
		});

		// After reset, model goes to null then effect sets it to user default
		await waitFor(() => {
			expect(result.current.model).toBe("anthropic:claude-sonnet-4-20250514");
		});
	});

	it("updateQueryStateModel updates model value", () => {
		const { result } = renderHook(() => useModel());

		act(() => {
			result.current.updateQueryStateModel("openai:gpt-4o");
		});

		expect(result.current.model).toBe("openai:gpt-4o");
	});

	it("does not use URL query params", () => {
		const { result } = renderHook(() => useModel());

		// Model should not appear in URL
		expect(window.location.search).not.toContain("model=");

		act(() => {
			result.current.setModel("openai:gpt-4o");
		});

		// Still no URL param
		expect(window.location.search).not.toContain("model=");
	});

	it("exports expected interface", () => {
		const { result } = renderHook(() => useModel());

		expect(result.current).toHaveProperty("model");
		expect(result.current).toHaveProperty("setModel");
		expect(result.current).toHaveProperty("updateQueryStateModel");
		expect(result.current).toHaveProperty("resetToDefault");
		expect(result.current).toHaveProperty("models");
		expect(result.current).toHaveProperty("useModelsEffect");
		expect(typeof result.current.setModel).toBe("function");
		expect(typeof result.current.updateQueryStateModel).toBe("function");
		expect(typeof result.current.resetToDefault).toBe("function");
	});
});
