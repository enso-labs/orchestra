import type { Middleware } from "./index.js";

export const errorHandlerMiddleware: Middleware = {
  name: "error-handler",
  afterTool(_toolName: string, result: unknown, error?: Error): unknown {
    if (error) {
      return JSON.stringify({
        error: true,
        message: error.message,
        tool: _toolName,
        suggestion: `The tool "${_toolName}" failed. Try a different approach or adjust the input parameters.`,
      });
    }
    return result;
  },
};
