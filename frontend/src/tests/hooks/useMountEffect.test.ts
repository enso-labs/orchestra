import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMountEffect } from "@/hooks/useMountEffect";

describe("useMountEffect", () => {
	it("should call the effect function once on mount", () => {
		const effectFn = vi.fn();
		renderHook(() => useMountEffect(effectFn));
		expect(effectFn).toHaveBeenCalledTimes(1);
	});

	it("should not call the effect function on rerender", () => {
		const effectFn = vi.fn();
		const { rerender } = renderHook(() => useMountEffect(effectFn));
		rerender();
		rerender();
		// StrictMode may double-invoke, but rerenders should not trigger again
		expect(effectFn).toHaveBeenCalledTimes(1);
	});

	it("should call the cleanup function on unmount", () => {
		const cleanup = vi.fn();
		const effectFn = vi.fn(() => cleanup);
		const { unmount } = renderHook(() => useMountEffect(effectFn));
		expect(cleanup).not.toHaveBeenCalled();
		unmount();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});
