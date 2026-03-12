import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import useThread from "./useThread";

const mockSearchThreads = vi.fn();

vi.mock("@/lib/services/threadService", () => ({
	searchThreads: (...args: any[]) => mockSearchThreads(...args),
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
	onStateChange,
	callbacks,
}: {
	threadId: string;
	enabled: boolean;
	onStateChange: (state: HookState) => void;
	callbacks?: ThreadCallbacks;
}) {
	const thread = useThread();
	const threadCallbacks = callbacks || {
		setCheckpoints: vi.fn(),
		setMessages: vi.fn(),
		setMetadata: vi.fn(),
		setFilesMap: vi.fn(),
		setTodos: vi.fn(),
		setModel: vi.fn(),
	};

	thread.useLoadThreadEffect(threadId, threadCallbacks, { enabled });

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
	});

	it("clears stale thread errors and loading state when hydration is disabled", async () => {
		mockSearchThreads.mockResolvedValueOnce([]);

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

	it("does not apply late thread hydration after the effect is disabled", async () => {
		let resolveSearch: (value: any[]) => void = () => undefined;
		mockSearchThreads.mockImplementationOnce(
			() =>
				new Promise<any[]>((resolve) => {
					resolveSearch = resolve;
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
			resolveSearch([
				{
					metadata: {
						thread_id: "thread-123",
						files: {},
						todos: [],
					},
					values: {
						messages: [{ id: "msg-1", role: "user", content: "Hello" }],
					},
				},
			]);
			await Promise.resolve();
		});

		expect(callbacks.setMessages).not.toHaveBeenCalled();
		expect(callbacks.setMetadata).not.toHaveBeenCalled();
	});

	it("ignores historical metadata.files when hydrating a thread", async () => {
		mockSearchThreads.mockResolvedValueOnce([
			{
				metadata: {
					thread_id: "thread-123",
					files: {
						"/historical.txt": {
							content: ["legacy"],
							created_at: "2024-01-01T00:00:00Z",
							modified_at: "2024-01-01T00:00:00Z",
						},
					},
					todos: [],
				},
				values: {
					messages: [
						{ id: "msg-1", role: "user", content: "Hello" },
						{ id: "msg-2", role: "assistant", content: "Hi" },
					],
				},
			},
		]);

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
			expect(callbacks.setFilesMap).toHaveBeenCalledWith(new Map());
		});
	});
});
