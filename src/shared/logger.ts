export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.Debug]: "debug",
  [LogLevel.Info]: "info",
  [LogLevel.Warn]: "warn",
  [LogLevel.Error]: "error",
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.Debug]: "\x1b[90m",
  [LogLevel.Info]: "\x1b[36m",
  [LogLevel.Warn]: "\x1b[33m",
  [LogLevel.Error]: "\x1b[31m",
};

const RESET = "\x1b[0m";

export interface LoggerOptions {
  level?: LogLevel;
  filePath?: string;
  verbose?: boolean;
}

export class Logger {
  private level: LogLevel;
  private filePath?: string;
  private verbose: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.Info;
    this.filePath = options.filePath;
    this.verbose = options.verbose ?? false;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelName = LEVEL_NAMES[level].toUpperCase().padEnd(5);
    const color = LEVEL_COLORS[level];
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `${color}[${timestamp}] [${levelName}] ${message}${dataStr}${RESET}`;
  }

  private writeToFile(line: string): void {
    if (!this.filePath) return;
    try {
      const file = Bun.file(this.filePath);
      const writer = file.writer();
      writer.write(line + "\n");
      writer.end();
    } catch {
      // Silently fail
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return;
    const formatted = this.formatMessage(level, message, data);

    switch (level) {
      case LogLevel.Error:
        console.error(formatted);
        break;
      case LogLevel.Warn:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }

    if (this.filePath) {
      this.writeToFile(formatted);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.Debug, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.Info, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.Warn, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.Error, message, data);
  }

  child(context: Record<string, unknown>): Logger {
    const child = new Logger({
      level: this.level,
      filePath: this.filePath,
      verbose: this.verbose,
    });
    const originalLog = child.log.bind(child);
    // Replace log method with one that adds context
    Object.defineProperty(child, "log", {
      value: (level: LogLevel, message: string, data?: unknown) => {
        originalLog(level, message, { ...context, ...(data as object || {}) });
      },
    });
    return child;
  }
}

/** Global logger instance */
let _logger: Logger | null = null;

export function setLogger(logger: Logger): void {
  _logger = logger;
}

export function getLogger(): Logger {
  if (!_logger) {
    _logger = new Logger();
  }
  return _logger;
}
