import { describe, expect, it } from "vitest";
import { errorHandlerMiddleware } from "./error-handler.js";

describe("errorHandlerMiddleware", () => {
  it("has name 'error-handler'", () => {
    expect(errorHandlerMiddleware.name).toBe("error-handler");
  });

  it("defines afterTool hook", () => {
    expect(errorHandlerMiddleware.afterTool).toBeTypeOf("function");
  });

  it("does not define beforeLLM, afterLLM, or beforeTool hooks", () => {
    expect(errorHandlerMiddleware.beforeLLM).toBeUndefined();
    expect(errorHandlerMiddleware.afterLLM).toBeUndefined();
    expect(errorHandlerMiddleware.beforeTool).toBeUndefined();
  });

  describe("afterTool", () => {
    it("passes result through unchanged when no error", () => {
      const result = { success: true, data: "hello" };
      const output = errorHandlerMiddleware.afterTool!(
        "test_tool",
        result,
        undefined,
      );
      expect(output).toBe(result);
    });

    it("returns error JSON string when error is present", () => {
      const error = new Error("File not found");
      const output = errorHandlerMiddleware.afterTool!(
        "file_writer",
        null,
        error,
      );

      const parsed = JSON.parse(output as string);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("File not found");
      expect(parsed.tool).toBe("file_writer");
      expect(parsed.suggestion).toContain("file_writer");
    });

    it("includes tool name in error output", () => {
      const error = new Error("timeout");
      const output = errorHandlerMiddleware.afterTool!(
        "web_search",
        undefined,
        error,
      );

      const parsed = JSON.parse(output as string);
      expect(parsed.tool).toBe("web_search");
      expect(parsed.suggestion).toContain("web_search");
    });

    it("returns valid JSON string for errors", () => {
      const error = new Error("something broke");
      const output = errorHandlerMiddleware.afterTool!(
        "note_taker",
        null,
        error,
      );

      expect(typeof output).toBe("string");
      expect(() => JSON.parse(output as string)).not.toThrow();
    });

    it("preserves original result object reference when no error", () => {
      const result = { nested: { value: 42 } };
      const output = errorHandlerMiddleware.afterTool!(
        "test_tool",
        result,
        undefined,
      );
      expect(output).toBe(result); // same reference
    });

    it("handles error with special characters in message", () => {
      const error = new Error('path "../etc/passwd" is not allowed');
      const output = errorHandlerMiddleware.afterTool!(
        "file_writer",
        null,
        error,
      );

      const parsed = JSON.parse(output as string);
      expect(parsed.message).toBe('path "../etc/passwd" is not allowed');
    });
  });
});
