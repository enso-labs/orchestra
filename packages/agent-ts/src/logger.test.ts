import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger, type LogLevel } from "./logger.js";

describe("createLogger", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  function parseLine(): Record<string, unknown> {
    const call = stderrSpy.mock.calls[0][0] as string;
    return JSON.parse(call.trimEnd());
  }

  it("outputs valid JSON to stderr", () => {
    const logger = createLogger("debug");
    logger.info("hello");

    expect(stderrSpy).toHaveBeenCalledOnce();
    const entry = parseLine();
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("level", "info");
    expect(entry).toHaveProperty("message", "hello");
  });

  it("includes ISO timestamp", () => {
    const logger = createLogger("debug");
    logger.info("test");

    const entry = parseLine();
    expect(() => new Date(entry.timestamp as string)).not.toThrow();
    expect((entry.timestamp as string)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it.each<LogLevel>(["debug", "info", "warn", "error"])(
    "outputs correctly for %s level",
    (level) => {
      const logger = createLogger("debug");
      logger[level](`${level} message`);

      expect(stderrSpy).toHaveBeenCalledOnce();
      const entry = parseLine();
      expect(entry.level).toBe(level);
      expect(entry.message).toBe(`${level} message`);
    },
  );

  it("suppresses messages below threshold", () => {
    const logger = createLogger("warn");

    logger.debug("should not appear");
    logger.info("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();

    logger.warn("should appear");
    expect(stderrSpy).toHaveBeenCalledOnce();

    logger.error("should also appear");
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it("passes through metadata", () => {
    const logger = createLogger("debug");
    logger.info("with meta", { requestId: "abc-123", duration: 42 });

    const entry = parseLine();
    expect(entry.requestId).toBe("abc-123");
    expect(entry.duration).toBe(42);
  });

  it("works without metadata", () => {
    const logger = createLogger("debug");
    logger.info("no meta");

    const entry = parseLine();
    expect(entry.message).toBe("no meta");
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining(["timestamp", "level", "message"]),
    );
  });

  it("defaults to info level", () => {
    const logger = createLogger();

    logger.debug("suppressed");
    expect(stderrSpy).not.toHaveBeenCalled();

    logger.info("visible");
    expect(stderrSpy).toHaveBeenCalledOnce();
  });

  it("outputs newline-delimited JSON", () => {
    const logger = createLogger("debug");
    logger.info("line1");
    logger.info("line2");

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    for (const call of stderrSpy.mock.calls) {
      const output = call[0] as string;
      expect(output).toMatch(/\n$/);
      expect(() => JSON.parse(output.trimEnd())).not.toThrow();
    }
  });
});
