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
        parameters: t.parameters._def
          ? { type: "object" }
          : (t.parameters as unknown as Record<string, unknown>),
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
