import { WebSearchInput } from "../schemas.js";
import { registerTool } from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// --- web_search: server-delegated tool ---

export const webSearchDefinition: ToolDefinition = {
  name: "web_search",
  description:
    "Search the web for information on a given query. Executed server-side by the Ruska backend.",
  parameters: WebSearchInput,
  local: false,
};

/**
 * Server-delegated tool — no local handler needed.
 * The backend executes web_search when it appears in the API request tools array.
 */
const webSearchHandler: ToolHandler = async () => {
  throw new Error(
    "web_search is a server-delegated tool and cannot be executed locally",
  );
};

/**
 * Register the web_search tool definition in the registry.
 * Since local: false, it will appear in getServerToolNames() for the API request.
 */
export function registerWebSearch(): void {
  registerTool(webSearchDefinition, webSearchHandler);
}

// --- tavily_search: local fallback when TAVILY_API_KEY is set ---

export const tavilySearchDefinition: ToolDefinition = {
  name: "tavily_search",
  description:
    "Search the web using the Tavily Search API. Local fallback for web_search when TAVILY_API_KEY is configured.",
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
