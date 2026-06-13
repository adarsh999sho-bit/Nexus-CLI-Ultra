import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./defaults";
import { nexusConfigSchema } from "./schema";
import { findProjectConfig, getConfigDir } from "../shared/utils";
import { getLogger } from "../shared/logger";
import type { NexusConfig } from "./types";

export interface ConfigSource {
  /** Load config from nexus.json files */
  fromFile(): Partial<NexusConfig>;
  /** Load config from environment variables */
  fromEnv(): Partial<NexusConfig>;
  /** Override with CLI flags */
  fromCli(cliOverrides: Record<string, unknown>): Partial<NexusConfig>;
  /** Merge all sources */
  load(cliOverrides?: Record<string, unknown>): NexusConfig;
}

export class ConfigLoader implements ConfigSource {
  private log = getLogger();

  fromFile(): Partial<NexusConfig> {
    const paths = [
      findProjectConfig(),
      join(getConfigDir(), "config.json"),
    ].filter(Boolean) as string[];

    for (const filePath of paths) {
      try {
        if (!existsSync(filePath)) continue;
        const raw = JSON.parse(readFileSync(filePath, "utf-8"));
        const parsed = nexusConfigSchema.safeParse(raw);
        if (parsed.success) {
          this.log.debug(`Loaded config from ${filePath}`);
          return parsed.data as Partial<NexusConfig>;
        }
        this.log.warn(`Invalid config in ${filePath}: ${parsed.error.message}`);
      } catch (err) {
        this.log.warn(`Failed to load config from ${filePath}: ${err}`);
      }
    }
    return {};
  }

  fromEnv(): Partial<NexusConfig> {
    const config: Record<string, unknown> = {};
    const provider = process.env.NEXUS_DEFAULT_PROVIDER;
    const model = process.env.NEXUS_DEFAULT_MODEL;
    const dir = process.env.NEXUS_WORKING_DIR;
    const logLevel = process.env.NEXUS_LOG_LEVEL;

    if (provider) config.defaultProvider = provider;
    if (model) config.defaultModel = model;
    if (dir) config.workingDir = dir;
    if (logLevel && ["debug", "info", "warn", "error"].includes(logLevel)) {
      config.logging = { ...(config.logging as object || {}), level: logLevel };
    }

    return config as Partial<NexusConfig>;
  }

  fromCli(cliOverrides: Record<string, unknown>): Partial<NexusConfig> {
    const config: Record<string, unknown> = {};
    if (cliOverrides.provider) config.defaultProvider = cliOverrides.provider;
    if (cliOverrides.model) config.defaultModel = cliOverrides.model;
    if (cliOverrides.dir) config.workingDir = cliOverrides.dir;
    if (cliOverrides.verbose) {
      config.logging = { ...(config.logging as object || {}), verbose: true };
    }
    return config as Partial<NexusConfig>;
  }

  load(cliOverrides: Record<string, unknown> = {}): NexusConfig {
    const fileConfig = this.fromFile();
    const envConfig = this.fromEnv();
    const cliConfig = this.fromCli(cliOverrides);

    // Merge in priority order: defaults < file < env < CLI
    const merged = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      ...envConfig,
      ...cliConfig,
    } as NexusConfig;

    // Ensure storage dbPath is set
    if (!merged.storage?.dbPath) {
      const dataDir = getConfigDir();
      if (!existsSync(dataDir)) {
        try { mkdirSync(dataDir, { recursive: true }); } catch { /* ignore */ }
      }
      merged.storage = {
        ...merged.storage,
        dbPath: join(dataDir, "nexus.db"),
      };
    }

    return merged;
  }
}

/** Singleton config instance */
let _config: NexusConfig | null = null;
let _loader: ConfigLoader | null = null;

export function getConfig(cliOverrides?: Record<string, unknown>): NexusConfig {
  if (!_config || cliOverrides) {
    _loader ||= new ConfigLoader();
    _config = _loader.load(cliOverrides);
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
