import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  humanContactDefinition,
  registerHumanContact,
} from "./human-contact.js";
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

describe("human_contact tool", () => {
  beforeEach(() => {
    _resetRegistry();
    vi.restoreAllMocks();
  });

  describe("humanContactDefinition", () => {
    it("has correct name", () => {
      expect(humanContactDefinition.name).toBe("human_contact");
    });

    it("has a description", () => {
      expect(humanContactDefinition.description).toBeTruthy();
      expect(typeof humanContactDefinition.description).toBe("string");
    });

    it("is marked local: true", () => {
      expect(humanContactDefinition.local).toBe(true);
    });

    it("has a Zod parameters schema that validates HumanContactInput", () => {
      const valid = humanContactDefinition.parameters.safeParse({
        question: "What topic should I research?",
      });
      expect(valid.success).toBe(true);

      const withContext = humanContactDefinition.parameters.safeParse({
        question: "Should I proceed?",
        context: "Found 5 sources but confidence is low",
      });
      expect(withContext.success).toBe(true);

      const missingQuestion =
        humanContactDefinition.parameters.safeParse({});
      expect(missingQuestion.success).toBe(false);

      const emptyQuestion = humanContactDefinition.parameters.safeParse({
        question: "",
      });
      expect(emptyQuestion.success).toBe(false);
    });
  });

  describe("registerHumanContact", () => {
    it("adds human_contact to the registry", () => {
      registerHumanContact();
      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("human_contact");
      expect(defs[0].local).toBe(true);
    });

    it("human_contact does NOT appear in getServerToolNames()", () => {
      registerHumanContact();
      expect(getServerToolNames()).not.toContain("human_contact");
    });
  });

  describe("execution", () => {
    beforeEach(() => {
      registerHumanContact();
    });

    it("calls promptFn with the question and returns the response", async () => {
      const state = makeState();
      const promptFn = vi.fn().mockResolvedValue("Yes, proceed with caution");

      const result = (await executeTool(
        "human_contact",
        { question: "Should I continue researching this topic?" },
        state,
        { promptFn },
      )) as { human_response: string; timestamp: string };

      expect(promptFn).toHaveBeenCalledOnce();
      expect(promptFn).toHaveBeenCalledWith(
        "Should I continue researching this topic?",
      );
      expect(result.human_response).toBe("Yes, proceed with caution");
    });

    it("returns an ISO timestamp", async () => {
      const state = makeState();
      const promptFn = vi.fn().mockResolvedValue("ok");

      const result = (await executeTool(
        "human_contact",
        { question: "Any feedback?" },
        state,
        { promptFn },
      )) as { human_response: string; timestamp: string };

      expect(result.timestamp).toBeDefined();
      const parsed = new Date(result.timestamp);
      expect(parsed.toISOString()).toBe(result.timestamp);
    });

    it("throws when promptFn is not provided in options", async () => {
      const state = makeState();

      await expect(
        executeTool("human_contact", { question: "Hello?" }, state),
      ).rejects.toThrow("human_contact requires a promptFn in options");
    });

    it("throws when options is provided but promptFn is missing", async () => {
      const state = makeState();

      await expect(
        executeTool("human_contact", { question: "Hello?" }, state, {}),
      ).rejects.toThrow("human_contact requires a promptFn in options");
    });

    it("passes context through in the input validation", async () => {
      const state = makeState();
      const promptFn = vi.fn().mockResolvedValue("Looks good");

      const result = (await executeTool(
        "human_contact",
        {
          question: "Is this summary accurate?",
          context: "Summary covers 3 key findings",
        },
        state,
        { promptFn },
      )) as { human_response: string; timestamp: string };

      expect(result.human_response).toBe("Looks good");
      expect(promptFn).toHaveBeenCalledWith("Is this summary accurate?");
    });

    it("propagates errors from promptFn", async () => {
      const state = makeState();
      const promptFn = vi
        .fn()
        .mockRejectedValue(new Error("User cancelled"));

      await expect(
        executeTool(
          "human_contact",
          { question: "Continue?" },
          state,
          { promptFn },
        ),
      ).rejects.toThrow("User cancelled");
    });
  });
});
