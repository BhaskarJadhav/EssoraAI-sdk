export type LoggerLevel = "silent" | "error" | "warn" | "info" | "debug";

const levelOrder: Record<LoggerLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

export class Logger {
  constructor(
    private readonly namespace: string,
    private readonly level: LoggerLevel = "warn"
  ) {}

  error(message: string, ...details: unknown[]): void {
    this.write("error", message, details);
  }

  warn(message: string, ...details: unknown[]): void {
    this.write("warn", message, details);
  }

  info(message: string, ...details: unknown[]): void {
    this.write("info", message, details);
  }

  debug(message: string, ...details: unknown[]): void {
    this.write("debug", message, details);
  }

  private write(level: Exclude<LoggerLevel, "silent">, message: string, details: unknown[]): void {
    if (levelOrder[this.level] < levelOrder[level]) {
      return;
    }

    console[level](`[${this.namespace}] ${message}`, ...details);
  }
}
