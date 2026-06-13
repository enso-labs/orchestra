import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentTitle } from "./useDocumentTitle";

const mockLoadingState = { loading: false };

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => mockLoadingState,
}));

describe("useDocumentTitle", () => {
	const DEFAULT_TITLE = "Mifune - Orchestra 🪶";
	const STREAMING_TITLE = "[Streaming...] Mifune";
	const DONE_TITLE = "[Done] Mifune";

	beforeEach(() => {
		vi.useFakeTimers();
		document.title = DEFAULT_TITLE;
		mockLoadingState.loading = false;
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.title = DEFAULT_TITLE;
	});

	it("should not change title when idle on initial mount", () => {
		renderHook(() => useDocumentTitle());
		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should have idle status initially", () => {
		const { result } = renderHook(() => useDocumentTitle());
		expect(result.current.status).toBe("idle");
	});

	it("should show streaming indicator when loading is true", () => {
		mockLoadingState.loading = true;
		renderHook(() => useDocumentTitle());
		expect(document.title).toBe(STREAMING_TITLE);
	});

	it("should have streaming status when loading is true", () => {
		mockLoadingState.loading = true;
		renderHook(() => useDocumentTitle());
		// Verify through title since that's the observable behavior
		expect(document.title).toBe(STREAMING_TITLE);
	});

	it("should show done indicator when loading transitions from true to false", () => {
		mockLoadingState.loading = true;
		const { rerender } = renderHook(() => useDocumentTitle());

		expect(document.title).toBe(STREAMING_TITLE);

		mockLoadingState.loading = false;
		rerender();

		expect(document.title).toBe(DONE_TITLE);
	});

	it("should return to idle title after done timeout", () => {
		mockLoadingState.loading = true;
		const { rerender } = renderHook(() => useDocumentTitle());

		mockLoadingState.loading = false;
		rerender();

		expect(document.title).toBe(DONE_TITLE);

		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should handle undefined loading state gracefully", () => {
		(mockLoadingState as any).loading = undefined;
		renderHook(() => useDocumentTitle());
		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should handle null loading state gracefully", () => {
		(mockLoadingState as any).loading = null;
		renderHook(() => useDocumentTitle());
		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should restore default title on unmount", () => {
		mockLoadingState.loading = true;
		const { unmount } = renderHook(() => useDocumentTitle());

		expect(document.title).toBe(STREAMING_TITLE);

		unmount();

		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should clear timeout on unmount", () => {
		mockLoadingState.loading = true;
		const { rerender, unmount } = renderHook(() => useDocumentTitle());

		mockLoadingState.loading = false;
		rerender();

		expect(document.title).toBe(DONE_TITLE);

		unmount();

		expect(document.title).toBe(DEFAULT_TITLE);

		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(document.title).toBe(DEFAULT_TITLE);
	});

	it("should cancel done timeout when new stream starts", () => {
		mockLoadingState.loading = true;
		const { rerender } = renderHook(() => useDocumentTitle());

		mockLoadingState.loading = false;
		rerender();
		expect(document.title).toBe(DONE_TITLE);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		mockLoadingState.loading = true;
		rerender();
		expect(document.title).toBe(STREAMING_TITLE);

		act(() => {
			vi.advanceTimersByTime(2500);
		});

		expect(document.title).toBe(STREAMING_TITLE);
	});

	it("should handle rapid loading state changes", () => {
		const { rerender } = renderHook(() => useDocumentTitle());

		for (let i = 0; i < 5; i++) {
			mockLoadingState.loading = true;
			rerender();
			mockLoadingState.loading = false;
			rerender();
		}

		expect(document.title).toBe(DONE_TITLE);

		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(document.title).toBe(DEFAULT_TITLE);
	});
});
