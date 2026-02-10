import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  noteTakerDefinition,
  registerNoteTaker,
} from "./note-taker.js";
import {
  getToolDefinitions,
  getServerToolNames,
  executeTool,
  _resetRegistry,
} from "./index.js";
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

describe("note_taker tool", () => {
  beforeEach(() => {
    _resetRegistry();
    vi.restoreAllMocks();
  });

  describe("noteTakerDefinition", () => {
    it("has correct name", () => {
      expect(noteTakerDefinition.name).toBe("note_taker");
    });

    it("has a description", () => {
      expect(noteTakerDefinition.description).toBeTruthy();
      expect(typeof noteTakerDefinition.description).toBe("string");
    });

    it("is marked local: true", () => {
      expect(noteTakerDefinition.local).toBe(true);
    });

    it("has a Zod parameters schema that validates NoteTakerInput", () => {
      const valid = noteTakerDefinition.parameters.safeParse({
        note: "some finding",
      });
      expect(valid.success).toBe(true);

      const withOptionals = noteTakerDefinition.parameters.safeParse({
        note: "another finding",
        category: "methodology",
        source: "https://example.com",
      });
      expect(withOptionals.success).toBe(true);

      const missingNote = noteTakerDefinition.parameters.safeParse({});
      expect(missingNote.success).toBe(false);

      const emptyNote = noteTakerDefinition.parameters.safeParse({
        note: "",
      });
      expect(emptyNote.success).toBe(false);
    });
  });

  describe("registerNoteTaker", () => {
    it("adds note_taker to the registry", () => {
      registerNoteTaker();
      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("note_taker");
      expect(defs[0].local).toBe(true);
    });

    it("note_taker does NOT appear in getServerToolNames()", () => {
      registerNoteTaker();
      expect(getServerToolNames()).not.toContain("note_taker");
    });
  });

  describe("execution", () => {
    beforeEach(() => {
      registerNoteTaker();
    });

    it("adds a note to state and increments count", async () => {
      const state = makeState();
      const result = (await executeTool(
        "note_taker",
        { note: "First finding" },
        state,
      )) as { success: boolean; note_count: number; category: string };

      expect(result.success).toBe(true);
      expect(result.note_count).toBe(1);
      expect(state.notes).toHaveLength(1);
      expect(state.notes[0].note).toBe("First finding");
    });

    it("defaults category to 'general' when not provided", async () => {
      const state = makeState();
      const result = (await executeTool(
        "note_taker",
        { note: "A note without category" },
        state,
      )) as { success: boolean; note_count: number; category: string };

      expect(result.category).toBe("general");
      expect(state.notes[0].category).toBe("general");
    });

    it("uses provided category when specified", async () => {
      const state = makeState();
      const result = (await executeTool(
        "note_taker",
        { note: "Method note", category: "methodology" },
        state,
      )) as { success: boolean; note_count: number; category: string };

      expect(result.category).toBe("methodology");
      expect(state.notes[0].category).toBe("methodology");
    });

    it("source is optional and stored when provided", async () => {
      const state = makeState();

      // Without source
      await executeTool("note_taker", { note: "No source" }, state);
      expect(state.notes[0].source).toBeUndefined();

      // With source
      await executeTool(
        "note_taker",
        { note: "Has source", source: "https://example.com" },
        state,
      );
      expect(state.notes[1].source).toBe("https://example.com");
    });

    it("state mutation is correct across multiple calls", async () => {
      const state = makeState();

      const r1 = (await executeTool(
        "note_taker",
        { note: "First" },
        state,
      )) as { note_count: number };
      expect(r1.note_count).toBe(1);

      const r2 = (await executeTool(
        "note_taker",
        { note: "Second", category: "data" },
        state,
      )) as { note_count: number };
      expect(r2.note_count).toBe(2);

      const r3 = (await executeTool(
        "note_taker",
        { note: "Third", source: "paper.pdf" },
        state,
      )) as { note_count: number };
      expect(r3.note_count).toBe(3);

      expect(state.notes).toHaveLength(3);
      expect(state.notes[0].note).toBe("First");
      expect(state.notes[1].note).toBe("Second");
      expect(state.notes[1].category).toBe("data");
      expect(state.notes[2].source).toBe("paper.pdf");
    });

    it("includes an ISO timestamp on each note", async () => {
      const state = makeState();
      await executeTool("note_taker", { note: "Timestamped" }, state);

      expect(state.notes[0].timestamp).toBeDefined();
      // Verify it's a valid ISO date string
      const parsed = new Date(state.notes[0].timestamp!);
      expect(parsed.toISOString()).toBe(state.notes[0].timestamp);
    });
  });
});
