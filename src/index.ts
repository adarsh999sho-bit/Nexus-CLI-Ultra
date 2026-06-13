#!/usr/bin/env bun
/**
 * Nexus CLI Ultra — Entry Point
 *
 * An open-source, multi-model AI engineering CLI with context engineering,
 * autonomous multi-agent workflows, and free model support.
 */

import { getConfig } from "./config/loader";
import { getLogger, setLogger, Logger } from "./shared/logger";
import { getDatabase, closeDatabase } from "./storage/sqlite";
import { getSessionManager } from "./storage/session";
import { handleError } from "./shared/errors";
import { getSystemInfo } from "./shared/utils";
import { createProgram } from "./cli/program";
import { registerDefaultProviders, initializeProviders, getRegistry } from "./llm";

/** Initialize Nexus runtime with CLI overrides */
async function initialize(cliOverrides: Record<string, unknown> = {}): Promise<void> {
  // Initialize logger
  const logger = new Logger({
    level: process.env.NEXUS_LOG_LEVEL === "debug" ? 0
      : process.env.NEXUS_LOG_LEVEL === "warn" ? 2
      : process.env.NEXUS_LOG_LEVEL === "error" ? 3
      : 1,
    verbose: process.env.NEXUS_VERBOSE === "true",
  });
  setLogger(logger);

  // Load configuration (with CLI overrides applied)
  const config = getConfig(cliOverrides);

  // Update logger from config
  if (config.logging?.level) {
    const levelMap: Record<string, 0 | 1 | 2 | 3> = {
      debug: 0, info: 1, warn: 2, error: 3,
    };
    setLogger(new Logger({
      level: levelMap[config.logging.level] ?? 1,
      filePath: config.logging.filePath,
      verbose: config.logging.verbose,
    }));
  }

  // Initialize database
  if (config.storage?.dbPath) {
    try {
      getDatabase(config.storage.dbPath);
      logger.debug("Database initialized");
    } catch (err) {
      logger.warn("Failed to initialize database", { error: String(err) });
    }
  }

  // Create initial session
  try {
    const sessions = getSessionManager();
    const active = sessions.getActive();
    if (!active) {
      sessions.create("Default Session");
      logger.debug("Created default session");
    }
  } catch (err) {
    logger.warn("Failed to create session", { error: String(err) });
  }

  // 🔌 Initialize provider layer
  try {
    registerDefaultProviders(config.providers || {});
    await initializeProviders();
    logger.info(`Providers initialized: ${getRegistry().count} available`);
  } catch (err) {
    logger.warn("Failed to initialize some providers", { error: String(err) });
  }

  logger.info("Nexus CLI Ultra initialized", { systemInfo: getSystemInfo() });
}

/** Shutdown Nexus gracefully */
async function shutdown(): Promise<void> {
  const logger = getLogger();
  logger.info("Shutting down Nexus CLI Ultra...");
  closeDatabase();
}

/** Handle uncaught errors */
function handleFatalError(error: unknown): void {
  const { message, exitCode } = handleError(error);
  const logger = getLogger();
  logger.error(`FATAL: ${message}`);
  console.error(`FATAL: ${message}`);
  process.exit(exitCode);
}

/** Main entry */
async function main(): Promise<void> {
  // Handle signals
  process.on("SIGINT", async () => {
    console.log("\n");
    await shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });

  process.on("uncaughtException", handleFatalError);
  process.on("unhandledRejection", handleFatalError);

  try {
    const program = createProgram();

    // Extract CLI flags manually to initialize config before full parse
    const rawArgs = process.argv.slice(2);
    const cliOverrides: Record<string, unknown> = {};
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg === '--provider' || arg === '-p') {
        cliOverrides.provider = rawArgs[++i];
      } else if (arg === '--model' || arg === '-m') {
        cliOverrides.model = rawArgs[++i];
      } else if (arg === '--dir' || arg === '-d') {
        cliOverrides.workingDir = rawArgs[++i];
      } else if (arg === '--verbose' || arg === '-v') {
        cliOverrides.verbose = true;
      }
    }

    // Initialize with CLI overrides applied to config
    await initialize(cliOverrides);

    // Execute the CLI (full parse with subcommands)
    await program.parseAsync(process.argv);
    await shutdown();
  } catch (error) {
    handleFatalError(error);
  }
}

main();
