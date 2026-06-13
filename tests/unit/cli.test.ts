import { describe, it, expect } from "bun:test";
import { createProgram } from "../../src/cli/program";

describe("Nexus CLI", () => {
  it("should create a program with name 'nexus'", () => {
    const program = createProgram();
    expect(program.name()).toBe("nexus");
  });

  it("should have a version", () => {
    const program = createProgram();
    expect(program.version()).toBeTruthy();
  });

  it("should have global options", () => {
    const program = createProgram();
    const opts = program.options;
    const names = opts.map((o) => o.name());
    expect(names).toContain("provider");
    expect(names).toContain("model");
    expect(names).toContain("dir");
    expect(names).toContain("verbose");
    expect(names).toContain("config");
  });

  it("should register all expected commands", () => {
    const program = createProgram();
    const commands = program.commands.map((c) => c.name());
    const expected = [
      "ask", "plan", "code", "architect", "review", "explain",
      "debug", "repair", "test", "docs", "refactor", "commit",
      "solve", "search", "graph", "security", "memory", "context",
      "config", "init", "doctor", "upgrade", "status",
    ];
    for (const cmd of expected) {
      expect(commands).toContain(cmd);
    }
  });
});

describe("Config System", () => {
  it("should have default config values", async () => {
    const { DEFAULT_CONFIG } = await import("../../src/config/defaults");
    expect(DEFAULT_CONFIG.version).toBe("1.0.0");
    expect(DEFAULT_CONFIG.defaultProvider).toBe("deepseek");
    expect(DEFAULT_CONFIG.defaultModel).toBe("deepseek-v4-flash-free");
  });

  it("should have providers configured", async () => {
    const { DEFAULT_CONFIG } = await import("../../src/config/defaults");
    expect(DEFAULT_CONFIG.providers).toBeDefined();
    expect(Object.keys(DEFAULT_CONFIG.providers).length).toBeGreaterThan(0);
  });
});

describe("Logger", () => {
  it("should create logger with default level", async () => {
    const { Logger, LogLevel } = await import("../../src/shared/logger");
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it("should create child logger", async () => {
    const { Logger } = await import("../../src/shared/logger");
    const logger = new Logger();
    const child = logger.child({ module: "test" });
    expect(child).toBeDefined();
  });
});

describe("Utils", () => {
  it("should get config directory", async () => {
    const { getConfigDir } = await import("../../src/shared/utils");
    const dir = getConfigDir();
    expect(dir).toContain("nexus");
  });

  it("should format timestamps", async () => {
    const { formatTimestamp } = await import("../../src/shared/utils");
    const formatted = formatTimestamp(new Date("2026-01-15"));
    expect(formatted).toBeTruthy();
  });
});

describe("Theme", () => {
  it("should have default theme", async () => {
    const { getTheme } = await import("../../src/tui/Theme");
    const theme = getTheme("nexus-dark");
    expect(theme.name).toBe("nexus-dark");
    expect(theme.primary).toBeTruthy();
  });

  it("should fall back to default for unknown themes", async () => {
    const { getTheme } = await import("../../src/tui/Theme");
    const theme = getTheme("nonexistent");
    expect(theme.name).toBe("nexus-dark");
  });
});
