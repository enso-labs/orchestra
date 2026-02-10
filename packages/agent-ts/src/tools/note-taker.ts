import { NoteTakerInput } from "../schemas.js";
import { registerTool } from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// --- note_taker: local tool ---

export const noteTakerDefinition: ToolDefinition = {
  name: "note_taker",
  description:
    "Add a research note to the agent's internal state. Notes accumulate across turns and are used during synthesis.",
  parameters: NoteTakerInput,
  local: true,
};

const noteTakerHandler: ToolHandler = async (args, state) => {
  const { note, category, source } = args as {
    note: string;
    category?: string;
    source?: string;
  };

  const resolvedCategory = category || "general";

  state.notes.push({
    note,
    category: resolvedCategory,
    source,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    note_count: state.notes.length,
    category: resolvedCategory,
  };
};

/**
 * Register the note_taker tool in the registry.
 */
export function registerNoteTaker(): void {
  registerTool(noteTakerDefinition, noteTakerHandler);
}
