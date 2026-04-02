import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useModel } from "@/hooks/useModel";
import { createQueryWrapper } from "@/tests/test-utils";

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

vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: vi.fn().mockReturnValue("mock-token"),
}));

describe("useModel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initializes with null model (server resolves default)", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});
		expect(result.current.model).toBeNull();
	});

	it("model stays null for new conversations (no auto-resolution)", async () => {
		const { result } = renderHook(
			() => {
				const hook = useModel();
				hook.useModelsEffect();
				return hook;
			},
			{ wrapper: createQueryWrapper() },
		);

		// Wait for models to load
		await waitFor(() => {
			expect(result.current.models.default).toBe("openai:gpt-4o");
		});

		// model should still be null — no client-side auto-resolution
		expect(result.current.model).toBeNull();
	});

	it("displayModel returns models.default when model is null", async () => {
		const { result } = renderHook(
			() => {
				const hook = useModel();
				hook.useModelsEffect();
				return hook;
			},
			{ wrapper: createQueryWrapper() },
		);

		await waitFor(() => {
			expect(result.current.displayModel).toBe("openai:gpt-4o");
		});

		// model is null, displayModel falls back to models.default
		expect(result.current.model).toBeNull();
		expect(result.current.displayModel).toBe("openai:gpt-4o");
	});

	it("displayModel returns explicit model when set", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		act(() => {
			result.current.setModel("anthropic:claude-sonnet-4-20250514");
		});

		expect(result.current.model).toBe("anthropic:claude-sonnet-4-20250514");
		expect(result.current.displayModel).toBe(
			"anthropic:claude-sonnet-4-20250514",
		);
	});

	it("setModel updates model value (for thread loading)", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		act(() => {
			result.current.setModel("openai:gpt-4o-mini");
		});

		expect(result.current.model).toBe("openai:gpt-4o-mini");
	});

	it("resetToDefault clears model to null", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		// Set a specific model first
		act(() => {
			result.current.setModel("openai:gpt-4o-mini");
		});
		expect(result.current.model).toBe("openai:gpt-4o-mini");

		// Reset
		act(() => {
			result.current.resetToDefault();
		});

		expect(result.current.model).toBeNull();
	});

	it("updateQueryStateModel updates model value", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		act(() => {
			result.current.updateQueryStateModel("openai:gpt-4o");
		});

		expect(result.current.model).toBe("openai:gpt-4o");
	});

	it("does not use URL query params", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		// Model should not appear in URL
		expect(window.location.search).not.toContain("model=");

		act(() => {
			result.current.setModel("openai:gpt-4o");
		});

		// Still no URL param
		expect(window.location.search).not.toContain("model=");
	});

	it("exports expected interface", () => {
		const { result } = renderHook(() => useModel(), {
			wrapper: createQueryWrapper(),
		});

		expect(result.current).toHaveProperty("model");
		expect(result.current).toHaveProperty("setModel");
		expect(result.current).toHaveProperty("updateQueryStateModel");
		expect(result.current).toHaveProperty("resetToDefault");
		expect(result.current).toHaveProperty("displayModel");
		expect(result.current).toHaveProperty("models");
		expect(result.current).toHaveProperty("useModelsEffect");
		expect(typeof result.current.setModel).toBe("function");
		expect(typeof result.current.updateQueryStateModel).toBe("function");
		expect(typeof result.current.resetToDefault).toBe("function");
	});
});
