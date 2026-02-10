import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  ResearchResult,
  AgentState,
  WebSearchInput,
  FileWriterInput,
  HumanContactInput,
  NoteTakerInput,
} from "./schemas.js";

describe("ResearchResult", () => {
  const validResult = {
    title: "AI Research Summary",
    summary: "A comprehensive look at recent AI developments.",
    sources: ["https://example.com/a", "https://example.com/b"],
    confidence: 0.85,
    followUpQuestions: ["What about safety?", "How does this affect jobs?"],
  };

  it("parses a fully valid object", () => {
    const parsed = ResearchResult.parse(validResult);
    expect(parsed.title).toBe("AI Research Summary");
    expect(parsed.sources).toHaveLength(2);
    expect(parsed.confidence).toBe(0.85);
    expect(parsed.followUpQuestions).toHaveLength(2);
  });

  it("accepts empty arrays for sources and followUpQuestions", () => {
    const parsed = ResearchResult.parse({
      ...validResult,
      sources: [],
      followUpQuestions: [],
    });
    expect(parsed.sources).toEqual([]);
    expect(parsed.followUpQuestions).toEqual([]);
  });

  it("throws ZodError when title is missing", () => {
    const { title, ...rest } = validResult;
    expect(() => ResearchResult.parse(rest)).toThrow(ZodError);
  });

  it("throws ZodError when title is empty string", () => {
    expect(() => ResearchResult.parse({ ...validResult, title: "" })).toThrow(
      ZodError,
    );
  });

  it("throws ZodError when summary is missing", () => {
    const { summary, ...rest } = validResult;
    expect(() => ResearchResult.parse(rest)).toThrow(ZodError);
  });

  it("throws ZodError when confidence is above 1", () => {
    expect(() =>
      ResearchResult.parse({ ...validResult, confidence: 1.5 }),
    ).toThrow(ZodError);
  });

  it("throws ZodError when confidence is below 0", () => {
    expect(() =>
      ResearchResult.parse({ ...validResult, confidence: -0.1 }),
    ).toThrow(ZodError);
  });

  it("accepts confidence at boundaries (0 and 1)", () => {
    expect(ResearchResult.parse({ ...validResult, confidence: 0 }).confidence).toBe(0);
    expect(ResearchResult.parse({ ...validResult, confidence: 1 }).confidence).toBe(1);
  });

  it("throws ZodError when sources contains non-string", () => {
    expect(() =>
      ResearchResult.parse({ ...validResult, sources: [123] }),
    ).toThrow(ZodError);
  });

  it("provides descriptive error messages", () => {
    try {
      ResearchResult.parse({});
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
      const err = e as ZodError;
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.issues[0].path).toBeDefined();
    }
  });
});

describe("AgentState", () => {
  const validState = {
    messages: [{ role: "user", content: "Hello" }],
    notes: [],
    sources: [],
    iteration: 0,
  };

  it("parses a valid state with required fields only", () => {
    const parsed = AgentState.parse(validState);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.notes).toEqual([]);
    expect(parsed.sources).toEqual([]);
    expect(parsed.iteration).toBe(0);
    expect(parsed.threadId).toBeUndefined();
    expect(parsed.systemPrompt).toBeUndefined();
  });

  it("accepts optional threadId and systemPrompt", () => {
    const parsed = AgentState.parse({
      ...validState,
      threadId: "thread-abc",
      systemPrompt: "You are a research agent.",
    });
    expect(parsed.threadId).toBe("thread-abc");
    expect(parsed.systemPrompt).toBe("You are a research agent.");
  });

  it("accepts notes with category and source", () => {
    const parsed = AgentState.parse({
      ...validState,
      notes: [
        { note: "Important finding", category: "research", source: "https://example.com" },
      ],
    });
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].category).toBe("research");
  });

  it("throws ZodError when messages is missing", () => {
    const { messages, ...rest } = validState;
    expect(() => AgentState.parse(rest)).toThrow(ZodError);
  });

  it("throws ZodError when iteration is negative", () => {
    expect(() =>
      AgentState.parse({ ...validState, iteration: -1 }),
    ).toThrow(ZodError);
  });

  it("throws ZodError when iteration is not an integer", () => {
    expect(() =>
      AgentState.parse({ ...validState, iteration: 1.5 }),
    ).toThrow(ZodError);
  });
});

describe("WebSearchInput", () => {
  it("parses a valid query", () => {
    const parsed = WebSearchInput.parse({ query: "TypeScript agents" });
    expect(parsed.query).toBe("TypeScript agents");
  });

  it("throws ZodError when query is empty", () => {
    expect(() => WebSearchInput.parse({ query: "" })).toThrow(ZodError);
  });

  it("throws ZodError when query is missing", () => {
    expect(() => WebSearchInput.parse({})).toThrow(ZodError);
  });
});

describe("FileWriterInput", () => {
  it("parses with required fields only", () => {
    const parsed = FileWriterInput.parse({
      filename: "report.md",
      content: "# Report",
    });
    expect(parsed.filename).toBe("report.md");
    expect(parsed.content).toBe("# Report");
    expect(parsed.format).toBeUndefined();
  });

  it("parses with optional format", () => {
    const parsed = FileWriterInput.parse({
      filename: "data.json",
      content: "{}",
      format: "json",
    });
    expect(parsed.format).toBe("json");
  });

  it("throws ZodError when filename is empty", () => {
    expect(() =>
      FileWriterInput.parse({ filename: "", content: "data" }),
    ).toThrow(ZodError);
  });

  it("accepts empty content string", () => {
    const parsed = FileWriterInput.parse({ filename: "empty.txt", content: "" });
    expect(parsed.content).toBe("");
  });
});

describe("HumanContactInput", () => {
  it("parses with required question only", () => {
    const parsed = HumanContactInput.parse({ question: "What do you think?" });
    expect(parsed.question).toBe("What do you think?");
    expect(parsed.context).toBeUndefined();
  });

  it("parses with optional context", () => {
    const parsed = HumanContactInput.parse({
      question: "Clarify this?",
      context: "Found conflicting info.",
    });
    expect(parsed.context).toBe("Found conflicting info.");
  });

  it("throws ZodError when question is empty", () => {
    expect(() => HumanContactInput.parse({ question: "" })).toThrow(ZodError);
  });
});

describe("NoteTakerInput", () => {
  it("parses with required note only", () => {
    const parsed = NoteTakerInput.parse({ note: "Key insight" });
    expect(parsed.note).toBe("Key insight");
    expect(parsed.category).toBeUndefined();
    expect(parsed.source).toBeUndefined();
  });

  it("parses with all optional fields", () => {
    const parsed = NoteTakerInput.parse({
      note: "Important",
      category: "findings",
      source: "https://example.com",
    });
    expect(parsed.category).toBe("findings");
    expect(parsed.source).toBe("https://example.com");
  });

  it("throws ZodError when note is empty", () => {
    expect(() => NoteTakerInput.parse({ note: "" })).toThrow(ZodError);
  });

  it("throws ZodError when note is missing", () => {
    expect(() => NoteTakerInput.parse({})).toThrow(ZodError);
  });
});
