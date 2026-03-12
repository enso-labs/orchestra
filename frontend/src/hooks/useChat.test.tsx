import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useChat from "./useChat";

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
	formatContent: (content: unknown) => content ?? "",
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

vi.mock("@/lib/utils/streamSource", () => ({
	DistributedStreamSource: class {},
}));

vi.mock("@/lib/utils/activeStreamRecovery", () => ({
	removeActiveStreamRecovery: vi.fn(),
	updateActiveStreamRecovery: vi.fn(),
	upsertActiveStreamRecovery: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

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
