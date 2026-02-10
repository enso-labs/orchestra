import { HumanContactInput } from "../schemas.js";
import { registerTool } from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// --- human_contact: local tool ---

export const humanContactDefinition: ToolDefinition = {
  name: "human_contact",
  description:
    "Ask the human user a question and wait for their response. Use when the agent needs clarification or approval to proceed.",
  parameters: HumanContactInput,
  local: true,
};

const humanContactHandler: ToolHandler = async (args, _state, options) => {
  const { question } = args as { question: string; context?: string };

  const promptFn = options?.promptFn as
    | ((question: string) => Promise<string>)
    | undefined;

  if (!promptFn) {
    throw new Error(
      "human_contact requires a promptFn in options. Provide a (question: string) => Promise<string> callback.",
    );
  }

  const human_response = await promptFn(question);

  return {
    human_response,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Register the human_contact tool in the registry.
 */
export function registerHumanContact(): void {
  registerTool(humanContactDefinition, humanContactHandler);
}
