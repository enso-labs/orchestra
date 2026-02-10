import { resolve } from "node:path";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { FileWriterInput } from "../schemas.js";
import { registerTool } from "./index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// --- file_writer: local tool ---

export const fileWriterDefinition: ToolDefinition = {
  name: "file_writer",
  description:
    "Write content to a file in the configured output directory. Supports text, JSON, and markdown formats.",
  parameters: FileWriterInput,
  local: true,
};

const fileWriterHandler: ToolHandler = async (args, _state, options) => {
  const { filename, content } = args as {
    filename: string;
    content: string;
    format?: string;
  };

  const outputDir = (options?.outputDir as string) || "./output";
  const resolvedDir = resolve(outputDir);
  const resolvedPath = resolve(resolvedDir, filename);

  // Path traversal protection: resolved path must start with resolved outputDir
  if (!resolvedPath.startsWith(resolvedDir + "/") && resolvedPath !== resolvedDir) {
    throw new Error(
      `Path traversal rejected: "${filename}" resolves outside the output directory`,
    );
  }

  // Create directory if missing
  const parentDir = resolvedPath.substring(0, resolvedPath.lastIndexOf("/"));
  await mkdir(parentDir, { recursive: true });

  // Write file
  await writeFile(resolvedPath, content, "utf-8");

  // Get file size
  const stats = await stat(resolvedPath);

  return {
    success: true,
    path: resolvedPath,
    size_bytes: stats.size,
  };
};

/**
 * Register the file_writer tool in the registry.
 */
export function registerFileWriter(): void {
  registerTool(fileWriterDefinition, fileWriterHandler);
}
