import type { Logger } from "../logger.js";
import type { AgentState } from "../schemas.js";
import type { StreamEvent } from "../stream-client.js";
import type { Middleware } from "./index.js";

export function createObservabilityMiddleware(logger: Logger): Middleware {
  let llmStartTime: number;
  let toolStartTimes: Map<string, number> = new Map();

  return {
    name: "observability",

    beforeLLM(state: AgentState): AgentState {
      llmStartTime = Date.now();
      logger.info("LLM call starting", {
        iteration: state.iteration,
        messageCount: state.messages.length,
      });
      return state;
    },

    afterLLM(_state: AgentState, events: StreamEvent[]): void {
      const durationMs = Date.now() - llmStartTime;
      const estimatedTokens = events.reduce((sum, e) => {
        if (e.type === "messages") {
          return sum + JSON.stringify(e.data).length;
        }
        return sum;
      }, 0);

      logger.info("LLM call completed", {
        durationMs,
        eventCount: events.length,
        estimatedTokens,
      });
    },

    beforeTool(toolName: string, args: unknown): unknown {
      toolStartTimes.set(toolName, Date.now());
      logger.debug("Tool executing", {
        tool: toolName,
        args: summarizeArgs(args),
      });
      return args;
    },

    afterTool(toolName: string, result: unknown, error?: Error): unknown {
      const startTime = toolStartTimes.get(toolName);
      const durationMs = startTime ? Date.now() - startTime : undefined;
      toolStartTimes.delete(toolName);

      if (error) {
        logger.warn("Tool failed", {
          tool: toolName,
          durationMs,
          error: error.message,
        });
      } else {
        logger.debug("Tool succeeded", {
          tool: toolName,
          durationMs,
        });
      }

      return result;
    },
  };
}

function summarizeArgs(args: unknown): string {
  const str = JSON.stringify(args);
  if (str.length > 200) {
    return str.slice(0, 200) + "...";
  }
  return str;
}
