import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useChat from "./useChat";

const { mockAgentClient, mockFormatMessages, mockFormatMultimodalPayload } =
	vi.hoisted(() => ({
		mockAgentClient: {
			threads: { create: vi.fn(), delete: vi.fn() },
			runs: { stream: vi.fn(), cancel: vi.fn() },
		},
		mockFormatMessages: vi.fn((messages: any[]) => messages),
		mockFormatMultimodalPayload: vi.fn(),
	}));

vi.mock("@/lib/api/agentClient", () => ({
	agentClient: mockAgentClient,
	mapAssistantToProductionGraph: () => ({
		assistantId: "production-assistant",
		graphId: "orchestra",
		context: { assistant_id: "assistant-1", model: "openai:gpt-4.1-mini" },
		config: {
			configurable: {
				assistant_id: "assistant-1",
				model: "openai:gpt-4.1-mini",
			},
		},
		metadata: { orchestra_assistant_id: "assistant-1" },
	}),
	adaptEvent: (event: any) => {
		if (
			!["metadata", "messages", "values", "custom", "error"].includes(
				event.event,
			)
		)
			return null;
		if (event.event === "messages" && Array.isArray(event.data)) {
			const [message, metadata] = event.data;
			return {
				type: "messages",
				data: [
					{
						...message,
						type: message.type === "AIMessageChunk" ? "ai" : message.type,
					},
					metadata,
				],
				id: event.id,
			};
		}
		return { type: event.event, data: event.data, id: event.id };
	},
	describeAgentError: (error: any) => ({
		message: error?.message || "request failed",
	}),
}));

vi.mock("@/context/AppContext", () => ({
	useAppContext: () => ({ setLoading: vi.fn(), setLoadingMessage: vi.fn() }),
}));
vi.mock("@/context/AgentContext", () => ({
	useAgentContext: () => ({
		agent: {
			id: "assistant-1",
			model: "openai:gpt-4.1-mini",
			prompt: "Be helpful",
			public: false,
			tools: [],
			a2a: {},
			mcp: {},
			subagents: [],
		},
	}),
}));
vi.mock("@/lib/utils/format", () => ({
	formatContent: (content: unknown) =>
		typeof content === "string" ? content : "",
	formatMessages: (messages: any[]) => mockFormatMessages(messages),
	formatMultimodalPayload: (...args: unknown[]) =>
		mockFormatMultimodalPayload(...args),
}));
vi.mock("@/lib/services/userSettingsService", () => ({
	getSettings: vi.fn().mockResolvedValue({ defaults: { timezone: "UTC" } }),
}));
vi.mock("@/hooks/useMountEffect", () => ({
	useMountEffect: (effect: () => void) => effect(),
}));
vi.mock("@/lib/utils/message", () => ({
	StreamMessageHandler: class {
		toolNameRef = { current: "" };
		history: any[];
		constructor(...args: unknown[]) {
			this.history = args[2] as any[];
		}
		processResponse(response: any, content: string, existingIndex: number) {
			if (!content) return;
			if (existingIndex === -1) this.history.push({ ...response, content });
			else
				this.history[existingIndex] = {
					...this.history[existingIndex],
					...response,
					content,
				};
		}
	},
}));

const makeStream = (events: any[]) =>
	(async function* () {
		for (const event of events) yield event;
	})();

describe("useChat LangGraph SDK stream", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAgentClient.threads.create.mockResolvedValue({ thread_id: "thread-1" });
		mockAgentClient.runs.cancel.mockResolvedValue(undefined);
		mockFormatMultimodalPayload.mockResolvedValue([
			{ role: "user", content: "hello" },
		]);
		mockAgentClient.runs.stream.mockImplementation(
			(_thread, _assistant, payload) => {
				payload.onRunCreated?.({ run_id: "run-1", thread_id: "thread-1" });
				return makeStream([
					{
						event: "metadata",
						data: { run_id: "run-1", thread_id: "thread-1" },
					},
					{
						event: "messages",
						data: [
							{ id: "ai-1", type: "AIMessageChunk", content: "Hello" },
							{ tags: [] },
						],
					},
					{
						event: "values",
						data: { todos: [{ content: "Done", status: "completed" }] },
					},
				]);
			},
		);
	});

	it("starts one production run with tuple, values, custom, subgraph, and resume options", async () => {
		const { result } = renderHook(() => useChat());
		await act(async () => result.current.handleSubmit("hello"));

		expect(mockAgentClient.threads.create).toHaveBeenCalledWith(
			expect.objectContaining({
				graphId: "orchestra",
				signal: expect.any(AbortSignal),
			}),
		);
		expect(mockAgentClient.runs.stream).toHaveBeenCalledWith(
			"thread-1",
			"production-assistant",
			expect.objectContaining({
				streamMode: ["messages-tuple", "values", "custom"],
				streamSubgraphs: true,
				streamResumable: true,
				streamIdleReconnect: "auto",
				onDisconnect: "continue",
				signal: expect.any(AbortSignal),
			}),
		);
		expect(result.current.messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "user", content: "hello" }),
				expect.objectContaining({ type: "ai", content: "Hello" }),
			]),
		);
		expect(result.current.todos).toEqual([
			{ content: "Done", status: "completed" },
		]);
	});

	it("rejects a duplicate submit while an SDK run is active", async () => {
		const { result } = renderHook(() => useChat());

		await act(async () =>
			Promise.all([
				result.current.handleSubmit("first"),
				result.current.handleSubmit("duplicate"),
			]),
		);

		expect(mockAgentClient.runs.stream).toHaveBeenCalledTimes(1);
		expect(result.current.messages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "user", content: "first" }),
			]),
		);
		expect(result.current.messages).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "user", content: "duplicate" }),
			]),
		);
	});

	it("cancels a run acknowledged after a local abort", async () => {
		let release: (() => void) | undefined;
		let onRunCreated:
			| ((run: { run_id: string; thread_id?: string }) => void)
			| undefined;
		mockAgentClient.runs.stream.mockImplementation(
			(_thread, _assistant, payload) => {
				onRunCreated = payload.onRunCreated;
				return (async function* () {
					await new Promise<void>((resolve) => {
						release = resolve;
					});
					yield { event: "metadata", data: {} };
				})();
			},
		);
		const { result } = renderHook(() => useChat());
		const submit = result.current.handleSubmit("hello");
		await waitFor(() => expect(mockAgentClient.runs.stream).toHaveBeenCalled());

		await act(async () => result.current.abortQuery());
		onRunCreated?.({ run_id: "run-late", thread_id: "thread-1" });
		await waitFor(() =>
			expect(mockAgentClient.runs.cancel).toHaveBeenCalledWith(
				"thread-1",
				"run-late",
				false,
				"interrupt",
			),
		);
		release?.();
		await act(async () => submit);
	});

	it("cancels only the active SDK run and keeps received content", async () => {
		let release: (() => void) | undefined;
		mockAgentClient.runs.stream.mockImplementation(
			(_thread, _assistant, payload) => {
				payload.onRunCreated?.({ run_id: "run-cancel", thread_id: "thread-1" });
				return (async function* () {
					yield {
						event: "messages",
						data: [
							{ id: "ai-1", type: "AIMessageChunk", content: "partial" },
							{},
						],
					};
					await new Promise<void>((resolve) => {
						release = resolve;
					});
				})();
			},
		);
		const { result } = renderHook(() => useChat());
		const submit = result.current.handleSubmit("hello");
		await waitFor(() => expect(result.current.controller).not.toBeNull());

		await act(async () => result.current.abortQuery());
		expect(mockAgentClient.runs.cancel).toHaveBeenCalledWith(
			"thread-1",
			"run-cancel",
			false,
			"interrupt",
		);
		expect(result.current.controller).toBeNull();
		expect(result.current.streamStatus).toBe("The request was stopped.");
		expect(result.current.messages).toEqual(
			expect.arrayContaining([expect.objectContaining({ content: "partial" })]),
		);
		release?.();
		await act(async () => submit);
	});

	it("maps terminal SDK errors to an inline state instead of an alert", async () => {
		mockAgentClient.runs.stream.mockImplementation(() =>
			makeStream([
				{
					event: "error",
					data: { error: "quota exceeded", message: "quota exceeded" },
				},
			]),
		);
		const { result } = renderHook(() => useChat());
		await act(async () => result.current.handleSubmit("hello"));

		expect(result.current.runError).toMatchObject({
			message: "quota exceeded",
			recoverable: false,
		});
		expect(result.current.streamStatus).toBeNull();
	});
});
