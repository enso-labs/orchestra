import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
 * Creates a mock Response with a ReadableStream body.
 */
function createMockResponse(lines: string[], status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		body: createMockStream(lines),
	} as Response;
}

describe("SyncStreamSource", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should read events from response body", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"sync-123","assistant_id":null,"project_id":null}]',
			'data: ["messages",[{"content":"Hello sync"},{"thread_id":"sync-123"}]]',
			"data: [DONE]",
		]);

		const events: StreamEvent[] = [];
		const source = new SyncStreamSource(mockResponse);
		source.onEvent((event) => events.push(event));

		await source.start();

		expect(events).toHaveLength(3);
		expect(events[0].type).toBe("metadata");
		expect(events[1].type).toBe("messages");
		expect(events[2].type).toBe("done");
	});

	it("should call error handler on failure", async () => {
		const mockResponse = { body: null } as Response;

		const errors: Error[] = [];
		const source = new SyncStreamSource(mockResponse);
		source.onError((error) => errors.push(error));

		await source.start();

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe("No response body");
	});

	it("should call close handler when stream ends", async () => {
		const mockResponse = createMockResponse(["data: [DONE]"]);

		let closed = false;
		const source = new SyncStreamSource(mockResponse);
		source.onClose(() => {
			closed = true;
		});

		await source.start();

		expect(closed).toBe(true);
	});
});

describe("DistributedStreamSource", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("should poll GET endpoint with correct URL", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"dist-123","assistant_id":null,"project_id":null}]',
			"data: [DONE]",
		]);
		mockFetch.mockResolvedValue(mockResponse);

		// Skip initial delay for faster tests
		const source = new DistributedStreamSource("dist-123", {
			skipInitialDelay: true,
		});

		await source.start();

		// Verify the URL is correct
		expect(mockFetch).toHaveBeenCalledWith(
			"http://test-api.com/threads/dist-123/stream",
			expect.objectContaining({
				method: "GET",
			}),
		);
		// Verify headers include Accept
		const callArgs = mockFetch.mock.calls[0][1];
		expect(callArgs.headers.Accept).toBe("text/event-stream");
	});

	it("should emit events from GET endpoint", async () => {
		const mockResponse = createMockResponse([
			'data: ["metadata",{"thread_id":"dist-123","assistant_id":null,"project_id":null}]',
			'data: ["messages",[{"content":"Hello distributed"},{"thread_id":"dist-123"}]]',
			'data: ["values",{"messages":[]}]',
			"data: [DONE]",
		]);
		mockFetch.mockResolvedValue(mockResponse);

		const events: StreamEvent[] = [];
		const source = new DistributedStreamSource("dist-123", {
			skipInitialDelay: true,
		});
		source.onEvent((event) => events.push(event));

		await source.start();

		expect(events).toHaveLength(4);
		expect(events[0].type).toBe("metadata");
		expect(events[1].type).toBe("messages");
		expect(events[2].type).toBe("values");
		expect(events[3].type).toBe("done");
	});

	it("should implement same interface as SyncStreamSource", () => {
		const syncSource = new SyncStreamSource(createMockResponse([]));
		const distSource = new DistributedStreamSource("test-123", {
			skipInitialDelay: true,
		});

		// Both should have the same methods
		expect(typeof syncSource.onEvent).toBe("function");
		expect(typeof syncSource.onError).toBe("function");
		expect(typeof syncSource.onClose).toBe("function");
		expect(typeof syncSource.start).toBe("function");
		expect(typeof syncSource.close).toBe("function");

		expect(typeof distSource.onEvent).toBe("function");
		expect(typeof distSource.onError).toBe("function");
		expect(typeof distSource.onClose).toBe("function");
		expect(typeof distSource.start).toBe("function");
		expect(typeof distSource.close).toBe("function");
	});

	it("should call error handler on network error", async () => {
		// Network error during fetch
		mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

		const errors: Error[] = [];
		const source = new DistributedStreamSource("error-123", {
			skipInitialDelay: true,
		});
		source.onError((error) => errors.push(error));

		await source.start();

		// Error handler should be called
		expect(errors).toHaveLength(1);
		// Error is passed through (classification happens at the point of classification)
		expect(errors[0]).toBeInstanceOf(Error);
	});

	it("should call error handler on stream failure", async () => {
		// Server error response
		const mockResponse = {
			ok: false,
			status: 500,
			body: null,
		} as Response;
		mockFetch.mockResolvedValue(mockResponse);

		const errors: Error[] = [];
		const source = new DistributedStreamSource("fail-123", {
			skipInitialDelay: true,
		});
		source.onError((error) => errors.push(error));

		await source.start();

		// Error handler should be called
		expect(errors).toHaveLength(1);
	});

	it("should not retry on non-retryable errors", async () => {
		const mockResponse = {
			ok: false,
			status: 401,
			body: null,
		} as Response;
		mockFetch.mockResolvedValue(mockResponse);

		const errors: Error[] = [];
		const source = new DistributedStreamSource("auth-fail-123", {
			skipInitialDelay: true,
		});
		source.onError((error) => errors.push(error));

		await source.start();

		// Should not retry auth errors
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(errors).toHaveLength(1);
	});
});
