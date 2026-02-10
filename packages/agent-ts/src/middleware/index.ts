import type { AgentState } from "../schemas.js";
import type { StreamEvent } from "../stream-client.js";

// --- Middleware type ---

export interface Middleware {
  name: string;
  beforeLLM?: (state: AgentState) => AgentState | Promise<AgentState>;
  afterLLM?: (state: AgentState, events: StreamEvent[]) => void | Promise<void>;
  beforeTool?: (toolName: string, args: unknown) => unknown | Promise<unknown>;
  afterTool?: (
    toolName: string,
    result: unknown,
    error?: Error,
  ) => unknown | Promise<unknown>;
}

// --- Runner functions ---

export async function runBeforeLLM(
  middlewares: Middleware[],
  state: AgentState,
): Promise<AgentState> {
  let current = state;
  for (const mw of middlewares) {
    if (mw.beforeLLM) {
      current = await mw.beforeLLM(current);
    }
  }
  return current;
}

export async function runAfterLLM(
  middlewares: Middleware[],
  state: AgentState,
  events: StreamEvent[],
): Promise<void> {
  for (const mw of middlewares) {
    if (mw.afterLLM) {
      await mw.afterLLM(state, events);
    }
  }
}

export async function runBeforeTool(
  middlewares: Middleware[],
  toolName: string,
  args: unknown,
): Promise<unknown> {
  let current = args;
  for (const mw of middlewares) {
    if (mw.beforeTool) {
      current = await mw.beforeTool(toolName, current);
    }
  }
  return current;
}

export async function runAfterTool(
  middlewares: Middleware[],
  toolName: string,
  result: unknown,
  error?: Error,
): Promise<unknown> {
  let current = result;
  for (const mw of middlewares) {
    if (mw.afterTool) {
      current = await mw.afterTool(toolName, current, error);
    }
  }
  return current;
}
