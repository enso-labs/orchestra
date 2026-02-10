import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolve } from "node:path";
import { rm, readFile, stat } from "node:fs/promises";
import {
  fileWriterDefinition,
  registerFileWriter,
} from "./file-writer.js";
import {
  getToolDefinitions,
  getServerToolNames,
  executeTool,
  _resetRegistry,
} from "./index.js";
import type { AgentState } from "../schemas.js";

const TEST_OUTPUT_DIR = resolve(import.meta.dirname ?? ".", "__test_output__");

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    messages: [],
    notes: [],
    sources: [],
    iteration: 0,
    ...overrides,
  };
}

describe("file_writer tool", () => {
  beforeEach(() => {
    _resetRegistry();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Clean up test output directory
    try {
      await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("fileWriterDefinition", () => {
    it("has correct name", () => {
      expect(fileWriterDefinition.name).toBe("file_writer");
    });

    it("has a description", () => {
      expect(fileWriterDefinition.description).toBeTruthy();
      expect(typeof fileWriterDefinition.description).toBe("string");
    });

    it("is marked local: true", () => {
      expect(fileWriterDefinition.local).toBe(true);
    });

    it("has a Zod parameters schema that validates FileWriterInput", () => {
      const valid = fileWriterDefinition.parameters.safeParse({
        filename: "test.txt",
        content: "hello",
      });
      expect(valid.success).toBe(true);

      const withFormat = fileWriterDefinition.parameters.safeParse({
        filename: "test.json",
        content: "{}",
        format: "json",
      });
      expect(withFormat.success).toBe(true);

      const missingFilename = fileWriterDefinition.parameters.safeParse({
        content: "hello",
      });
      expect(missingFilename.success).toBe(false);

      const emptyFilename = fileWriterDefinition.parameters.safeParse({
        filename: "",
        content: "hello",
      });
      expect(emptyFilename.success).toBe(false);
    });
  });

  describe("registerFileWriter", () => {
    it("adds file_writer to the registry", () => {
      registerFileWriter();
      const defs = getToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].name).toBe("file_writer");
      expect(defs[0].local).toBe(true);
    });

    it("file_writer does NOT appear in getServerToolNames()", () => {
      registerFileWriter();
      expect(getServerToolNames()).not.toContain("file_writer");
    });
  });

  describe("execution", () => {
    beforeEach(() => {
      registerFileWriter();
    });

    it("writes a file successfully and returns correct shape", async () => {
      const state = makeState();
      const result = (await executeTool(
        "file_writer",
        { filename: "test.txt", content: "Hello, world!" },
        state,
        { outputDir: TEST_OUTPUT_DIR },
      )) as { success: boolean; path: string; size_bytes: number };

      expect(result.success).toBe(true);
      expect(result.path).toBe(resolve(TEST_OUTPUT_DIR, "test.txt"));
      expect(result.size_bytes).toBe(Buffer.byteLength("Hello, world!", "utf-8"));

      // Verify file was actually written
      const contents = await readFile(result.path, "utf-8");
      expect(contents).toBe("Hello, world!");
    });

    it("creates directory if missing", async () => {
      const state = makeState();
      const result = (await executeTool(
        "file_writer",
        { filename: "subdir/nested/output.md", content: "# Title\nBody" },
        state,
        { outputDir: TEST_OUTPUT_DIR },
      )) as { success: boolean; path: string; size_bytes: number };

      expect(result.success).toBe(true);
      expect(result.path).toBe(
        resolve(TEST_OUTPUT_DIR, "subdir/nested/output.md"),
      );

      const contents = await readFile(result.path, "utf-8");
      expect(contents).toBe("# Title\nBody");
    });

    it("rejects path traversal with ../", async () => {
      const state = makeState();
      await expect(
        executeTool(
          "file_writer",
          { filename: "../etc/passwd", content: "malicious" },
          state,
          { outputDir: TEST_OUTPUT_DIR },
        ),
      ).rejects.toThrow("Path traversal rejected");
    });

    it("rejects path traversal with absolute path-like components", async () => {
      const state = makeState();
      await expect(
        executeTool(
          "file_writer",
          { filename: "../../outside.txt", content: "malicious" },
          state,
          { outputDir: TEST_OUTPUT_DIR },
        ),
      ).rejects.toThrow("Path traversal rejected");
    });

    it("returns correct size_bytes for multi-byte content", async () => {
      const state = makeState();
      const unicodeContent = "Hello 🌍 World";
      const result = (await executeTool(
        "file_writer",
        { filename: "unicode.txt", content: unicodeContent },
        state,
        { outputDir: TEST_OUTPUT_DIR },
      )) as { success: boolean; path: string; size_bytes: number };

      expect(result.success).toBe(true);
      expect(result.size_bytes).toBe(
        Buffer.byteLength(unicodeContent, "utf-8"),
      );
    });

    it("uses default outputDir when not provided in options", async () => {
      const state = makeState();
      const defaultDir = resolve("./output");

      const result = (await executeTool(
        "file_writer",
        { filename: "__default_test.txt", content: "hello" },
        state,
      )) as { success: boolean; path: string; size_bytes: number };

      expect(result.success).toBe(true);
      expect(result.path).toBe(resolve(defaultDir, "__default_test.txt"));

      // Clean up the file written to default output dir
      await rm(resolve(defaultDir, "__default_test.txt"), { force: true });
    });
  });
});
