import type { Config } from "./config.js";

// --- StreamEvent types matching backend SSE output ---

export type MetadataEvent = {
  type: "metadata";
  data: { thread_id?: string; assistant_id?: string | null; project_id?: string | null };
};

export type MessagesEvent = {
  type: "messages";
  data: unknown[];
};

export type ValuesEvent = {
  type: "values";
  data: Record<string, unknown>;
};

export type ErrorEvent = {
  type: "error";
  data: string;
};

export type DoneEvent = {
  type: "done";
};

export type StreamEvent =
  | MetadataEvent
  | MessagesEvent
  | ValuesEvent
  | ErrorEvent
  | DoneEvent;

// --- Error class for stream connection failures ---

export class StreamConnectionError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "StreamConnectionError";
  }
}

// --- Request types ---

export interface StreamChatRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  system_prompt?: string;
  tools?: string[];
  metadata?: {
    thread_id?: string;
    user_id?: string;
    assistant_id?: string;
    project_id?: string;
    graph_id?: string;
  };
}

// --- SSE parser ---

function parseSSEEvent(line: string): StreamEvent | null {
  // Strip "data: " prefix
  const data = line.slice(6);

  // Handle [DONE] sentinel
  if (data === "[DONE]") {
    return { type: "done" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 1) {
    return null;
  }

  const [eventType, eventData] = parsed;

  switch (eventType) {
    case "metadata":
      return { type: "metadata", data: eventData ?? {} };
    case "messages":
      return { type: "messages", data: eventData ?? [] };
    case "values":
      return { type: "values", data: eventData ?? {} };
    case "error":
      return { type: "error", data: String(eventData ?? "Unknown error") };
    default:
      return null;
  }
}

// --- Main streaming function ---

export async function* streamChat(
  request: StreamChatRequest,
  config: Config,
): AsyncGenerator<StreamEvent> {
  const url = `${config.apiUrl}/api/llm/stream`;

  // Pure LLM mode: ALWAYS send tools: [] so the backend acts as a pure inference
  // layer (text in, text out). All tools are described in the system_prompt and
  // dispatched locally by the agent loop. This prevents the backend from running
  // its own LangGraph agent loop with server-side tool execution.
  const body = {
    input: { messages: request.messages },
    model: request.model,
    system_prompt: request.system_prompt,
    tools: [],
    metadata: request.metadata ?? {},
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new StreamConnectionError(
      0,
      `Network error connecting to ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new StreamConnectionError(
      response.status,
      `HTTP ${response.status}: ${text || response.statusText}`,
    );
  }

  if (!response.body) {
    throw new StreamConnectionError(0, "Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines from buffer
      const lines = buffer.split("\n");
      // Keep the last incomplete line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and SSE comments (keep-alive)
        if (!trimmed || trimmed.startsWith(":")) continue;

        // Only process "data:" lines
        if (!trimmed.startsWith("data: ")) continue;

        const event = parseSSEEvent(trimmed);
        if (event) {
          yield event;
          if (event.type === "done") return;
        }
      }
    }

    // Process any remaining data in buffer
    const trimmed = buffer.trim();
    if (trimmed && trimmed.startsWith("data: ")) {
      const event = parseSSEEvent(trimmed);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
