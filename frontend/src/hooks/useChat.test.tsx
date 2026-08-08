import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import useChat, { STREAM_RECOVERY_TOAST_ID } from "./useChat";

const mockSetLoading = vi.fn();
const mockSetLoadingMessage = vi.fn();
const mockInitiateStream = vi.fn();
const mockFormatMultimodalPayload = vi.fn();

class MockStreamSource {
	onEvent(_handler: unknown) {}
	onError(_handler: unknown) {}
	onClose(_handler: unknown) {}
	close() {}
	async start() {}
}

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => ({
		setLoading: mockSetLoading,
		setLoadingMessage: mockSetLoadingMessage,
	}),
}));

vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => ({
		agent: {
			id: "agent-1",
			model: "openai:gpt-4.1-mini",
			public: false,
			prompt: "You are helpful.",
			tools: [],
			a2a: {},
			mcp: {},
			subagents: [],
		},
	}),
}));

vi.mock("@/lib/utils/format", () => ({
	formatContent: (content: unknown) => {
		if (typeof content === "string") return content;
		if (!content) return "";
		if (Array.isArray(content)) {
			return content
				.filter(
					(b: any) =>
						(b?.type === "text" || b?.type == null) &&
						typeof b?.text === "string",
				)
				.map((b: any) => b.text)
				.join("");
		}
		return "";
	},
	formatMessages: (messages: unknown[]) => messages,
	formatMultimodalPayload: (...args: unknown[]) =>
		mockFormatMultimodalPayload(...args),
}));

vi.mock("@/lib/services", () => ({
	initiateStream: (...args: unknown[]) => mockInitiateStream(...args),
	streamThread: vi.fn(),
}));

vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: () => "token",
}));

vi.mock("@/lib/utils/message", () => ({
	StreamMessageHandler: class {
		toolNameRef = { current: "" };
		history: unknown[];

		constructor(
			_toolNameRef: unknown,
			_toolCallMapRef: unknown,
			history: unknown[],
		) {
			this.history = history;
		}

		processResponse() {}
	},
}));

// Controllable stand-in for the real DistributedStreamSource. Tests grab the
// constructed instance and drive its registered handlers directly.
const { MockDistributedStreamSource } = vi.hoisted(() => {
	class MockDistributedStreamSource {
		static instances: MockDistributedStreamSource[] = [];
		eventHandler: ((event: any) => void) | null = null;
		errorHandler: ((error: Error) => void) | null = null;
		closeHandler: (() => void) | null = null;
		closed = false;
		started = false;

		constructor(
			private threadId: string,
			private runId: string,
			_options?: unknown,
		) {
			MockDistributedStreamSource.instances.push(this);
		}

		getThreadId() {
			return this.threadId;
		}
		getRunId() {
			return this.runId;
		}
		getLastEventId() {
			return null;
		}
		onEvent(handler: (event: any) => void) {
			this.eventHandler = handler;
			return this;
		}
		onError(handler: (error: Error) => void) {
			this.errorHandler = handler;
			return this;
		}
		onClose(handler: () => void) {
			this.closeHandler = handler;
			return this;
		}
		close() {
			this.closed = true;
		}
		async start() {
			this.started = true;
		}
	}
	return { MockDistributedStreamSource };
});

vi.mock("@/lib/utils/streamSource", () => ({
	DistributedStreamSource: MockDistributedStreamSource,
}));

vi.mock("@/lib/utils/activeStreamRecovery", () => ({
	removeActiveStreamRecovery: vi.fn(),
	updateActiveStreamRecovery: vi.fn(),
	upsertActiveStreamRecovery: vi.fn(),
}));

vi.mock("sonner", () => {
	const toast: any = vi.fn();
	toast.success = vi.fn();
	toast.error = vi.fn();
	toast.warning = vi.fn();
	toast.info = vi.fn();
	return { toast };
});

describe("useChat submission files", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFormatMultimodalPayload.mockResolvedValue([
			{ role: "user", content: "hello" },
		]);
		mockInitiateStream.mockResolvedValue(new MockStreamSource());
	});

	it("prefers canonical submission files over stale legacy filesMap entries", async () => {
		const { result } = renderHook(() => useChat());

		act(() => {
			result.current.setFilesMap(
				new Map([
					[
						"old-message",
						{
							"/stale.md": {
								content: ["stale"],
								created_at: "2024-01-01T00:00:00Z",
								modified_at: "2024-01-01T00:00:00Z",
							},
						},
					],
				]),
			);
			result.current.setSubmissionFiles({
				"/current.md": {
					content: ["current"],
					created_at: "2024-01-02T00:00:00Z",
					modified_at: "2024-01-02T00:00:00Z",
				},
			});
		});

		await act(async () => {
			await result.current.handleSubmit("hello");
		});

		expect(mockInitiateStream).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({
					files: {
						"/current.md": {
							content: ["current"],
							created_at: "2024-01-02T00:00:00Z",
							modified_at: "2024-01-02T00:00:00Z",
						},
					},
				}),
			}),
		);
	});

	it("falls back to filesMap when no canonical submission files were provided", async () => {
		const { result } = renderHook(() => useChat());

		act(() => {
			result.current.setFilesMap(
				new Map([
					[
						"message-1",
						{
							"/legacy.md": {
								content: ["legacy"],
								created_at: "2024-01-03T00:00:00Z",
								modified_at: "2024-01-03T00:00:00Z",
							},
						},
					],
				]),
			);
		});

		await act(async () => {
			await result.current.handleSubmit("hello");
		});

		expect(mockInitiateStream).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({
					files: {
						"/legacy.md": {
							content: ["legacy"],
							created_at: "2024-01-03T00:00:00Z",
							modified_at: "2024-01-03T00:00:00Z",
						},
					},
				}),
			}),
		);
	});
});

describe("useChat MCP sandbox unreachable (anti-storm)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		MockDistributedStreamSource.instances.length = 0;
	});

	it("routes 5 consecutive mcp_sandbox_unreachable events to a single run-error banner and zero toasts", async () => {
		const { result } = renderHook(() => useChat());

		act(() => {
			for (let i = 0; i < 5; i++) {
				result.current.sseHandler(
					["mcp_sandbox_unreachable", "MCP sandbox unreachable: boom"],
					[],
					"messages",
				);
			}
		});

		// ANTI-STORM: not one toast for five events — the surface is the banner.
		expect(toast.error).not.toHaveBeenCalled();
		expect(toast).not.toHaveBeenCalled();
		expect(toast.warning).not.toHaveBeenCalled();
		expect(toast.info).not.toHaveBeenCalled();

		// Exactly one run-error state, not a stack of five.
		expect(result.current.runError).toEqual({
			runId: "",
			message: "MCP sandbox unreachable: boom",
			recoverable: false,
		});
		expect(mockSetLoading).toHaveBeenLastCalledWith(false);
	});

	it("marks the sandbox failure non-recoverable so the DLQ replay affordance is withheld", () => {
		const { result } = renderHook(() => useChat());

		act(() => {
			result.current.sseHandler(
				["mcp_sandbox_unreachable", { unexpected: "shape" }],
				[],
				"messages",
			);
		});

		expect(result.current.runError?.recoverable).toBe(false);
		// Replay is hidden, so the copy must tell the user what to do instead.
		expect(result.current.runError?.message).toBe(
			"The MCP sandbox server could not be reached. Send your message again to retry.",
		);
	});

	it("reaches the banner from a unified stream event (not just the legacy fallback)", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		const stream = MockDistributedStreamSource.instances[0];
		expect(stream).toBeDefined();

		act(() => {
			stream.eventHandler?.({
				type: "mcp_sandbox_unreachable",
				data: "MCP sandbox unreachable: connection refused",
			});
		});

		expect(result.current.runError).toEqual({
			runId: "",
			message: "MCP sandbox unreachable: connection refused",
			recoverable: false,
		});
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("uses the latest run_id from metadata, not the value captured at stream start", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		const stream = MockDistributedStreamSource.instances[0];

		// run_id arrives on a later metadata event, after startManagedStream
		// captured its render-time `metadata`.
		act(() => {
			stream.eventHandler?.({
				type: "metadata",
				data: {
					thread_id: "thread-1",
					run_id: "run-late",
					assistant_id: null,
					project_id: null,
				},
			});
		});

		act(() => {
			stream.eventHandler?.({
				type: "mcp_sandbox_unreachable",
				data: "MCP sandbox unreachable: boom",
			});
		});

		expect(result.current.runError?.runId).toBe("run-late");
	});
});

describe("useChat recovery-mode stream errors (anti-storm)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		MockDistributedStreamSource.instances.length = 0;
	});

	it("toasts once for a stream that emits four error events", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		const stream = MockDistributedStreamSource.instances[0];

		act(() => {
			for (let i = 0; i < 4; i++) {
				stream.eventHandler?.({
					type: "error",
					data: { error: "Lost the worker" },
				});
			}
		});

		// This pins the *teardown*, not the latch: the first error aborts the
		// controller and closes the stream, so events 2-4 bail at the
		// `signal.aborted` guard and never reach the toast. (The latch itself is
		// load-bearing on the onError path — see the transport-errors test.)
		expect(toast.error).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith("Lost the worker", {
			id: STREAM_RECOVERY_TOAST_ID,
		});
		// The stream is torn down rather than left polling.
		expect(stream.closed).toBe(true);
	});

	it("keeps the latch per-stream: a later stream still notifies", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		act(() => {
			MockDistributedStreamSource.instances[0].eventHandler?.({
				type: "error",
				data: { error: "Lost the worker" },
			});
		});

		expect(toast.error).toHaveBeenCalledTimes(1);

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-2",
				runId: "run-2",
			});
		});

		expect(MockDistributedStreamSource.instances).toHaveLength(2);

		act(() => {
			MockDistributedStreamSource.instances[1].eventHandler?.({
				type: "error",
				data: { error: "Lost the worker again" },
			});
		});

		// Per-stream, not global: the second stream gets its own notification.
		expect(toast.error).toHaveBeenCalledTimes(2);
		expect(toast.error).toHaveBeenLastCalledWith("Lost the worker again", {
			id: STREAM_RECOVERY_TOAST_ID,
		});
	});

	it("collapses repeated transport errors on one recovery stream into a single toast", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		const stream = MockDistributedStreamSource.instances[0];

		act(() => {
			for (let i = 0; i < 3; i++) {
				stream.errorHandler?.(new Error("network down"));
			}
		});

		expect(toast.error).toHaveBeenCalledTimes(1);
		expect(toast.error).toHaveBeenCalledWith(
			"Lost connection to the live stream. Refresh to retry reconnecting.",
			{ id: STREAM_RECOVERY_TOAST_ID },
		);
	});

	it("does not give the 404/409 informational toast the recovery id", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () => {
			await result.current.attachToDistributedStream({
				threadId: "thread-1",
				runId: "run-1",
			});
		});

		const stream = MockDistributedStreamSource.instances[0];
		const notFound = Object.assign(new Error("gone"), { status: 404 });

		act(() => {
			stream.errorHandler?.(notFound);
		});

		expect(toast.error).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith(
			"Stream ended while reconnecting. Loaded the latest saved thread state.",
		);
	});
});
