import type { AgentState } from "../schemas.js";
import type { Middleware } from "./index.js";

/**
 * Creates a context manager middleware that trims old messages when the
 * conversation exceeds a configurable threshold.  Keeps the first message
 * (system prompt) and the most recent `keep` messages, replacing the
 * trimmed middle with a single summary placeholder.
 */
export function createContextManagerMiddleware(
  threshold: number = 20,
  keep: number = 10,
): Middleware {
  return {
    name: "context-manager",

    beforeLLM(state: AgentState): AgentState {
      const messages = state.messages;

      if (messages.length <= threshold) {
        return state;
      }

      const first = messages[0]; // system / initial message
      const tail = messages.slice(-keep);
      const trimmedCount = messages.length - 1 - keep; // excluding first and tail

      const summary = {
        role: "user",
        content: `[Context trimmed: ${trimmedCount} earlier messages removed]`,
      };

      return {
        ...state,
        messages: [first, summary, ...tail],
      };
    },
  };
}
