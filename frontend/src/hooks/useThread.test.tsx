import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import useThread from "./useThread";

const { mockAgentClient } = vi.hoisted(() => ({
	mockAgentClient: {
		threads: {
			getHistory: vi.fn(),
			getState: vi.fn(),
			search: vi.fn(),
		},
	},
}));

vi.mock("@/lib/api/agentClient", () => ({ agentClient: mockAgentClient }));
vi.mock("@/lib/utils/format", () => ({
	formatMessages: (messages: any[]) => messages,
}));
vi.mock("@/lib/utils/message", () => ({
	latestHumanMessage: (messages: any[]) =>
		messages.find((message) => message.type === "human"),
}));

type ThreadCallbacks = {
	setCheckpoints: (checkpoints: any[]) => void;
	setMessages: (messages: any[]) => void;
	setMetadata: (metadata: any) => void;
	setFilesMap: (filesMap: Map<string, any>) => void;
	setTodos: (todos: any[]) => void;
	setModel: (model: string) => void;
};

function Harness({
	callbacks,
	threadId = "thread-1",
}: {
	callbacks: ThreadCallbacks;
	threadId?: string;
}) {
	const thread = useThread();
	thread.useLoadThreadEffect(threadId, callbacks);
	return null;
}

describe("useThread Agent Protocol hydration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("loads latest history, workspace files, todos, and model through SDK history", async () => {
		mockAgentClient.threads.getHistory.mockResolvedValue([
			{
				metadata: { project_id: "project-1" },
				values: {
					messages: [
						{
							id: "human-1",
							type: "human",
							model: "openai:gpt-4.1-mini",
							content: "Hello",
						},
						{ id: "ai-1", type: "ai", content: "Hi" },
					],
					files: { "/notes.md": { content: ["hello"] } },
					todos: [{ content: "Check", status: "completed" }],
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

		render(<Harness callbacks={callbacks} />);

		await waitFor(() => expect(callbacks.setMessages).toHaveBeenCalled());
		expect(mockAgentClient.threads.getHistory).toHaveBeenCalledWith(
			"thread-1",
			{ limit: 100 },
		);
		expect(callbacks.setMetadata).toHaveBeenCalledWith({
			project_id: "project-1",
			thread_id: "thread-1",
		});
		expect(callbacks.setFilesMap).toHaveBeenCalledWith(
			new Map([["thread", { "/notes.md": { content: ["hello"] } }]]),
		);
		expect(callbacks.setTodos).toHaveBeenCalledWith([
			{ content: "Check", status: "completed" },
		]);
		expect(callbacks.setModel).toHaveBeenCalledWith("openai:gpt-4.1-mini");
	});

	it("keeps the empty history state explicit", async () => {
		mockAgentClient.threads.getHistory.mockResolvedValue([]);
		const callbacks: ThreadCallbacks = {
			setCheckpoints: vi.fn(),
			setMessages: vi.fn(),
			setMetadata: vi.fn(),
			setFilesMap: vi.fn(),
			setTodos: vi.fn(),
			setModel: vi.fn(),
		};
		const state: { error: string | null } = { error: null };
		function StateHarness() {
			const thread = useThread();
			thread.useLoadThreadEffect("thread-1", callbacks);
			useEffect(() => {
				state.error = thread.threadError;
			}, [thread.threadError]);
			return null;
		}
		render(<StateHarness />);
		await waitFor(() =>
			expect(state.error).toBe("No checkpoints found for thread"),
		);
	});

	it("uses SDK POST search semantics for first page and offset pagination", async () => {
		mockAgentClient.threads.search
			.mockResolvedValueOnce(
				Array.from({ length: 20 }, (_, index) => ({
					thread_id: `thread-${index + 1}`,
					updated_at: "2026-01-02",
					metadata: { orchestra_assistant_id: "assistant-1" },
					values: { messages: [] },
				})),
			)
			.mockResolvedValueOnce([]);
		let hook: ReturnType<typeof useThread> | null = null;
		function SearchHarness() {
			hook = useThread();
			return null;
		}
		render(<SearchHarness />);
		await act(async () => {
			await hook?.searchThreads("list_threads", {
				assistant_id: "assistant-1",
			});
		});
		await act(async () => {
			await hook?.loadMoreThreads({ assistant_id: "assistant-1" });
		});

		expect(mockAgentClient.threads.search).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				limit: 20,
				offset: 0,
				metadata: expect.objectContaining({
					orchestra_assistant_id: "assistant-1",
				}),
			}),
		);
		expect(mockAgentClient.threads.search).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ limit: 20, offset: 20 }),
		);
	});

	it("maps authorization failures to an explicit thread error", async () => {
		mockAgentClient.threads.getHistory.mockRejectedValue({ status: 403 });
		const callbacks: ThreadCallbacks = {
			setCheckpoints: vi.fn(),
			setMessages: vi.fn(),
			setMetadata: vi.fn(),
			setFilesMap: vi.fn(),
			setTodos: vi.fn(),
			setModel: vi.fn(),
		};
		const state: { error: string | null } = { error: null };
		function StateHarness() {
			const thread = useThread();
			thread.useLoadThreadEffect("thread-1", callbacks);
			useEffect(() => {
				state.error = thread.threadError;
			}, [thread.threadError]);
			return null;
		}
		render(<StateHarness />);
		await waitFor(() => expect(state.error).toMatch(/access/i));
	});
});
