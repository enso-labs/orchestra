import { z } from "zod";
import type { AgentState } from "../schemas.js";
import { buildSystemPrompt } from "../prompts/system.js";
import type { Phase } from "../prompts/system.js";
import { getToolDefinitions } from "../tools/index.js";
import type { Middleware } from "./index.js";

export interface DynamicPromptOptions {
  topic: string;
  maxIterations: number;
}

function detectPhase(notes: AgentState["notes"], iteration: number, maxIterations: number): Phase {
  if (iteration >= maxIterations - 2) {
    return "output";
  }
  if (notes.length >= 3) {
    return "synthesis";
  }
  return "research";
}

/**
 * Convert a Zod schema to a JSON Schema object.
 * Handles the common types used by agent tools (object, string, number, boolean, array, optional).
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as z.ZodType & { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject": {
      const shape = (typeof def.shape === "function" ? def.shape() : def.shape) as Record<string, z.ZodType>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const innerDef = (value as z.ZodType & { _def: Record<string, unknown> })._def;
        if ((innerDef.typeName as string) === "ZodOptional") {
          properties[key] = zodToJsonSchema(innerDef.innerType as z.ZodType);
        } else {
          properties[key] = zodToJsonSchema(value);
          required.push(key);
        }
      }

      const result: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) result.required = required;
      return result;
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type as z.ZodType) };
    case "ZodOptional":
      return zodToJsonSchema(def.innerType as z.ZodType);
    default:
      return { type: "object" };
  }
}

export function createDynamicPromptMiddleware(
  options: DynamicPromptOptions,
): Middleware {
  const { topic, maxIterations } = options;

  return {
    name: "dynamic-prompt",

    beforeLLM(state: AgentState): AgentState {
      const phase = detectPhase(state.notes, state.iteration, maxIterations);

      const tools = getToolDefinitions().map((t) => ({
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      }));

      const systemPrompt = buildSystemPrompt({
        topic,
        phase,
        noteCount: state.notes.length,
        tools,
      });

      return { ...state, systemPrompt };
    },
  };
}

export const dynamicPromptMiddleware = createDynamicPromptMiddleware;
