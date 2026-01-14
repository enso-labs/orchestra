import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FetchStreamReader, ResponseBodyReader } from "@/lib/utils/fetchStreamReader";

// Mock fetch globally
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
 * Creates a mock Response with a ReadableStream body.
 */
function createMockResponse(
	lines: string[],
	status = 200,
): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		body: createMockStream(lines),
	} as Response;
}

describe("FetchStreamReader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should parse valid SSE events", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
			'data: ["messages",[{"content":"Hello"},{"thread_id":"test-123"}]]',
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: any[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({
			type: "metadata",
			data: { thread_id: "test-123", assistant_id: null, project_id: null },
		});
		expect(events[1]).toEqual({
			type: "messages",
			data: [{ content: "Hello" }, { thread_id: "test-123" }],
		});
	});

	it("should handle [DONE] signal", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
			"data: [DONE]",
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: any[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toHaveLength(2);
		expect(events[1]).toEqual({ type: "done" });
	});

	it("should skip keep-alive comments", async () => {
		const mockResponse = createMockResponse([
			": keep-alive",
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
			": keep-alive",
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: any[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("metadata");
	});

	it("should handle network errors", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		const errors: Error[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onError((error) => errors.push(error));

		await reader.start();

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe("Network error");
	});

	it("should handle non-OK response status", async () => {
		const mockResponse = {
			ok: false,
			status: 500,
			body: null,
		} as Response;
		mockFetch.mockResolvedValue(mockResponse);

		const errors: Error[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onError((error) => errors.push(error));

		await reader.start();

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe("Stream failed: 500");
	});

	it("should skip malformed JSON", async () => {
		const mockResponse = createMockResponse([
			"data: not valid json",
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: any[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onEvent((event) => events.push(event));

		await reader.start();

		// Should only have the valid event
		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("metadata");
	});

	it("should call close handler when stream ends", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
		]);
		mockFetch.mockResolvedValue(mockResponse);

		let closed = false;
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onClose(() => {
			closed = true;
		});

		await reader.start();

		expect(closed).toBe(true);
	});

	it("should include custom headers in request", async () => {
		const mockResponse = createMockResponse([]);
		mockFetch.mockResolvedValue(mockResponse);

		const reader = new FetchStreamReader("http://test.com/stream", {
			headers: { Authorization: "Bearer test-token" },
		});

		await reader.start();

		expect(mockFetch).toHaveBeenCalledWith(
			"http://test.com/stream",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-token",
					Accept: "text/event-stream",
				}),
			}),
		);
	});

	it("should parse all event types", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
			'data: ["messages",[{"content":"Hello"},{"thread_id":"test-123"}]]',
			'data: ["values",{"messages":[]}]',
			'data: ["error",{"error":"Something went wrong"}]',
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: any[] = [];
		const reader = new FetchStreamReader("http://test.com/stream");
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toHaveLength(4);
		expect(events[0].type).toBe("metadata");
		expect(events[1].type).toBe("messages");
		expect(events[2].type).toBe("values");
		expect(events[3].type).toBe("error");
		expect(events[3].data.error).toBe("Something went wrong");
	});
});

describe("ResponseBodyReader", () => {
	it("should read from existing response body", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"test-123","assistant_id":null,"project_id":null}]',
			"data: [DONE]",
		]);

		const events: any[] = [];
		const reader = new ResponseBodyReader(mockResponse);
		reader.onEvent((event) => events.push(event));

		await reader.start();

		expect(events).toHaveLength(2);
		expect(events[0].type).toBe("metadata");
		expect(events[1].type).toBe("done");
	});

	it("should handle response without body", async () => {
		const mockResponse = { body: null } as Response;

		const errors: Error[] = [];
		const reader = new ResponseBodyReader(mockResponse);
		reader.onError((error) => errors.push(error));

		await reader.start();

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe("No response body");
	});
});
