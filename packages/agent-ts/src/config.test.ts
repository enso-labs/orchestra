import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";
import { ZodError } from "zod";

const validEnv = {
  RUSKA_API_URL: "http://localhost:8000",
  RUSKA_API_KEY: "test-key-123",
  MODEL: "openai:gpt-4.1-mini",
  TAVILY_API_KEY: "tvly-xxx",
  LOG_LEVEL: "info",
  OUTPUT_DIR: "./output",
  MAX_ITERATIONS: "15",
};

describe("loadConfig", () => {
  it("parses a fully valid env", () => {
    const config = loadConfig(validEnv);
    expect(config.apiUrl).toBe("http://localhost:8000");
    expect(config.apiKey).toBe("test-key-123");
    expect(config.model).toBe("openai:gpt-4.1-mini");
    expect(config.tavilyApiKey).toBe("tvly-xxx");
    expect(config.logLevel).toBe("info");
    expect(config.outputDir).toBe("./output");
    expect(config.maxIterations).toBe(15);
  });

  it("throws ZodError when RUSKA_API_KEY is missing", () => {
    expect(() => loadConfig({ RUSKA_API_KEY: undefined })).toThrow(ZodError);
  });

  it("throws ZodError when RUSKA_API_KEY is empty string", () => {
    expect(() => loadConfig({ RUSKA_API_KEY: "" })).toThrow(ZodError);
  });

  it("applies default values when optional fields are missing", () => {
    const config = loadConfig({ RUSKA_API_KEY: "key" });
    expect(config.apiUrl).toBe("http://localhost:8000");
    expect(config.model).toBe("openai:gpt-4.1-mini");
    expect(config.logLevel).toBe("info");
    expect(config.outputDir).toBe("./output");
    expect(config.maxIterations).toBe(15);
    expect(config.tavilyApiKey).toBeUndefined();
  });

  it("coerces MAX_ITERATIONS from string to number", () => {
    const config = loadConfig({ ...validEnv, MAX_ITERATIONS: "25" });
    expect(config.maxIterations).toBe(25);
    expect(typeof config.maxIterations).toBe("number");
  });

  it("rejects invalid LOG_LEVEL values", () => {
    expect(() =>
      loadConfig({ ...validEnv, LOG_LEVEL: "verbose" })
    ).toThrow(ZodError);
  });

  it("accepts all valid log levels", () => {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      const config = loadConfig({ ...validEnv, LOG_LEVEL: level });
      expect(config.logLevel).toBe(level);
    }
  });

  it("rejects invalid URL for RUSKA_API_URL", () => {
    expect(() =>
      loadConfig({ ...validEnv, RUSKA_API_URL: "not-a-url" })
    ).toThrow(ZodError);
  });
});
