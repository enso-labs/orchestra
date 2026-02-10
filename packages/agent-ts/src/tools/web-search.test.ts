import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  webSearchDefinition,
  tavilySearchDefinition,
  registerWebSearch,
  registerTavilySearch,
} from "./web-search.js";
import {
  getServerToolNames,
  getToolDefinitions,
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

describe("web_search tool", () => {
  beforeEach(() => {
    _resetRegistry();
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TAVILY_API_KEY;
  });

  describe("webSearchDefinition", () => {
    it("has correct name", () => {
      expect(webSearchDefinition.name).toBe("web_search");
    });

    it("has a description", () => {
      expect(webSearchDefinition.description).toBeTruthy();
      expect(typeof webSearchDefinition.description).toBe("string");
    });

    it("has local set to false (server-delegated)", () => {
      expect(webSearchDefinition.local).toBe(false);
    });

    it("has a Zod parameters schema that validates query string", () => {
      const valid = webSearchDefinition.parameters.safeParse({
        query: "test query",
      });
      expect(valid.success).toBe(true);

      const invalid = webSearchDefinition.parameters.safeParse({});
      expect(invalid.success).toBe(false);

      const emptyQuery = webSearchDefinition.parameters.safeParse({
        query: "",
      });
      expect(emptyQuery.success).toBe(false);
    });
  });

  describe("registerWebSearch", () => {
    it("adds web_search to the registry", () => {
      registerWebSearch();
      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("web_search");
      expect(defs[0].local).toBe(false);
    });

    it("makes web_search appear in getServerToolNames()", () => {
      registerWebSearch();
      expect(getServerToolNames()).toContain("web_search");
    });

    it("throws when executed locally (server-delegated)", async () => {
      registerWebSearch();
      const state = makeState();
      await expect(
        executeTool("web_search", { query: "test" }, state),
      ).rejects.toThrow("server-delegated tool");
    });
  });

  describe("tavilySearchDefinition", () => {
    it("has correct name", () => {
      expect(tavilySearchDefinition.name).toBe("tavily_search");
    });

    it("has local set to true", () => {
      expect(tavilySearchDefinition.local).toBe(true);
    });

    it("has a Zod parameters schema matching WebSearchInput", () => {
      const valid = tavilySearchDefinition.parameters.safeParse({
        query: "test",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("registerTavilySearch", () => {
    it("does not register when TAVILY_API_KEY is not set", () => {
      const result = registerTavilySearch();
      expect(result).toBe(false);
      expect(getToolDefinitions()).toHaveLength(0);
    });

    it("registers tavily_search when TAVILY_API_KEY is set", () => {
      process.env.TAVILY_API_KEY = "tvly-test-key";
      const result = registerTavilySearch();
      expect(result).toBe(true);

      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("tavily_search");
      expect(defs[0].local).toBe(true);
    });

    it("tavily_search does NOT appear in getServerToolNames()", () => {
      process.env.TAVILY_API_KEY = "tvly-test-key";
      registerTavilySearch();
      expect(getServerToolNames()).not.toContain("tavily_search");
    });

    it("tavily_search calls Tavily API with correct payload", async () => {
      process.env.TAVILY_API_KEY = "tvly-test-key";
      registerTavilySearch();

      const mockResponse = {
        results: [{ title: "Test", url: "https://example.com" }],
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch") as any;
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const state = makeState();
      const result = await executeTool(
        "tavily_search",
        { query: "test query" },
        state,
      );
      expect(result).toEqual(mockResponse);

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.tavily.com/search",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: "tvly-test-key",
            query: "test query",
          }),
        }),
      );
    });

    it("tavily_search throws on API error", async () => {
      process.env.TAVILY_API_KEY = "tvly-test-key";
      registerTavilySearch();

      const fetchSpy = vi.spyOn(globalThis, "fetch") as any;
      fetchSpy.mockResolvedValue(
        new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      );

      const state = makeState();
      await expect(
        executeTool("tavily_search", { query: "test" }, state),
      ).rejects.toThrow("Tavily API error: 401 Unauthorized");
    });
  });

  describe("combined registration", () => {
    it("both web_search and tavily_search can be registered together", () => {
      process.env.TAVILY_API_KEY = "tvly-test-key";
      registerWebSearch();
      registerTavilySearch();

      const defs = getToolDefinitions();
      expect(defs).toHaveLength(2);

      const names = defs.map((d) => d.name);
      expect(names).toContain("web_search");
      expect(names).toContain("tavily_search");

      // Only web_search should be a server tool
      const serverTools = getServerToolNames();
      expect(serverTools).toEqual(["web_search"]);
    });
  });
});
