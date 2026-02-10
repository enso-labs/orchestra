import { describe, it, expect, beforeEach } from "vitest";
import { createDynamicPromptMiddleware, dynamicPromptMiddleware } from "./dynamic-prompt.js";
import { _resetRegistry, registerTool } from "../tools/index.js";
import { z } from "zod";
import type { AgentState } from "../schemas.js";

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    messages: [],
    notes: [],
    sources: [],
    iteration: 0,
    ...overrides,
  };
}

function makeNotes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    note: `Note ${i + 1}`,
    category: "general",
    timestamp: new Date().toISOString(),
  }));
}

describe("dynamic-prompt middleware", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it("has name 'dynamic-prompt'", () => {
    const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
    expect(mw.name).toBe("dynamic-prompt");
  });

  it("defines beforeLLM hook", () => {
    const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
    expect(typeof mw.beforeLLM).toBe("function");
  });

  it("does not define afterLLM, beforeTool, or afterTool hooks", () => {
    const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
    expect(mw.afterLLM).toBeUndefined();
    expect(mw.beforeTool).toBeUndefined();
    expect(mw.afterTool).toBeUndefined();
  });

  describe("phase detection", () => {
    it("sets research phase when notes < 3 and not near max iterations", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI Safety", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(0), iteration: 0 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Research");
      expect(result.systemPrompt).toContain("AI Safety");
    });

    it("sets research phase with 2 notes (still below threshold)", () => {
      const mw = createDynamicPromptMiddleware({ topic: "Quantum Computing", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(2), iteration: 3 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Research");
      expect(result.systemPrompt).toContain("**2** research note");
    });

    it("sets synthesis phase when notes >= 3 and not near max iterations", () => {
      const mw = createDynamicPromptMiddleware({ topic: "Climate Change", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(5), iteration: 5 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Synthesis");
      expect(result.systemPrompt).toContain("Climate Change");
    });

    it("sets synthesis phase with exactly 3 notes", () => {
      const mw = createDynamicPromptMiddleware({ topic: "Robotics", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(3), iteration: 4 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Synthesis");
    });

    it("sets output phase when iteration >= maxIterations - 2", () => {
      const mw = createDynamicPromptMiddleware({ topic: "Space Travel", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(5), iteration: 13 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Output");
      expect(result.systemPrompt).toContain("Space Travel");
    });

    it("sets output phase at exactly maxIterations - 2", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 10 });
      const state = makeState({ notes: makeNotes(5), iteration: 8 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Output");
    });

    it("prioritizes output phase over synthesis when near max iterations with many notes", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 10 });
      const state = makeState({ notes: makeNotes(10), iteration: 9 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Output");
    });

    it("prioritizes output phase over research when near max iterations with few notes", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 5 });
      const state = makeState({ notes: makeNotes(1), iteration: 3 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Phase: Output");
    });
  });

  describe("prompt content", () => {
    it("includes the topic in the system prompt", () => {
      const mw = createDynamicPromptMiddleware({ topic: "Neural Networks", maxIterations: 15 });
      const state = makeState({ iteration: 0 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Neural Networks");
    });

    it("includes note count in the system prompt", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
      const state = makeState({ notes: makeNotes(7), iteration: 5 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("**7** research note");
    });

    it("includes registered tool definitions in the prompt", () => {
      registerTool(
        { name: "test_tool", description: "A test tool", parameters: z.object({ input: z.string() }), local: true },
        async () => ({}),
      );
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
      const state = makeState({ iteration: 0 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("test_tool");
      expect(result.systemPrompt).toContain("A test tool");
    });

    it("includes error recovery guidance", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
      const state = makeState({ iteration: 0 });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).toContain("Error Recovery");
    });
  });

  describe("state immutability", () => {
    it("does not mutate the original state", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
      const state = makeState({ iteration: 0, systemPrompt: "old prompt" });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.systemPrompt).not.toBe("old prompt");
      expect(state.systemPrompt).toBe("old prompt");
    });

    it("preserves all other state fields", () => {
      const mw = createDynamicPromptMiddleware({ topic: "AI", maxIterations: 15 });
      const state = makeState({
        messages: [{ role: "user", content: "hello" }],
        notes: makeNotes(1),
        sources: ["https://example.com"],
        threadId: "thread-123",
        iteration: 3,
      });
      const result = mw.beforeLLM!(state) as AgentState;
      expect(result.messages).toEqual(state.messages);
      expect(result.notes).toEqual(state.notes);
      expect(result.sources).toEqual(state.sources);
      expect(result.threadId).toBe("thread-123");
      expect(result.iteration).toBe(3);
    });
  });

  it("exports dynamicPromptMiddleware as alias for createDynamicPromptMiddleware", () => {
    expect(dynamicPromptMiddleware).toBe(createDynamicPromptMiddleware);
  });
});
