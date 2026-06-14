import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMessageQueue } from "@/hooks/useMessageQueue";

/**
 * Unit coverage for the short-window content dedup guard in `enqueue`.
 *
 * A rapid double-submit of identical, non-empty content (double-click /
 * double-Enter) must dispatch exactly ONE assistant run, not two. The guard
 * rejects the duplicate enqueue within DEDUP_WINDOW_MS without appending or
 * dispatching, while leaving distinct messages and deliberate out-of-window
 * repeats untouched.
 */
describe("useMessageQueue dedup guard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("dispatches an identical rapid double-submit exactly once", async () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: false, executeSubmit }),
		);

		let firstAccepted = false;
		let secondAccepted = true;
		await act(async () => {
			firstAccepted = result.current.enqueue("ping idempotency test");
			// Second identical submit immediately afterwards (no clock advance)
			secondAccepted = result.current.enqueue("ping idempotency test");
		});

		expect(firstAccepted).toBe(true);
		expect(secondAccepted).toBe(false);
		// Only the first message is dispatched
		expect(executeSubmit).toHaveBeenCalledTimes(1);
		expect(executeSubmit).toHaveBeenCalledWith("ping idempotency test", []);
	});

	it("does not dedup distinct messages", async () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: false, executeSubmit }),
		);

		let a = false;
		let b = false;
		await act(async () => {
			a = result.current.enqueue("first message");
			b = result.current.enqueue("second message");
		});

		expect(a).toBe(true);
		expect(b).toBe(true);
		expect(executeSubmit).toHaveBeenCalledWith("first message", []);
	});

	it("allows a deliberate identical repeat after the dedup window elapses", async () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: false, executeSubmit }),
		);

		let first = false;
		await act(async () => {
			first = result.current.enqueue("repeat me");
		});
		expect(first).toBe(true);

		// Advance past DEDUP_WINDOW_MS (1500ms) — a later identical send is legit
		act(() => {
			vi.advanceTimersByTime(1600);
		});

		let second = false;
		await act(async () => {
			second = result.current.enqueue("repeat me");
		});
		expect(second).toBe(true);
	});

	it("dedups identical content ignoring surrounding whitespace", async () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: false, executeSubmit }),
		);

		let first = false;
		let second = true;
		await act(async () => {
			first = result.current.enqueue("trimmed");
			second = result.current.enqueue("  trimmed  ");
		});

		expect(first).toBe(true);
		expect(second).toBe(false);
	});

	it("queues an identical rapid double-submit only once while streaming", () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: true, executeSubmit }),
		);

		act(() => {
			result.current.enqueue("queued ping");
			result.current.enqueue("queued ping");
		});

		// While streaming, the message is queued (not dispatched) — exactly one
		// entry should be present, proving the duplicate was rejected.
		expect(result.current.queueLength).toBe(1);
		expect(executeSubmit).not.toHaveBeenCalled();
	});

	it("does not dedup empty (whitespace-only) submissions", () => {
		const executeSubmit = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useMessageQueue({ isStreaming: true, executeSubmit }),
		);

		let a = false;
		let b = false;
		act(() => {
			a = result.current.enqueue("   ");
			b = result.current.enqueue("   ");
		});

		// Empty queries are accepted (a no-op downstream) and never tracked, so
		// they must not poison the dedup state for a following real message.
		expect(a).toBe(true);
		expect(b).toBe(true);
	});
});
