import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent, MaxIterationsError, StructuredOutputError } from "./agent.js";
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

    it("executes all tools locally in pure LLM mode (no server-delegated tools)", async () => {
      // All tools are local in pure LLM mode
      registerTool(
        {
          name: "web_search",
          description: "Search the web",
          parameters: z.object({ query: z.string() }),
          local: true,
        },
        async () => ({ results: [{ title: "Found it" }], simulated: true }),
      );

      // Turn 1: LLM returns tool call — web_search executed locally
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
        // Turn 2: LLM returns final result after seeing tool results
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
      // Both turns executed — tool was dispatched locally
      expect(mockStreamChat).toHaveBeenCalledTimes(2);

      // Verify tool result message was passed to second call
      const secondCallMessages = mockStreamChat.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages.find(
        (m: { role: string; content: string }) => m.role === "tool",
      );
      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.content).toContain("web_search");
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
      // Use tool calls to consume iterations without triggering non-JSON retries
      registerTool(
        {
          name: "dummy_tool",
          description: "Dummy",
          parameters: z.object({ x: z.string() }),
          local: true,
        },
        async () => ({ done: true }),
      );

      mockStreamChat.mockImplementation(() =>
        mockStream([
          {
            type: "messages",
            data: [
              {
                content: "",
                tool_calls: [{ id: "tc-d", name: "dummy_tool", args: { x: "val" } }],
              },
            ],
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

    it("does not include tools in request (pure LLM mode — tools:[] always)", async () => {
      registerTool(
        {
          name: "web_search",
          description: "Search",
          parameters: z.object({ query: z.string() }),
          local: true,
        },
        async () => ({ results: [], simulated: true }),
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
      // Pure LLM mode: no tools sent to backend
      expect(request.tools).toBeUndefined();
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

  describe("non-JSON retry with nudge (US-023)", () => {
    it("retries non-JSON response and succeeds on 2nd attempt", async () => {
      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: plain text (not JSON)
          return mockStream([
            { type: "messages", data: [{ content: "I found some interesting results about AI..." }] },
            { type: "done" },
          ]);
        }
        // Second call: valid JSON after nudge
        return mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]);
      });

      const result = await runAgent("test topic", makeConfig({ maxIterations: 10 }));
      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(2);
    });

    it("throws StructuredOutputError after exhausting retries", async () => {
      // All responses are plain text
      mockStreamChat.mockImplementation(() =>
        mockStream([
          { type: "messages", data: [{ content: "Still thinking about this topic..." }] },
          { type: "done" },
        ]),
      );

      await expect(
        runAgent("test topic", makeConfig({ maxIterations: 10 })),
      ).rejects.toThrow(StructuredOutputError);
    });

    it("preserves rawText on StructuredOutputError", async () => {
      const plainText = "This is not JSON at all, just plain text.";
      mockStreamChat.mockImplementation(() =>
        mockStream([
          { type: "messages", data: [{ content: plainText }] },
          { type: "done" },
        ]),
      );

      try {
        await runAgent("test topic", makeConfig({ maxIterations: 10 }));
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(StructuredOutputError);
        expect((err as StructuredOutputError).rawText).toBe(plainText);
      }
    });

    it("nudge message is present in state.messages after non-JSON response", async () => {
      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            { type: "messages", data: [{ content: "Just some plain text." }] },
            { type: "done" },
          ]);
        }
        return mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]);
      });

      await runAgent("test topic", makeConfig({ maxIterations: 10 }));

      // The second streamChat call should include the nudge user message
      const secondCallMessages = mockStreamChat.mock.calls[1][0].messages;
      const nudgeMsg = secondCallMessages.find(
        (m: { role: string; content: string }) =>
          m.role === "user" && m.content.includes("not valid JSON"),
      );
      expect(nudgeMsg).toBeDefined();
      expect(nudgeMsg.content).toContain("JSON object");
      expect(nudgeMsg.content).toContain("title");
      expect(nudgeMsg.content).toContain("summary");
    });

    it("resets nonJsonRetries counter after a successful tool call turn", async () => {
      // Register a local tool
      registerTool(
        {
          name: "test_note",
          description: "Take note",
          parameters: z.object({ note: z.string() }),
          local: true,
        },
        async () => ({ success: true, note_count: 1 }),
      );

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Turn 1: plain text (nonJsonRetries becomes 1)
          return mockStream([
            { type: "messages", data: [{ content: "Let me think..." }] },
            { type: "done" },
          ]);
        }
        if (callCount === 2) {
          // Turn 2: plain text (nonJsonRetries becomes 2)
          return mockStream([
            { type: "messages", data: [{ content: "Still thinking..." }] },
            { type: "done" },
          ]);
        }
        if (callCount === 3) {
          // Turn 3: tool call — resets nonJsonRetries to 0
          return mockStream([
            {
              type: "messages",
              data: [
                {
                  content: "",
                  tool_calls: [{ id: "tc-1", name: "test_note", args: { note: "found it" } }],
                },
              ],
            },
            { type: "done" },
          ]);
        }
        if (callCount === 4) {
          // Turn 4: plain text again (nonJsonRetries becomes 1, not 3 — was reset)
          return mockStream([
            { type: "messages", data: [{ content: "More thinking..." }] },
            { type: "done" },
          ]);
        }
        if (callCount === 5) {
          // Turn 5: valid JSON
          return mockStream([
            { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
            { type: "done" },
          ]);
        }
        return mockStream([{ type: "done" }]);
      });

      // If nonJsonRetries was NOT reset, it would throw StructuredOutputError at turn 4 (retry 3 > MAX 2)
      // Since it IS reset, it should succeed
      const result = await runAgent("test topic", makeConfig({ maxIterations: 15 }));
      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(5);
    });
  });

  describe("singleTurn mode (US-023)", () => {
    it("returns valid JSON in one shot", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]),
      );

      const result = await runAgent("test topic", makeConfig(), { singleTurn: true });
      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
    });

    it("throws StructuredOutputError on non-JSON with no retry", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: "Here is some prose about the topic." }] },
          { type: "done" },
        ]),
      );

      await expect(
        runAgent("test topic", makeConfig(), { singleTurn: true }),
      ).rejects.toThrow(StructuredOutputError);

      // Only one call — no retries
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
    });

    it("rawText preserved on singleTurn StructuredOutputError", async () => {
      const plainText = "This is not JSON.";
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: plainText }] },
          { type: "done" },
        ]),
      );

      try {
        await runAgent("test topic", makeConfig(), { singleTurn: true });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(StructuredOutputError);
        expect((err as StructuredOutputError).rawText).toBe(plainText);
      }
    });
  });

  describe("empty assistantText fallthrough (US-027)", () => {
    it("throws StructuredOutputError immediately when assistantText is empty and no tool calls", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: "" }] },
          { type: "done" },
        ]),
      );

      try {
        await runAgent("test topic", makeConfig({ maxIterations: 5 }));
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(StructuredOutputError);
        expect((err as StructuredOutputError).rawText).toBe("");
      }

      // Only one call — no silent continuation
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
    });

    it("throws StructuredOutputError when stream yields no content at all", async () => {
      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "metadata", data: { thread_id: "t-1" } },
          { type: "done" },
        ]),
      );

      await expect(
        runAgent("test topic", makeConfig({ maxIterations: 5 })),
      ).rejects.toThrow(StructuredOutputError);

      expect(mockStreamChat).toHaveBeenCalledTimes(1);
    });
  });

  describe("MaxIterationsError uses effectiveMaxIterations (US-027)", () => {
    it("singleTurn MaxIterationsError reports 1, not config.maxIterations", async () => {
      // Register a tool so the iteration consumes via tool calls (not empty text)
      registerTool(
        {
          name: "dummy_tool",
          description: "Dummy",
          parameters: z.object({ x: z.string() }),
          local: true,
        },
        async () => ({ done: true }),
      );

      mockStreamChat.mockReturnValue(
        mockStream([
          {
            type: "messages",
            data: [
              {
                content: "",
                tool_calls: [{ id: "tc-d", name: "dummy_tool", args: { x: "val" } }],
              },
            ],
          },
          { type: "done" },
        ]),
      );

      try {
        await runAgent("test topic", makeConfig({ maxIterations: 100 }), { singleTurn: true });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MaxIterationsError);
        // Should say "1" (effectiveMaxIterations), NOT "100" (config.maxIterations)
        expect((err as Error).message).toContain("1");
        expect((err as Error).message).not.toContain("100");
      }
    });
  });

  describe("StructuredOutputError (US-023)", () => {
    it("is an instance of Error", () => {
      const err = new StructuredOutputError("some text");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("StructuredOutputError");
    });

    it("has rawText property", () => {
      const raw = "This is the LLM's raw response text.";
      const err = new StructuredOutputError(raw);
      expect(err.rawText).toBe(raw);
    });

    it("truncates long rawText in message", () => {
      const longText = "x".repeat(500);
      const err = new StructuredOutputError(longText);
      expect(err.message).toContain("...");
      expect(err.message.length).toBeLessThan(longText.length + 100);
    });
  });

  describe("pure LLM mode — tool calls from text (US-026)", () => {
    it("parses tool_calls from LLM text response", async () => {
      registerTool(
        {
          name: "web_search",
          description: "Search",
          parameters: z.object({ query: z.string() }),
          local: true,
        },
        async () => ({ results: [{ title: "Found it" }], simulated: true }),
      );

      const toolCallJson = JSON.stringify({
        tool_calls: [
          { id: "tc-text-1", name: "web_search", args: { query: "TypeScript" } },
        ],
      });

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // LLM outputs tool_calls as JSON text (pure LLM mode)
          return mockStream([
            { type: "messages", data: [{ content: toolCallJson }] },
            { type: "done" },
          ]);
        }
        return mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]);
      });

      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(2);

      // Verify tool result was passed back
      const secondCallMessages = mockStreamChat.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages.find(
        (m: { role: string; content: string }) => m.role === "tool",
      );
      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.content).toContain("web_search");
    });

    it("assigns generated IDs when tool_calls in text have no id field", async () => {
      registerTool(
        {
          name: "note_taker",
          description: "Take note",
          parameters: z.object({ note: z.string() }),
          local: true,
        },
        async () => ({ success: true, note_count: 1 }),
      );

      const toolCallJson = JSON.stringify({
        tool_calls: [
          { name: "note_taker", args: { note: "A finding" } },
        ],
      });

      let callCount = 0;
      mockStreamChat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockStream([
            { type: "messages", data: [{ content: toolCallJson }] },
            { type: "done" },
          ]);
        }
        return mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]);
      });

      const result = await runAgent("test topic", makeConfig());
      expect(result).toEqual(validResearchResult);
      expect(mockStreamChat).toHaveBeenCalledTimes(2);
    });

    it("does not send tools in API request (pure LLM mode)", async () => {
      registerTool(
        {
          name: "web_search",
          description: "Search",
          parameters: z.object({ query: z.string() }),
          local: true,
        },
        async () => ({ results: [], simulated: true }),
      );

      mockStreamChat.mockReturnValue(
        mockStream([
          { type: "messages", data: [{ content: JSON.stringify(validResearchResult) }] },
          { type: "done" },
        ]),
      );

      await runAgent("test", makeConfig());

      const request = mockStreamChat.mock.calls[0][0];
      // Pure LLM mode: tools never sent to backend
      expect(request.tools).toBeUndefined();
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

    it("exports StructuredOutputError class", () => {
      const err = new StructuredOutputError("test");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("StructuredOutputError");
      expect(err.rawText).toBe("test");
    });
  });
});
