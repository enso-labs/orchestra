import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type Phase } from "./system.js";
import {
  type ToolDef,
  toolDescriptionBlock,
  toolCallFormatInstructions,
  researchInstructions,
  synthesisInstructions,
  outputInstructions,
  errorRecoveryGuidance,
} from "./templates.js";

const sampleTools: ToolDef[] = [
  {
    name: "web_search",
    description: "Search the web for information",
    parameters: { query: { type: "string" } },
  },
  {
    name: "note_taker",
    description: "Save a research note",
    parameters: { note: { type: "string" }, category: { type: "string" } },
  },
];

// --- Template unit tests ---

describe("templates", () => {
  describe("toolDescriptionBlock", () => {
    it("returns empty string for no tools", () => {
      expect(toolDescriptionBlock([])).toBe("");
    });

    it("includes tool names and descriptions", () => {
      const result = toolDescriptionBlock(sampleTools);
      expect(result).toContain("## Available Tools");
      expect(result).toContain("**web_search**");
      expect(result).toContain("Search the web for information");
      expect(result).toContain("**note_taker**");
      expect(result).toContain("Save a research note");
    });

    it("includes JSON parameters", () => {
      const result = toolDescriptionBlock(sampleTools);
      expect(result).toContain('"query"');
      expect(result).toContain('"type":"string"');
    });
  });

  describe("phase instructions", () => {
    it("research instructions mention gathering information", () => {
      const result = researchInstructions();
      expect(result).toContain("Phase: Research");
      expect(result).toContain("research");
      expect(result).toContain("web_search");
      expect(result).toContain("note_taker");
      // Should tell agent NOT to produce final output
      expect(result).toContain("Do NOT produce a final ResearchResult yet");
    });

    it("synthesis instructions mention combining notes", () => {
      const result = synthesisInstructions();
      expect(result).toContain("Phase: Synthesis");
      expect(result).toContain("synthesis");
      expect(result).toContain("notes");
      expect(result).toContain("do NOT output the final result yet");
    });

    it("output instructions include JSON schema", () => {
      const result = outputInstructions();
      expect(result).toContain("Phase: Output");
      expect(result).toContain("title");
      expect(result).toContain("summary");
      expect(result).toContain("sources");
      expect(result).toContain("confidence");
      expect(result).toContain("followUpQuestions");
      expect(result).toContain("Do NOT call any tools");
    });
  });

  describe("errorRecoveryGuidance", () => {
    it("includes recovery instructions", () => {
      const result = errorRecoveryGuidance();
      expect(result).toContain("Error Recovery");
      expect(result).toContain("retry");
    });
  });

  describe("toolCallFormatInstructions", () => {
    it("includes JSON format for tool_calls", () => {
      const result = toolCallFormatInstructions();
      expect(result).toContain("How to Call Tools");
      expect(result).toContain("tool_calls");
      expect(result).toContain('"name"');
      expect(result).toContain('"args"');
      expect(result).toContain('"id"');
    });

    it("instructs to output only JSON", () => {
      const result = toolCallFormatInstructions();
      expect(result).toContain("ONLY");
      expect(result).toContain("JSON");
    });
  });
});

// --- buildSystemPrompt tests ---

describe("buildSystemPrompt", () => {
  it("includes the topic", () => {
    const result = buildSystemPrompt({
      topic: "quantum computing",
      phase: "research",
      noteCount: 0,
      tools: [],
    });
    expect(result).toContain("**quantum computing**");
  });

  it("includes note count (singular)", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 1,
      tools: [],
    });
    expect(result).toContain("**1** research note so far");
  });

  it("includes note count (plural)", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 5,
      tools: [],
    });
    expect(result).toContain("**5** research notes so far");
  });

  it("uses research phase instructions", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 0,
      tools: [],
    });
    expect(result).toContain("Phase: Research");
    expect(result).not.toContain("Phase: Synthesis");
    expect(result).not.toContain("Phase: Output");
  });

  it("uses synthesis phase instructions", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "synthesis",
      noteCount: 5,
      tools: [],
    });
    expect(result).toContain("Phase: Synthesis");
    expect(result).not.toContain("Phase: Research");
    expect(result).not.toContain("Phase: Output");
  });

  it("uses output phase instructions", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "output",
      noteCount: 10,
      tools: [],
    });
    expect(result).toContain("Phase: Output");
    expect(result).not.toContain("Phase: Research");
    expect(result).not.toContain("Phase: Synthesis");
  });

  it("includes tool definitions and call format instructions when provided", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 0,
      tools: sampleTools,
    });
    expect(result).toContain("## Available Tools");
    expect(result).toContain("**web_search**");
    expect(result).toContain("**note_taker**");
    // Pure LLM mode: tool call format instructions included
    expect(result).toContain("How to Call Tools");
    expect(result).toContain("tool_calls");
  });

  it("omits tool section and call format when no tools", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 0,
      tools: [],
    });
    expect(result).not.toContain("## Available Tools");
    expect(result).not.toContain("How to Call Tools");
  });

  it("always includes error recovery guidance", () => {
    const result = buildSystemPrompt({
      topic: "test",
      phase: "research",
      noteCount: 0,
      tools: [],
    });
    expect(result).toContain("Error Recovery");
  });

  it("produces distinct content for each phase", () => {
    const opts = { topic: "AI", noteCount: 3, tools: sampleTools };
    const research = buildSystemPrompt({ ...opts, phase: "research" as Phase });
    const synthesis = buildSystemPrompt({ ...opts, phase: "synthesis" as Phase });
    const output = buildSystemPrompt({ ...opts, phase: "output" as Phase });

    // All three are different
    expect(research).not.toBe(synthesis);
    expect(synthesis).not.toBe(output);
    expect(research).not.toBe(output);

    // But all share common elements
    expect(research).toContain("**AI**");
    expect(synthesis).toContain("**AI**");
    expect(output).toContain("**AI**");
  });
});
