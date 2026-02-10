import { WebSearchInput } from "../schemas.js";
import { registerTool } from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// --- web_search: local tool (pure LLM mode — all tools run locally) ---

export const webSearchDefinition: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for information on a given query. When TAVILY_API_KEY is set, uses the Tavily Search API. Otherwise returns simulated results.",
  parameters: WebSearchInput,
  local: true,
};

/**
 * Local web_search handler.
 * If TAVILY_API_KEY is set, calls Tavily API. Otherwise returns simulated results.
 */
const webSearchHandler: ToolHandler = async (args) => {
  const { query } = args as { query: string };
  const apiKey = process.env.TAVILY_API_KEY;

  if (apiKey) {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Simulated search results when no TAVILY_API_KEY
  return {
    results: [
      {
        title: `Search results for: ${query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        content: `Simulated search result for "${query}". Set TAVILY_API_KEY for real web search results.`,
      },
    ],
    query,
    simulated: true,
  };
};

/**
 * Register the web_search tool definition in the registry.
 * All tools are local — the backend acts as pure LLM inference only.
 */
export function registerWebSearch(): void {
  registerTool(webSearchDefinition, webSearchHandler);
}

// --- tavily_search: explicit Tavily registration (alias for backward compat) ---

export const tavilySearchDefinition: ToolDefinition = {
  name: "tavily_search",
  description:
    "Search the web using the Tavily Search API. Explicit Tavily search tool when TAVILY_API_KEY is configured.",
  parameters: WebSearchInput,
  local: true,
};

const tavilySearchHandler: ToolHandler = async (args) => {
  const { query } = args as { query: string };
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

/**
 * Register the tavily_search tool if TAVILY_API_KEY is present in the environment.
 * Returns true if registered, false if key is missing.
 */
export function registerTavilySearch(): boolean {
  if (!process.env.TAVILY_API_KEY) {
    return false;
  }
  registerTool(tavilySearchDefinition, tavilySearchHandler);
  return true;
}
