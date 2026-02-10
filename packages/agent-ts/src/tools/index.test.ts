import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registerTool,
  executeTool,
  getServerToolNames,
  getToolDefinitions,
  ToolNotFoundError,
  _resetRegistry,
} from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";
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

describe("Tool Registry", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  describe("registerTool", () => {
    it("adds a tool to the registry", () => {
      const def: ToolDefinition = {
        name: "test_tool",
        description: "A test tool",
        parameters: z.object({ input: z.string() }),
        local: true,
      };
      const handler: ToolHandler = async (args) => ({ result: args });

      registerTool(def, handler);

      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("test_tool");
    });

    it("replaces an existing tool with the same name", () => {
      const def1: ToolDefinition = {
        name: "dup_tool",
        description: "First version",
        parameters: z.object({ a: z.string() }),
        local: true,
      };
      const def2: ToolDefinition = {
        name: "dup_tool",
        description: "Second version",
        parameters: z.object({ b: z.number() }),
        local: false,
      };

      registerTool(def1, async () => "v1");
      registerTool(def2, async () => "v2");

      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].description).toBe("Second version");
    });

    it("registers multiple distinct tools", () => {
      registerTool(
        { name: "a", description: "A", parameters: z.object({}), local: true },
        async () => "a",
      );
      registerTool(
        {
          name: "b",
          description: "B",
          parameters: z.object({}),
          local: false,
        },
        async () => "b",
      );

      expect(getToolDefinitions()).toHaveLength(2);
    });
  });

  describe("executeTool", () => {
    it("dispatches to a known tool handler", async () => {
      const def: ToolDefinition = {
        name: "echo",
        description: "Echoes input",
        parameters: z.object({ msg: z.string() }),
        local: true,
      };
      registerTool(def, async (args) => ({
        echo: (args as { msg: string }).msg,
      }));

      const state = makeState();
      const result = await executeTool("echo", { msg: "hello" }, state);
      expect(result).toEqual({ echo: "hello" });
    });

    it("throws ToolNotFoundError for unknown tool", async () => {
      const state = makeState();
      await expect(
        executeTool("nonexistent", {}, state),
      ).rejects.toThrow(ToolNotFoundError);
      await expect(
        executeTool("nonexistent", {}, state),
      ).rejects.toThrow("Tool not found: nonexistent");
    });

    it("validates args with Zod schema before calling handler", async () => {
      const def: ToolDefinition = {
        name: "strict_tool",
        description: "Requires a number",
        parameters: z.object({ count: z.number().min(1) }),
        local: true,
      };
      let handlerCalled = false;
      registerTool(def, async () => {
        handlerCalled = true;
        return "ok";
      });

      const state = makeState();

      // Invalid: count is a string
      await expect(
        executeTool("strict_tool", { count: "not a number" }, state),
      ).rejects.toThrow(z.ZodError);
      expect(handlerCalled).toBe(false);

      // Invalid: count is 0 (below min)
      await expect(
        executeTool("strict_tool", { count: 0 }, state),
      ).rejects.toThrow(z.ZodError);
      expect(handlerCalled).toBe(false);

      // Valid
      const result = await executeTool(
        "strict_tool",
        { count: 5 },
        state,
      );
      expect(result).toBe("ok");
      expect(handlerCalled).toBe(true);
    });

    it("passes state to handler", async () => {
      const def: ToolDefinition = {
        name: "state_reader",
        description: "Reads state",
        parameters: z.object({}),
        local: true,
      };
      registerTool(def, async (_args, state) => ({
        iteration: state.iteration,
        noteCount: state.notes.length,
      }));

      const state = makeState({ iteration: 3, notes: [{ note: "test" }] });
      const result = await executeTool("state_reader", {}, state);
      expect(result).toEqual({ iteration: 3, noteCount: 1 });
    });

    it("passes options to handler", async () => {
      const def: ToolDefinition = {
        name: "opts_tool",
        description: "Uses options",
        parameters: z.object({}),
        local: true,
      };
      registerTool(def, async (_args, _state, options) => ({
        received: options?.key,
      }));

      const state = makeState();
      const result = await executeTool("opts_tool", {}, state, {
        key: "value",
      });
      expect(result).toEqual({ received: "value" });
    });
  });

  describe("getServerToolNames", () => {
    it("returns names of tools where local is false", () => {
      registerTool(
        {
          name: "local_tool",
          description: "Local",
          parameters: z.object({}),
          local: true,
        },
        async () => null,
      );
      registerTool(
        {
          name: "server_tool",
          description: "Server",
          parameters: z.object({}),
          local: false,
        },
        async () => null,
      );
      registerTool(
        {
          name: "another_server",
          description: "Server 2",
          parameters: z.object({}),
          local: false,
        },
        async () => null,
      );

      const serverNames = getServerToolNames();
      expect(serverNames).toEqual(["server_tool", "another_server"]);
      expect(serverNames).not.toContain("local_tool");
    });

    it("returns empty array when no server tools registered", () => {
      registerTool(
        {
          name: "only_local",
          description: "Local only",
          parameters: z.object({}),
          local: true,
        },
        async () => null,
      );

      expect(getServerToolNames()).toEqual([]);
    });

    it("returns empty array when no tools registered", () => {
      expect(getServerToolNames()).toEqual([]);
    });
  });

  describe("ToolNotFoundError", () => {
    it("has correct name and message", () => {
      const err = new ToolNotFoundError("missing_tool");
      expect(err.name).toBe("ToolNotFoundError");
      expect(err.message).toBe("Tool not found: missing_tool");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ToolNotFoundError);
    });
  });

  describe("getToolDefinitions", () => {
    it("returns a copy of definitions array", () => {
      registerTool(
        {
          name: "tool1",
          description: "T1",
          parameters: z.object({}),
          local: true,
        },
        async () => null,
      );

      const defs = getToolDefinitions();
      defs.push({
        name: "injected",
        description: "Should not appear",
        parameters: z.object({}),
        local: true,
      });

      // Original registry should not be affected
      expect(getToolDefinitions()).toHaveLength(1);
    });
  });
});
