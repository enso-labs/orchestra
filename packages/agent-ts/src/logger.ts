export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel = "info"): Logger {
  const threshold = LEVEL_ORDER[level];

  function log(
    logLevel: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[logLevel] < threshold) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
      ...metadata,
    };

    process.stderr.write(JSON.stringify(entry) + "\n");
  }

  return {
    debug: (message, metadata?) => log("debug", message, metadata),
    info: (message, metadata?) => log("info", message, metadata),
    warn: (message, metadata?) => log("warn", message, metadata),
    error: (message, metadata?) => log("error", message, metadata),
  };
}
