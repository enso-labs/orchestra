import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMessageQueue } from "@/hooks/useMessageQueue";

/**
 * Sonner stub. All four surfaces the app uses are stubbed — the hook calls
 * `toast.warning`, which a two-method stub would blow up on.
 */
const toastMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	warning: vi.fn(),
	info: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

/** The literal ids the hook must attach. Duplicated deliberately: asserting
 * against an imported constant would pass even if the constant changed. */
const DROP_TOAST_ID = "message-queue-dropped";
const RETRY_TOAST_ID = "message-queue-retry";

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

/**
 * Anti-storm coverage for the drop/retry notifications.
 *
 * A backend outage exhausts every queued message in turn. Before the fix each
 * exhausted message emitted its own id-less `toast.error`, so a full queue
 * stacked MAX_QUEUE_SIZE toasts. The fix collapses a cascade into one
 * accumulating toast under a fixed id.
 *
 * NOTE ON PUMPING: the failure path does NOT self-drive — on a rejected
 * `executeSubmit` the catch only increments `retryCount`; there is no
 * `setTimeout(processNext)`. Only the drop path cascades. So this suite drives
 * processing explicitly via the stream-completion edge (isStreaming true ->
 * false) rather than assuming a self-draining loop.
 */
describe("useMessageQueue drop/retry toast storm", () => {
	const MAX_RETRIES = 3;

	beforeEach(() => {
		vi.useFakeTimers();
		toastMock.error.mockClear();
		toastMock.warning.mockClear();
		toastMock.success.mockClear();
		toastMock.info.mockClear();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	/**
	 * Queue `queries` against an always-rejecting submit, then pump processing
	 * until the queue drains. Returns the observed ids seen in `queuedItems`
	 * after every pump so loss/duplication can be checked.
	 */
	async function drainAgainstFailure(queries: string[]) {
		const executeSubmit = vi.fn().mockRejectedValue(new Error("network down"));
		const { result, rerender } = renderHook(
			({ isStreaming }: { isStreaming: boolean }) =>
				useMessageQueue({ isStreaming, executeSubmit }),
			{ initialProps: { isStreaming: true } },
		);

		// Streaming, so these queue rather than dispatch.
		act(() => {
			for (const query of queries) result.current.enqueue(query);
		});
		expect(result.current.queueLength).toBe(queries.length);

		const idSnapshots: string[][] = [];
		// Each message needs MAX_RETRIES attempts plus one drop-check pump.
		const pumps = queries.length * (MAX_RETRIES + 1) + 4;
		for (let i = 0; i < pumps; i++) {
			// Stream-completion edge: true -> false schedules processNext(100ms).
			rerender({ isStreaming: true });
			rerender({ isStreaming: false });
			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});
			idSnapshots.push(result.current.queuedItems.map((m) => m.id));
		}

		return { executeSubmit, result, idSnapshots };
	}

	it("keeps every drop toast under one literal id across an N-message cascade", async () => {
		const queries = ["alpha msg", "bravo msg", "charlie msg"];
		const { result } = await drainAgainstFailure(queries);

		expect(result.current.queueLength).toBe(0);
		// One drop per message — a real cascade, not a single drop.
		expect(toastMock.error).toHaveBeenCalledTimes(queries.length);
		expect(toastMock.error.mock.calls.length).toBeGreaterThanOrEqual(3);

		// EVERY call carries the literal drop id. Asserting "few distinct ids"
		// would pass pre-fix, where every call passed `undefined`.
		for (const call of toastMock.error.mock.calls) {
			expect(call[1]).toBeDefined();
			expect(call[1].id).toBe(DROP_TOAST_ID);
		}
	});

	it("titles the summary toast with the aggregate drop count", async () => {
		const queries = ["alpha msg", "bravo msg", "charlie msg"];
		await drainAgainstFailure(queries);

		const titles = toastMock.error.mock.calls.map((call) => call[0] as string);

		// First drop reads singular; every later drop in the window accumulates.
		expect(titles[0]).toBe("Message dropped after max retries");
		expect(titles[1]).toMatch(/^\d+ messages dropped after max retries$/);
		expect(titles[titles.length - 1]).toBe(
			`${queries.length} messages dropped after max retries`,
		);

		// The plural summary must not quote one message's text as if it
		// described all of them.
		const lastCall = toastMock.error.mock.calls[titles.length - 1];
		expect(lastCall[1].description).not.toContain("charlie msg");
	});

	it("keeps every retry toast under its own literal id, distinct from the drop id", async () => {
		await drainAgainstFailure(["alpha msg", "bravo msg", "charlie msg"]);

		// Retries fire on attempts 1..MAX_RETRIES-1 for each message.
		expect(toastMock.warning.mock.calls.length).toBeGreaterThanOrEqual(3);
		for (const call of toastMock.warning.mock.calls) {
			expect(call[1]).toBeDefined();
			expect(call[1].id).toBe(RETRY_TOAST_ID);
		}
		expect(RETRY_TOAST_ID).not.toBe(DROP_TOAST_ID);
	});

	it("loses and duplicates no queued message across the drop cascade", async () => {
		const queries = ["alpha msg", "bravo msg", "charlie msg"];
		const { executeSubmit, result, idSnapshots } =
			await drainAgainstFailure(queries);

		// Each message got exactly MAX_RETRIES attempts — none skipped, none
		// retried past its budget.
		for (const query of queries) {
			const attempts = executeSubmit.mock.calls.filter(
				(call) => call[0] === query,
			).length;
			expect(attempts).toBe(MAX_RETRIES);
		}
		expect(executeSubmit).toHaveBeenCalledTimes(queries.length * MAX_RETRIES);

		// The queue never held a duplicate id, shrank monotonically, and drained.
		let previousLength = queries.length;
		for (const ids of idSnapshots) {
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.length).toBeLessThanOrEqual(previousLength);
			previousLength = ids.length;
		}
		expect(result.current.queuedItems).toHaveLength(0);
	});
});
