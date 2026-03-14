import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initiateStream } from "@/lib/services/threadService";
import {
	SyncStreamSource,
	DistributedStreamSource,
} from "@/lib/utils/streamSource";
import type { StreamEvent } from "@/lib/entities/stream";

// Mock dependencies
vi.mock("@/lib/config", () => ({
	VITE_API_URL: "http://test-api.com",
}));

vi.mock("@/lib/utils/auth", () => ({
	getAuthToken: vi.fn(() => "test-token"),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Creates a mock ReadableStream from SSE data lines.
 */
function createMockStream(lines: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const data = lines.join("\n") + "\n";
	let consumed = false;

	return new ReadableStream({
		pull(controller) {
			if (!consumed) {
				controller.enqueue(encoder.encode(data));
				consumed = true;
			} else {
				controller.close();
			}
		},
	});
}

/**
 * Creates a mock streaming Response.
 */
function createStreamResponse(lines: string[]): Response {
	return {
		ok: true,
		status: 200,
		headers: new Headers({ "Content-Type": "text/event-stream" }),
		body: createMockStream(lines),
	} as Response;
}

/**
 * Creates a mock 202 Accepted response for distributed mode.
 */
function createDistributedResponse(
	threadId: string,
	runId = "run-123",
): Response {
	return {
		ok: true,
		status: 202,
		headers: new Headers({ "Content-Type": "application/json" }),
		json: async () => ({
			thread_id: threadId,
			run_id: runId,
			distributed: true,
		}),
	} as unknown as Response;
}

describe("Distributed Stream Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.resetAllMocks();
	});

	describe("initiateStream", () => {
		it("should return SyncStreamSource on 200 response", async () => {
			const mockResponse = createStreamResponse([
				'data: ["metadata",{"thread_id":"sync-123","assistant_id":null,"project_id":null}]',
				"data: [DONE]",
			]);
			mockFetch.mockResolvedValue(mockResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const source = await initiateStream(payload);

			expect(source).toBeInstanceOf(SyncStreamSource);
		});

		it("should return DistributedStreamSource on 202 response", async () => {
			const mockResponse = createDistributedResponse("dist-123");
			mockFetch.mockResolvedValue(mockResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const source = await initiateStream(payload);

			expect(source).toBeInstanceOf(DistributedStreamSource);
		});

		it("should throw on 401 response", async () => {
			const mockResponse = {
				ok: false,
				status: 401,
			} as Response;
			mockFetch.mockResolvedValue(mockResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			await expect(initiateStream(payload)).rejects.toThrow(
				"Authentication required",
			);
		});

		it("should throw on 429 response", async () => {
			const mockResponse = {
				ok: false,
				status: 429,
			} as Response;
			mockFetch.mockResolvedValue(mockResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			await expect(initiateStream(payload)).rejects.toThrow(
				"Rate limit exceeded",
			);
		});

		it("should include thread_id in metadata for multi-turn", async () => {
			const mockResponse = createDistributedResponse("dist-123");
			mockFetch.mockResolvedValue(mockResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: { thread_id: "existing-thread-123" },
			};

			await initiateStream(payload);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://test-api.com/llm/stream",
				expect.objectContaining({
					body: expect.stringContaining("existing-thread-123"),
				}),
			);
		});
	});

	describe("Full distributed flow", () => {
		it("should process events correctly in distributed mode", async () => {
			// First call: POST returns 202 with thread_id
			const postResponse = createDistributedResponse("flow-123");

			// Second call: GET returns SSE stream
			const getResponse = createStreamResponse([
				'data: ["metadata",{"thread_id":"flow-123","assistant_id":null,"project_id":null}]',
				'data: ["messages",[{"content":"Hello","type":"AIMessageChunk"},{"thread_id":"flow-123"}]]',
				'data: ["values",{"messages":[{"content":"Hello","type":"ai"}]}]',
				"data: [DONE]",
			]);

			mockFetch
				.mockResolvedValueOnce(postResponse)
				.mockResolvedValueOnce(getResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const source = await initiateStream(payload);
			const events: StreamEvent[] = [];

			source.onEvent((event) => events.push(event));
			await source.start();

			expect(events).toHaveLength(4);
			expect(events[0].type).toBe("metadata");
			expect(events[1].type).toBe("messages");
			expect(events[2].type).toBe("values");
			expect(events[3].type).toBe("done");

			// Verify thread_id in metadata
			if (events[0].type === "metadata") {
				expect(events[0].data.thread_id).toBe("flow-123");
			}
		});

		it("should handle error events in stream", async () => {
			const postResponse = createDistributedResponse("error-123");
			const getResponse = createStreamResponse([
				'data: ["error",{"error":"Something went wrong"}]',
				"data: [DONE]",
			]);

			mockFetch
				.mockResolvedValueOnce(postResponse)
				.mockResolvedValueOnce(getResponse);

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const source = await initiateStream(payload);
			const events: StreamEvent[] = [];

			source.onEvent((event) => events.push(event));
			await source.start();

			expect(events).toHaveLength(2);
			expect(events[0].type).toBe("error");
			if (events[0].type === "error") {
				expect(events[0].data.error).toBe("Something went wrong");
			}
		});
	});

	describe("Multi-turn with thread_id preservation", () => {
		it("should work with thread_id across multiple turns", async () => {
			// Turn 1: New conversation
			const turn1Response = createDistributedResponse("multi-turn-123");
			const turn1Stream = createStreamResponse([
				'data: ["metadata",{"thread_id":"multi-turn-123","assistant_id":null,"project_id":null}]',
				"data: [DONE]",
			]);

			mockFetch
				.mockResolvedValueOnce(turn1Response)
				.mockResolvedValueOnce(turn1Stream);

			const turn1Payload = {
				input: {
					messages: [{ role: "user" as const, content: "My name is Alice" }],
				},
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const turn1Source = await initiateStream(turn1Payload);
			const turn1Events: StreamEvent[] = [];
			turn1Source.onEvent((event) => turn1Events.push(event));
			await turn1Source.start();

			// Extract thread_id from metadata event
			let threadId = "";
			if (turn1Events[0].type === "metadata") {
				threadId = turn1Events[0].data.thread_id;
			}
			expect(threadId).toBe("multi-turn-123");

			// Turn 2: Follow-up with thread_id
			const turn2Response = createDistributedResponse("multi-turn-123");
			const turn2Stream = createStreamResponse([
				'data: ["metadata",{"thread_id":"multi-turn-123","assistant_id":null,"project_id":null}]',
				"data: [DONE]",
			]);

			mockFetch
				.mockResolvedValueOnce(turn2Response)
				.mockResolvedValueOnce(turn2Stream);

			const turn2Payload = {
				input: {
					messages: [{ role: "user" as const, content: "What is my name?" }],
				},
				model: "openai:gpt-4.1-mini",
				metadata: { thread_id: threadId }, // Include thread_id
			};

			await initiateStream(turn2Payload);

			// Verify turn 2 POST includes thread_id
			const turn2Call = mockFetch.mock.calls[2];
			expect(turn2Call[1].body).toContain("multi-turn-123");
		});
	});

	describe("Error recovery", () => {
		it("should report network errors to error handler", async () => {
			vi.useFakeTimers();
			const postResponse = createDistributedResponse("error-123");

			// POST succeeds, GET fails
			mockFetch
				.mockResolvedValueOnce(postResponse)
				.mockRejectedValue(new Error("Failed to fetch"));

			const payload = {
				input: { messages: [{ role: "user" as const, content: "Hello" }] },
				model: "openai:gpt-4.1-mini",
				metadata: {},
			};

			const source = await initiateStream(payload);
			const errors: Error[] = [];

			source.onError((error) => errors.push(error));
			const startPromise = source.start();
			await vi.runAllTimersAsync();
			await startPromise;

			// Error should be reported
			expect(errors).toHaveLength(1);
		});
	});
});
