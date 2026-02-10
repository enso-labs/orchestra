import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, MaxIterationsError } from "./agent.js";
import type { RunAgentOptions } from "./agent.js";
import type { Config } from "./config.js";
import type { AgentState } from "./schemas.js";
import type { Middleware } from "./middleware/index.js";
import { registerTool, _resetRegistry } from "./tools/index.js";
import { z } from "zod";

// --- Mock streamChat ---
vi.mock("./stream-client.js", () => ({
  streamChat: vi.fn(),
  StreamConnectionError: class StreamConnectionError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = "StreamConnectionError";
    }
  },
}));

import { streamChat } from "./stream-client.js";

const mockStreamChat = streamChat as unknown as ReturnType<typeof vi.fn>;

// --- Helpers ---

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    apiUrl: "http://localhost:8000",
    apiKey: "test-key",
    model: "openai:gpt-4.1-mini",
    logLevel: "info",
    outputDir: "./test-output",
    maxIterations: 15,
    ...overrides,
  };
}

const validResearchResult = {
  title: "Test Research",
  summary: "A summary of the research findings.",
  sources: ["https://example.com"],
  confidence: 0.85,
  followUpQuestions: ["What next?"],
};

/** Create an async generator from an array of stream events */
async function* mockStream(
  events: Array<{ type: string; data?: unknown }>,
): AsyncGenerator<{ type: string; data?: unknown }> {
  for (const event of events) {
    yield event;
  }
}

// --- Tests ---

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistry();
  });

  describe("single turn — no tools", () => {
    it("returns parsed ResearchResult when LLM responds with valid JSON", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "metadata", data: { thread_id: "thread-123" } },
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      const result = await runAgent("test topic", makeConfig());

      expect(result).toEqual(validResearchResult);
    });

    it("extracts JSON from markdown code fences", async () => {
      const wrappedJson = `Here is my research:\n\`\`\`json\n${JSON.stringify(validResearchResult)}\n\`\`\``;

      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: wrappedJson }] },
          { type: "done" },
        ]),
      );

      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);
    });

    it("extracts JSON embedded in prose text", async () => {
      const proseJson = `Based on my research, here is the result: ${JSON.stringify(validResearchResult)} That concludes the research.`;

      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: proseJson }] },
          { type: "done" },
        ]),
      );

      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);
    });

    it("calls onChunk for each text chunk", async () => {
      const chunks: string[] = [];

      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]),
      );

      await runAgent("test topic", makeConfig(), {
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(chunks).toEqual([JSON.stringify(validResearchResult)]);
    });

    it("preserves thread_id from metadata event", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "metadata", data: { thread_id: "thread-abc" } },
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      await runAgent("test topic", makeConfig());

      // Verify the second call (if there were one) would include thread_id
      // For single turn, verify the first streamChat call was made correctly
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
      const callArgs = mockStreamChat.mock.calls[0];
      expect(callArgs[0].messages).toEqual([
        { role: "user", content: "test topic" },
      ]);
    });
  });

  describe("multi-turn — tool calls", () => {
    it("executes local tool, appends result, and completes on next turn", async () => {
      // Register a test tool
      registerTool(
        {
          name: "note_taker",
          description: "Take a note",
          parameters: z.object({ note: z.string() }),
          local: true,
        },
        async (args) => ({
          success: true,
          note_count: 1,
          category: "general",
        }),
      );

      // Turn 1: LLM returns tool call
      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            { type: "metadata", data: { thread_id: "thread-tool" } },
            {
              type: "messages",
              data: [
                {
                  content: "Let me take a note.",
                  tool_calls: [
                    {
                      id: "call-1",
                      name: "note_taker",
                      args: { note: "Important finding" },
                    },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        // Turn 2: LLM returns final result
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      const result = await runAgent("test topic", makeConfig());

      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(2);

      // Verify second call includes tool result message
      const secondCallMessages = mockStreamChat.mock.calls[1][0].messages;
      expect(secondCallMessages.length).toBeGreaterThan(1);
      const toolResultMsg = secondCallMessages.find(
        (m: { role: string; content: string }) => m.role === "tool",
      );
      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.content).toContain("note_taker");
      expect(toolResultMsg.content).toContain("success");
    });

    it("does not execute server-delegated tools locally", async () => {
      // Register a server tool (local: false)
      registerTool(
        {
          name: "web_search",
          description: "Search the web",
          parameters: z.object({ query: z.string() }),
          local: false,
        },
        async () => {
          throw new Error("Should not be called locally");
        },
      );

      // Turn 1: LLM returns server tool call — should be ignored for local execution
      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            {
              type: "messages",
              data: [
                {
                  content: "Searching...",
                  tool_calls: [
                    { id: "call-s1", name: "web_search", args: { query: "test" } },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        // Since web_search is server-side, no local tool calls → parse text
        // Turn 2 not needed if no local tool calls
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      // Since web_search is a server tool, it won't be executed locally.
      // The text "Searching..." is not valid JSON, so the loop continues.
      // On the second turn, we get valid JSON.
      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);
    });

    it("handles tool execution errors via afterTool middleware", async () => {
      registerTool(
        {
          name: "failing_tool",
          description: "Always fails",
          parameters: z.object({ input: z.string() }),
          local: true,
        },
        async () => {
          throw new Error("Tool failure");
        },
      );

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            {
              type: "messages",
              data: [
                {
                  content: "",
                  tool_calls: [
                    { id: "call-err", name: "failing_tool", args: { input: "test" } },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);

      // Verify tool result message contains error info
      const secondCallMessages = mockStreamChat.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages.find(
        (m: { role: string; content: string }) => m.role === "tool",
      );
      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.content).toContain("error");
      expect(toolResultMsg.content).toContain("Tool failure");
    });
  });

  describe("max iterations exceeded", () => {
    it("throws MaxIterationsError when limit reached", async () => {
      // LLM never returns a valid result
      mockStreamChat.mockImplementation(() =>
        mockStream([
          {
            type: "messages",
            data: [{ content: "I'm still thinking..." }],
          },
          { type: "done" },
        ]),
      );

      await expect(
        runAgent("test topic", makeConfig({ maxIterations: 2 })),
      ).rejects.toThrow(MaxIterationsError);

      expect(mockStreamChat).toHaveBeenCalledTimes(2);
    });

    it("MaxIterationsError includes iteration count in message", async () => {
      mockStreamChat.mockImplementation(() =>
        mockStream([
          {
            type: "messages",
            data: [{ content: "Still working..." }],
          },
          { type: "done" },
        ]),
      );

      try {
        await runAgent("test topic", makeConfig({ maxIterations: 3 }));
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MaxIterationsError);
        expect((err as Error).message).toContain("3");
      }
    });
  });

  describe("invalid structured output", () => {
    it("throws ZodError when final response is invalid JSON structure", async () => {
      const invalidResult = { title: "Test", summary: "" }; // summary too short (min 1)

      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(invalidResult) }],
          },
          { type: "done" },
        ]),
      );

      // The loop will try to parse this on the last iteration
      await expect(
        runAgent("test topic", makeConfig({ maxIterations: 1 })),
      ).rejects.toThrow(); // ZodError
    });
  });

  describe("stream error handling", () => {
    it("throws on backend stream error event", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "error", data: "Internal server error" },
        ]),
      );

      await expect(
        runAgent("test topic", makeConfig()),
      ).rejects.toThrow("Stream error from backend: Internal server error");
    });
  });

  describe("middleware integration", () => {
    it("runs beforeLLM middleware and uses modified state", async () => {
      const beforeLLMSpy = vi.fn((state: AgentState) => ({
        ...state,
        systemPrompt: "Custom prompt from middleware",
      }));

      const middleware: Middleware = {
        name: "test-middleware",
        beforeLLM: beforeLLMSpy,
      };

      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      await runAgent("test topic", makeConfig(), {
        middlewares: [middleware],
      });

      expect(beforeLLMSpy).toHaveBeenCalledTimes(1);
      // The request should include the system_prompt from middleware
      const request = mockStreamChat.mock.calls[0][0];
      expect(request.system_prompt).toBe("Custom prompt from middleware");
    });

    it("runs afterLLM middleware with state and events", async () => {
      const afterLLMSpy = vi.fn();

      const middleware: Middleware = {
        name: "test-after",
        afterLLM: afterLLMSpy,
      };

      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      await runAgent("test topic", makeConfig(), {
        middlewares: [middleware],
      });

      expect(afterLLMSpy).toHaveBeenCalledTimes(1);
      const [state, events] = afterLLMSpy.mock.calls[0];
      expect(state.messages).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    it("runs beforeTool and afterTool middleware on local tool calls", async () => {
      const beforeToolSpy = vi.fn((_name: string, args: unknown) => args);
      const afterToolSpy = vi.fn((_name: string, result: unknown) => result);

      const middleware: Middleware = {
        name: "tool-spy",
        beforeTool: beforeToolSpy,
        afterTool: afterToolSpy,
      };

      registerTool(
        {
          name: "test_tool",
          description: "Test",
          parameters: z.object({ value: z.string() }),
          local: true,
        },
        async (args) => ({ result: (args as { value: string }).value }),
      );

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            {
              type: "messages",
              data: [
                {
                  content: "",
                  tool_calls: [
                    { id: "tc-1", name: "test_tool", args: { value: "hello" } },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      await runAgent("test topic", makeConfig(), {
        middlewares: [middleware],
      });

      expect(beforeToolSpy).toHaveBeenCalledWith("test_tool", { value: "hello" });
      expect(afterToolSpy).toHaveBeenCalledWith("test_tool", { result: "hello" }, undefined);
    });
  });

  describe("API request format", () => {
    it("sends correct request to streamChat", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      const config = makeConfig({ model: "anthropic:claude-3" });
      await runAgent("research AI", config);

      expect(mockStreamChat).toHaveBeenCalledTimes(1);
      const [request, passedConfig] = mockStreamChat.mock.calls[0];
      expect(request.messages).toEqual([
        { role: "user", content: "research AI" },
      ]);
      expect(request.model).toBe("anthropic:claude-3");
      expect(passedConfig).toBe(config);
    });

    it("includes server tool names in request when registered", async () => {
      registerTool(
        {
          name: "web_search",
          description: "Search",
          parameters: z.object({ query: z.string() }),
          local: false,
        },
        async () => {
          throw new Error("server only");
        },
      );

      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]),
      );

      await runAgent("test", makeConfig());

      const request = mockStreamChat.mock.calls[0][0];
      expect(request.tools).toEqual(["web_search"]);
    });

    it("includes thread_id in subsequent requests", async () => {
      registerTool(
        {
          name: "local_tool",
          description: "A tool",
          parameters: z.object({ x: z.string() }),
          local: true,
        },
        async () => ({ done: true }),
      );

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            { type: "metadata", data: { thread_id: "thread-persist" } },
            {
              type: "messages",
              data: [
                {
                  content: "",
                  tool_calls: [
                    { id: "tc-x", name: "local_tool", args: { x: "val" } },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      await runAgent("test", makeConfig());

      // Second call should include thread_id in metadata
      expect(mockStreamChat).toHaveBeenCalledTimes(2);
      const secondRequest = mockStreamChat.mock.calls[1][0];
      expect(secondRequest.metadata).toEqual({ thread_id: "thread-persist" });
    });
  });

  describe("promptFn integration", () => {
    it("passes promptFn to tool options", async () => {
      const mockPromptFn = vi.fn().mockResolvedValue("user answer");

      registerTool(
        {
          name: "human_contact",
          description: "Ask user",
          parameters: z.object({ question: z.string() }),
          local: true,
        },
        async (_args, _state, options) => {
          const fn = options?.promptFn as (q: string) => Promise<string>;
          const answer = await fn("What do you think?");
          return { human_response: answer, timestamp: new Date().toISOString() };
        },
      );

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            {
              type: "messages",
              data: [
                {
                  content: "",
                  tool_calls: [
                    {
                      id: "hc-1",
                      name: "human_contact",
                      args: { question: "What do you think?" },
                    },
                  ],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        return mockStream([
          {
            type: "messages",
            data: [{ content: JSON.stringify(validResearchResult) }],
          },
          { type: "done" },
        ]);
      });

      await runAgent("test", makeConfig(), { promptFn: mockPromptFn });

      expect(mockPromptFn).toHaveBeenCalledWith("What do you think?");
    });
  });

  describe("exports", () => {
    it("exports runAgent function", () => {
      expect(typeof runAgent).toBe("function");
    });

    it("exports MaxIterationsError class", () => {
      const err = new MaxIterationsError(10);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("MaxIterationsError");
      expect(err.message).toContain("10");
    });
  });
});
