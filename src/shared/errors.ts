export class NexusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "NexusError";
  }
}

export class ConfigError extends NexusError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", 1);
    this.name = "ConfigError";
  }
}

export class ProviderError extends NexusError {
  constructor(message: string, public readonly provider: string) {
    super(message, "PROVIDER_ERROR", 1);
    this.name = "ProviderError";
  }
}

export class ToolExecutionError extends NexusError {
  constructor(message: string, public readonly toolName: string) {
    super(message, "TOOL_ERROR", 1);
    this.name = "ToolExecutionError";
  }
}

export class SessionError extends NexusError {
  constructor(message: string) {
    super(message, "SESSION_ERROR", 1);
    this.name = "SessionError";
  }
}

export function handleError(error: unknown): { message: string; exitCode: number } {
  if (error instanceof NexusError) {
    return { message: error.message, exitCode: error.exitCode };
  }
  if (error instanceof Error) {
    return { message: error.message, exitCode: 1 };
  }
  return { message: String(error), exitCode: 1 };
}
