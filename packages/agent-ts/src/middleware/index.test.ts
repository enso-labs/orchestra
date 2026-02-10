import { describe, it, expect, vi } from "vitest";
import type { Middleware } from "./index.js";
import {
  runBeforeLLM,
  runAfterLLM,
  runBeforeTool,
  runAfterTool,
} from "./index.js";
import type { AgentState } from "../schemas.js";
import type { StreamEvent } from "../stream-client.js";

function makeState(overrides?: Partial<AgentState>): AgentState {
  return {
    messages: [],
    notes: [],
    sources: [],
    iteration: 0,
    ...overrides,
  };
}

describe("Middleware type", () => {
  it("accepts middleware with all hooks", () => {
    const mw: Middleware = {
      name: "full",
      beforeLLM: (s) => s,
      afterLLM: () => {},
      beforeTool: (_name, args) => args,
      afterTool: (_name, result) => result,
    };
    expect(mw.name).toBe("full");
  });

  it("accepts middleware with no hooks (name only)", () => {
    const mw: Middleware = { name: "empty" };
    expect(mw.beforeLLM).toBeUndefined();
    expect(mw.afterLLM).toBeUndefined();
    expect(mw.beforeTool).toBeUndefined();
    expect(mw.afterTool).toBeUndefined();
  });
});

describe("runBeforeLLM", () => {
  it("runs each middleware's beforeLLM in order", async () => {
    const order: string[] = [];
    const mw1: Middleware = {
      name: "first",
      beforeLLM: (s) => {
        order.push("first");
        return { ...s, iteration: s.iteration + 1 };
      },
    };
    const mw2: Middleware = {
      name: "second",
      beforeLLM: (s) => {
        order.push("second");
        return { ...s, iteration: s.iteration + 10 };
      },
    };

    const state = makeState({ iteration: 0 });
    const result = await runBeforeLLM([mw1, mw2], state);

    expect(order).toEqual(["first", "second"]);
    expect(result.iteration).toBe(11); // 0 + 1 + 10
  });

  it("returns original state when no middlewares have beforeLLM", async () => {
    const mw: Middleware = { name: "noop" };
    const state = makeState({ iteration: 5 });
    const result = await runBeforeLLM([mw], state);
    expect(result.iteration).toBe(5);
  });

  it("state mutation by first beforeLLM propagates to second", async () => {
    const mw1: Middleware = {
      name: "mutator",
      beforeLLM: (s) => ({
        ...s,
        systemPrompt: "injected",
      }),
    };
    const mw2: Middleware = {
      name: "reader",
      beforeLLM: (s) => {
        expect(s.systemPrompt).toBe("injected");
        return s;
      },
    };

    const state = makeState();
    await runBeforeLLM([mw1, mw2], state);
  });

  it("handles empty middleware array", async () => {
    const state = makeState({ iteration: 3 });
    const result = await runBeforeLLM([], state);
    expect(result).toBe(state);
  });

  it("handles async beforeLLM", async () => {
    const mw: Middleware = {
      name: "async",
      beforeLLM: async (s) => {
        return { ...s, iteration: s.iteration + 1 };
      },
    };
    const state = makeState({ iteration: 0 });
    const result = await runBeforeLLM([mw], state);
    expect(result.iteration).toBe(1);
  });
});

describe("runAfterLLM", () => {
  it("runs each middleware's afterLLM in order", async () => {
    const order: string[] = [];
    const events: StreamEvent[] = [{ type: "done" }];

    const mw1: Middleware = {
      name: "first",
      afterLLM: () => {
        order.push("first");
      },
    };
    const mw2: Middleware = {
      name: "second",
      afterLLM: () => {
        order.push("second");
      },
    };

    const state = makeState();
    await runAfterLLM([mw1, mw2], state, events);
    expect(order).toEqual(["first", "second"]);
  });

  it("passes state and events to each hook", async () => {
    const events: StreamEvent[] = [
      { type: "messages", data: [{ content: "hello" }] },
      { type: "done" },
    ];
    const state = makeState({ iteration: 3 });
    const spy = vi.fn();

    const mw: Middleware = {
      name: "spy",
      afterLLM: spy,
    };

    await runAfterLLM([mw], state, events);
    expect(spy).toHaveBeenCalledWith(state, events);
  });

  it("skips middlewares without afterLLM", async () => {
    const mw: Middleware = { name: "noop" };
    const state = makeState();
    await runAfterLLM([mw], state, []);
    // No error thrown
  });
});

describe("runBeforeTool", () => {
  it("chains args through each middleware's beforeTool", async () => {
    const mw1: Middleware = {
      name: "first",
      beforeTool: (_name, args) => ({
        ...(args as Record<string, unknown>),
        added1: true,
      }),
    };
    const mw2: Middleware = {
      name: "second",
      beforeTool: (_name, args) => ({
        ...(args as Record<string, unknown>),
        added2: true,
      }),
    };

    const result = await runBeforeTool(
      [mw1, mw2],
      "web_search",
      { query: "test" },
    );
    expect(result).toEqual({ query: "test", added1: true, added2: true });
  });

  it("returns original args when no middlewares have beforeTool", async () => {
    const mw: Middleware = { name: "noop" };
    const args = { query: "test" };
    const result = await runBeforeTool([mw], "web_search", args);
    expect(result).toBe(args);
  });

  it("passes tool name to each hook", async () => {
    const spy = vi.fn((_name, args) => args);
    const mw: Middleware = { name: "spy", beforeTool: spy };

    await runBeforeTool([mw], "file_writer", { filename: "out.md" });
    expect(spy).toHaveBeenCalledWith("file_writer", { filename: "out.md" });
  });
});

describe("runAfterTool", () => {
  it("chains result through each middleware's afterTool", async () => {
    const mw1: Middleware = {
      name: "first",
      afterTool: (_name, result) => ({
        ...(result as Record<string, unknown>),
        wrapped1: true,
      }),
    };
    const mw2: Middleware = {
      name: "second",
      afterTool: (_name, result) => ({
        ...(result as Record<string, unknown>),
        wrapped2: true,
      }),
    };

    const result = await runAfterTool(
      [mw1, mw2],
      "note_taker",
      { success: true },
    );
    expect(result).toEqual({ success: true, wrapped1: true, wrapped2: true });
  });

  it("returns original result when no middlewares have afterTool", async () => {
    const mw: Middleware = { name: "noop" };
    const original = { success: true };
    const result = await runAfterTool([mw], "web_search", original);
    expect(result).toBe(original);
  });

  it("passes error to afterTool when present", async () => {
    const spy = vi.fn((_name, result) => result);
    const mw: Middleware = { name: "spy", afterTool: spy };
    const err = new Error("tool failed");

    await runAfterTool([mw], "file_writer", null, err);
    expect(spy).toHaveBeenCalledWith("file_writer", null, err);
  });

  it("passes undefined error when no error", async () => {
    const spy = vi.fn((_name, result) => result);
    const mw: Middleware = { name: "spy", afterTool: spy };

    await runAfterTool([mw], "file_writer", { ok: true });
    expect(spy).toHaveBeenCalledWith("file_writer", { ok: true }, undefined);
  });
});
