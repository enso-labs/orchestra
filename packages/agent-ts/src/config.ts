import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const LogLevel = z.enum(["debug", "info", "warn", "error"]);

const ConfigSchema = z.object({
  apiUrl: z.string().url().default("http://localhost:8000"),
  apiKey: z.string().min(1, "RUSKA_API_KEY is required"),
  model: z.string().default("openai:gpt-4.1-mini"),
  tavilyApiKey: z.string().optional(),
  logLevel: LogLevel.default("info"),
  outputDir: z.string().default("./output"),
  maxIterations: z.coerce.number().int().positive().default(15),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return ConfigSchema.parse({
    apiUrl: env.RUSKA_API_URL,
    apiKey: env.RUSKA_API_KEY,
    model: env.MODEL,
    tavilyApiKey: env.TAVILY_API_KEY,
    logLevel: env.LOG_LEVEL,
    outputDir: env.OUTPUT_DIR,
    maxIterations: env.MAX_ITERATIONS,
  });
}
