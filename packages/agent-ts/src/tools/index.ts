import { z } from "zod";
import type { AgentState } from "../schemas.js";

// --- Types ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  local: boolean;
}

export type ToolHandler = (
  args: unknown,
  state: AgentState,
  options?: Record<string, unknown>,
) => Promise<unknown>;

// --- Errors ---

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Tool not found: ${name}`);
    this.name = "ToolNotFoundError";
  }
}

// --- Registry ---

const definitions: ToolDefinition[] = [];
const handlers = new Map<string, ToolHandler>();

export function registerTool(
  definition: ToolDefinition,
  handler: ToolHandler,
): void {
  const existing = definitions.findIndex((d) => d.name === definition.name);
  if (existing >= 0) {
    definitions[existing] = definition;
  } else {
    definitions.push(definition);
  }
  handlers.set(definition.name, handler);
}

export function getToolDefinitions(): ToolDefinition[] {
  return [...definitions];
}

/** Alias for backward-compat — same as getToolDefinitions() */
export const TOOL_DEFINITIONS = definitions;

export function getServerToolNames(): string[] {
  return definitions.filter((d) => !d.local).map((d) => d.name);
}

export async function executeTool(
  name: string,
  args: unknown,
  state: AgentState,
  options?: Record<string, unknown>,
): Promise<unknown> {
  const def = definitions.find((d) => d.name === name);
  if (!def) {
    throw new ToolNotFoundError(name);
  }

  // Validate input with Zod schema
  const validated = def.parameters.parse(args);

  const handler = handlers.get(name);
  if (!handler) {
    throw new ToolNotFoundError(name);
  }

  return handler(validated, state, options);
}

// --- Internal helpers for testing ---

export function _resetRegistry(): void {
  definitions.length = 0;
  handlers.clear();
}
