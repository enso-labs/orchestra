import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import useThread from "./useThread";

const mockSearchThreads = vi.fn();
const mockGetThread = vi.fn();
const mockGetThreadCheckpoint = vi.fn();

vi.mock("@/lib/services/threadService", () => ({
	searchThreads: (...args: any[]) => mockSearchThreads(...args),
	getThread: (...args: any[]) => mockGetThread(...args),
	getThreadCheckpoint: (...args: any[]) => mockGetThreadCheckpoint(...args),
	listThreadCheckpoints: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/utils/format", () => ({
	formatMessages: (messages: any[]) => messages,
}));

vi.mock("@/lib/utils/message", () => ({
	latestHumanMessage: () => ({ model: "openai:gpt-4.1-mini" }),
}));

type HookState = {
	threadLoading: boolean;
	threadError: string | null;
};

type ThreadCallbacks = {
	setCheckpoints: ReturnType<typeof vi.fn>;
	setMessages: ReturnType<typeof vi.fn>;
	setMetadata: ReturnType<typeof vi.fn>;
	setFilesMap: ReturnType<typeof vi.fn>;
	setTodos: ReturnType<typeof vi.fn>;
	setModel: ReturnType<typeof vi.fn>;
};

function UseLoadThreadEffectHarness({
	threadId,
	enabled,
	checkpointId,
	onStateChange,
	callbacks,
}: {
	threadId: string;
	enabled: boolean;
	checkpointId?: string;
	onStateChange: (state: HookState) => void;
	callbacks?: ThreadCallbacks;
}) {
	const thread = useThread();
	const defaultCallbacksRef = useRef<ThreadCallbacks>({
		setCheckpoints: vi.fn(),
		setMessages: vi.fn(),
		setMetadata: vi.fn(),
		setFilesMap: vi.fn(),
		setTodos: vi.fn(),
		setModel: vi.fn(),
	});
	const threadCallbacks = callbacks || defaultCallbacksRef.current;

	thread.useLoadThreadEffect(threadId, threadCallbacks, {
		enabled,
		checkpointId,
	});

	useEffect(() => {
		onStateChange({
			threadLoading: thread.threadLoading,
			threadError: thread.threadError,
		});
	}, [onStateChange, thread.threadError, thread.threadLoading]);

	return null;
}

describe("useThread", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSearchThreads.mockResolvedValue([]);
	});

	it("clears stale thread errors and loading state when hydration is disabled", async () => {
		mockGetThread.mockResolvedValueOnce({
			id: "thread-123",
			head_checkpoint_id: null,
		});

		const state: HookState = {
			threadLoading: false,
			threadError: null,
		};

		const { rerender } = render(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={true}
				onStateChange={(nextState) => Object.assign(state, nextState)}
			/>,
		);

		await waitFor(() => {
			expect(state.threadError).toBe("No checkpoints found for thread");
		});

		rerender(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={false}
				onStateChange={(nextState) => Object.assign(state, nextState)}
			/>,
		);

		await waitFor(() => {
			expect(state.threadError).toBeNull();
			expect(state.threadLoading).toBe(false);
		});
	});

	it("loads the latest checkpoint when no checkpointId is provided", async () => {
		mockGetThread.mockResolvedValueOnce({
			id: "thread-123",
			head_checkpoint_id: "cp-head",
			assistant_id: "assistant-123",
		});
		mockGetThreadCheckpoint.mockResolvedValueOnce({
			thread_id: "thread-123",
			checkpoint_id: "cp-head",
			messages: [{ id: "msg-1", role: "user", content: "Hello" }],
			files: {},
			todos: [],
			metadata: {},
		});

		const callbacks: ThreadCallbacks = {
			setCheckpoints: vi.fn(),
			setMessages: vi.fn(),
			setMetadata: vi.fn(),
			setFilesMap: vi.fn(),
			setTodos: vi.fn(),
			setModel: vi.fn(),
		};

		render(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={true}
				callbacks={callbacks}
				onStateChange={() => undefined}
			/>,
		);

		await waitFor(() => {
			expect(mockGetThreadCheckpoint).toHaveBeenCalledWith(
				"thread-123",
				"cp-head",
			);
			expect(callbacks.setMetadata).toHaveBeenCalledWith(
				expect.objectContaining({
					thread_id: "thread-123",
					checkpoint_id: "cp-head",
					head_checkpoint_id: "cp-head",
				}),
			);
		});
	});

	it("loads checkpoint preview when checkpointId is present", async () => {
		mockGetThread.mockResolvedValueOnce({
			id: "thread-123",
			head_checkpoint_id: "cp-head",
		});
		mockGetThreadCheckpoint.mockResolvedValueOnce({
			thread_id: "thread-123",
			checkpoint_id: "cp-old",
			messages: [{ id: "msg-1", role: "user", content: "Hello" }],
			files: {},
			todos: [],
			metadata: {},
		});

		render(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={true}
				checkpointId="cp-old"
				onStateChange={() => undefined}
			/>,
		);

		await waitFor(() => {
			expect(mockGetThreadCheckpoint).toHaveBeenCalledWith(
				"thread-123",
				"cp-old",
			);
		});
	});

	it("does not apply late thread hydration after the effect is disabled", async () => {
		let resolveThread: (value: any) => void = () => undefined;
		let resolveCheckpoint: (value: any) => void = () => undefined;

		mockGetThread.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveThread = resolve;
				}),
		);
		mockGetThreadCheckpoint.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveCheckpoint = resolve;
				}),
		);

		const callbacks: ThreadCallbacks = {
			setCheckpoints: vi.fn(),
			setMessages: vi.fn(),
			setMetadata: vi.fn(),
			setFilesMap: vi.fn(),
			setTodos: vi.fn(),
			setModel: vi.fn(),
		};

		const { rerender } = render(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={true}
				callbacks={callbacks}
				onStateChange={() => undefined}
			/>,
		);

		rerender(
			<UseLoadThreadEffectHarness
				threadId="thread-123"
				enabled={false}
				callbacks={callbacks}
				onStateChange={() => undefined}
			/>,
		);

		await act(async () => {
			resolveThread({
				id: "thread-123",
				head_checkpoint_id: "cp-head",
			});
			resolveCheckpoint({
				thread_id: "thread-123",
				checkpoint_id: "cp-head",
				messages: [{ id: "msg-1", role: "user", content: "Hello" }],
				files: {},
				todos: [],
				metadata: {},
			});
			await Promise.resolve();
		});

		expect(callbacks.setMessages).not.toHaveBeenCalled();
		expect(callbacks.setMetadata).not.toHaveBeenCalled();
	});
});
