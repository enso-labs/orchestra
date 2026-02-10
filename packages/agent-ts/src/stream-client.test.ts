import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamChat, StreamConnectionError } from "./stream-client.js";
import type { Config } from "./config.js";
import type { StreamEvent } from "./stream-client.js";

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    apiUrl: "http://localhost:8000",
    apiKey: "test-key",
    model: "openai:gpt-4.1-mini",
    logLevel: "info",
    outputDir: "./output",
    maxIterations: 15,
    ...overrides,
  };
}

/** Create a ReadableStream from SSE lines */
function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(lines.join("\n") + "\n");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

/** Create a mock Response with a ReadableStream body */
function mockResponse(lines: string[], status = 200): Response {
  return new Response(sseStream(lines), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function collectEvents(
  config: Config,
  messages: Array<{ role: string; content: string }> = [{ role: "user", content: "hello" }],
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of streamChat({ messages, model: config.model }, config)) {
    events.push(event);
  }
  return events;
}

describe("streamChat", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses metadata event", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["metadata", {"thread_id": "abc-123"}]',
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "metadata",
      data: { thread_id: "abc-123" },
    });
  });

  it("parses messages event", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["messages", [{"content": "Hello!", "type": "ai"}]]',
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("messages");
    if (events[0]!.type === "messages") {
      expect(events[0]!.data).toEqual([{ content: "Hello!", type: "ai" }]);
    }
  });

  it("parses values event", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["values", {"messages": [], "files": {}}]',
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "values",
      data: { messages: [], files: {} },
    });
  });

  it("parses error event", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["error", "Something went wrong"]',
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      data: "Something went wrong",
    });
  });

  it("parses [DONE] sentinel", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["metadata", {"thread_id": "t1"}]',
        "",
        "data: [DONE]",
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: "done" });
  });

  it("parses a full streaming session with multiple events", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        'data: ["metadata", {"thread_id": "thread-1"}]',
        "",
        'data: ["messages", [{"content": "Researching...", "type": "ai"}]]',
        "",
        'data: ["values", {"messages": [{"role": "assistant", "content": "Done"}]}]',
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(3);
    expect(events[0]!.type).toBe("metadata");
    expect(events[1]!.type).toBe("messages");
    expect(events[2]!.type).toBe("values");
  });

  it("skips SSE comments (keep-alive)", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        ": keep-alive",
        "",
        'data: ["metadata", {"thread_id": "t1"}]',
        "",
        ": keep-alive",
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("metadata");
  });

  it("skips malformed SSE data lines", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      mockResponse([
        "data: not-valid-json",
        "",
        'data: ["metadata", {"thread_id": "t1"}]',
        "",
        "data: {}", // valid JSON but not an array
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("metadata");
  });

  it("preserves thread_id from metadata event", async () => {
    const config = makeConfig();
    const threadId = "abc-def-123";
    fetchSpy.mockResolvedValue(
      mockResponse([
        `data: ["metadata", {"thread_id": "${threadId}"}]`,
        "",
      ]),
    );

    const events = await collectEvents(config);
    expect(events[0]!.type).toBe("metadata");
    if (events[0]!.type === "metadata") {
      expect(events[0]!.data.thread_id).toBe(threadId);
    }
  });

  it("sends correct request headers and body", async () => {
    const config = makeConfig({ apiKey: "my-secret-key" });
    fetchSpy.mockResolvedValue(mockResponse([]));

    await collectEvents(config);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("http://localhost:8000/api/llm/stream");
    expect(init!.method).toBe("POST");
    expect(init!.headers).toEqual({
      "Content-Type": "application/json",
      "x-api-key": "my-secret-key",
    });

    const body = JSON.parse(init!.body as string);
    expect(body.input.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.model).toBe("openai:gpt-4.1-mini");
    expect(body.tools).toEqual([]);
    expect(body.metadata).toEqual({});
  });

  it("always sends tools: [] regardless of request.tools (pure LLM mode)", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(mockResponse([]));

    const events: StreamEvent[] = [];
    for await (const event of streamChat(
      {
        messages: [{ role: "user", content: "search" }],
        model: "openai:gpt-4o",
        tools: ["web_search", "note_taker"],
        metadata: { thread_id: "existing-thread" },
      },
      config,
    )) {
      events.push(event);
    }

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    // Pure LLM mode: tools always [] — backend must not run its own agent loop
    expect(body.tools).toEqual([]);
    expect(body.metadata.thread_id).toBe("existing-thread");
    expect(body.model).toBe("openai:gpt-4o");
  });
});

describe("StreamConnectionError", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on HTTP 401", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      new Response("Invalid API Key", { status: 401, statusText: "Unauthorized" }),
    );

    await expect(collectEvents(config)).rejects.toThrow(StreamConnectionError);
    await expect(collectEvents(config)).rejects.toThrow("HTTP 401");
  });

  it("throws on HTTP 500", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(collectEvents(config)).rejects.toThrow(StreamConnectionError);
    await expect(collectEvents(config)).rejects.toThrow("HTTP 500");
  });

  it("includes status code on error", async () => {
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
    );

    try {
      await collectEvents(config);
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamConnectionError);
      expect((err as StreamConnectionError).statusCode).toBe(400);
    }
  });

  it("throws on network failure", async () => {
    const config = makeConfig();
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(collectEvents(config)).rejects.toThrow(StreamConnectionError);
    await expect(collectEvents(config)).rejects.toThrow("Network error");
  });

  it("has correct error name", () => {
    const err = new StreamConnectionError(401, "Unauthorized");
    expect(err.name).toBe("StreamConnectionError");
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });
});
