import { describe, expect, it, vi, beforeEach } from "vitest";
import { createObservabilityMiddleware } from "./observability.js";
import type { Logger } from "../logger.js";
import type { AgentState } from "../schemas.js";
import type { StreamEvent } from "../stream-client.js";

function createMockLogger(): Logger & {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createTestState(overrides?: Partial<AgentState>): AgentState {
  return {
    messages: [{ role: "user", content: "hello" }],
    notes: [],
    sources: [],
    iteration: 0,
    ...overrides,
  };
}

describe("createObservabilityMiddleware", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it("returns middleware with name 'observability'", () => {
    const mw = createObservabilityMiddleware(logger);
    expect(mw.name).toBe("observability");
  });

  it("defines all four hooks", () => {
    const mw = createObservabilityMiddleware(logger);
    expect(mw.beforeLLM).toBeTypeOf("function");
    expect(mw.afterLLM).toBeTypeOf("function");
    expect(mw.beforeTool).toBeTypeOf("function");
    expect(mw.afterTool).toBeTypeOf("function");
  });

  describe("beforeLLM", () => {
    it("logs iteration and message count", () => {
      const mw = createObservabilityMiddleware(logger);
      const state = createTestState({ iteration: 3 });
      state.messages = [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ];

      mw.beforeLLM!(state);

      expect(logger.info).toHaveBeenCalledWith("LLM call starting", {
        iteration: 3,
        messageCount: 3,
      });
    });

    it("returns state unchanged", () => {
      const mw = createObservabilityMiddleware(logger);
      const state = createTestState();
      const result = mw.beforeLLM!(state);
      expect(result).toBe(state);
    });
  });

  describe("afterLLM", () => {
    it("logs duration, event count, and estimated tokens", () => {
      const mw = createObservabilityMiddleware(logger);
      const state = createTestState();

      // Call beforeLLM to set start time
      mw.beforeLLM!(state);

      const events: StreamEvent[] = [
        { type: "metadata", data: { thread_id: "t1" } },
        { type: "messages", data: [{ content: "hello world" }] },
        { type: "done" },
      ];

      mw.afterLLM!(state, events);

      expect(logger.info).toHaveBeenCalledWith(
        "LLM call completed",
        expect.objectContaining({
          durationMs: expect.any(Number),
          eventCount: 3,
          estimatedTokens: expect.any(Number),
        }),
      );
    });

    it("estimates tokens from messages events only", () => {
      const mw = createObservabilityMiddleware(logger);
      const state = createTestState();

      mw.beforeLLM!(state);

      const events: StreamEvent[] = [
        { type: "metadata", data: {} },
        { type: "messages", data: [{ content: "abc" }] },
      ];

      mw.afterLLM!(state, events);

      const call = logger.info.mock.calls.find(
        (c: unknown[]) => c[0] === "LLM call completed",
      );
      expect(call).toBeDefined();
      const meta = call![1] as Record<string, unknown>;
      // Only the messages event contributes to estimated tokens
      expect(meta.estimatedTokens).toBeGreaterThan(0);
    });
  });

  describe("beforeTool", () => {
    it("logs tool name and args summary", () => {
      const mw = createObservabilityMiddleware(logger);
      const args = { query: "test search" };

      mw.beforeTool!("web_search", args);

      expect(logger.debug).toHaveBeenCalledWith("Tool executing", {
        tool: "web_search",
        args: JSON.stringify(args),
      });
    });

    it("returns args unchanged", () => {
      const mw = createObservabilityMiddleware(logger);
      const args = { query: "test" };
      const result = mw.beforeTool!("web_search", args);
      expect(result).toBe(args);
    });

    it("truncates large args in log", () => {
      const mw = createObservabilityMiddleware(logger);
      const args = { content: "x".repeat(300) };

      mw.beforeTool!("file_writer", args);

      const call = logger.debug.mock.calls[0];
      const meta = call[1] as Record<string, unknown>;
      expect((meta.args as string).length).toBeLessThanOrEqual(203); // 200 + "..."
    });
  });

  describe("afterTool", () => {
    it("logs success with duration on no error", () => {
      const mw = createObservabilityMiddleware(logger);

      mw.beforeTool!("note_taker", {});
      const result = { success: true };
      mw.afterTool!("note_taker", result, undefined);

      expect(logger.debug).toHaveBeenCalledWith(
        "Tool succeeded",
        expect.objectContaining({
          tool: "note_taker",
          durationMs: expect.any(Number),
        }),
      );
    });

    it("logs failure with error message on error", () => {
      const mw = createObservabilityMiddleware(logger);

      mw.beforeTool!("file_writer", {});
      const error = new Error("path traversal");
      mw.afterTool!("file_writer", null, error);

      expect(logger.warn).toHaveBeenCalledWith(
        "Tool failed",
        expect.objectContaining({
          tool: "file_writer",
          durationMs: expect.any(Number),
          error: "path traversal",
        }),
      );
    });

    it("returns result unchanged", () => {
      const mw = createObservabilityMiddleware(logger);
      const result = { data: 42 };
      const output = mw.afterTool!("test", result, undefined);
      expect(output).toBe(result);
    });

    it("returns result unchanged even on error", () => {
      const mw = createObservabilityMiddleware(logger);
      const result = null;
      const error = new Error("fail");
      const output = mw.afterTool!("test", result, error);
      expect(output).toBe(result);
    });
  });
});
