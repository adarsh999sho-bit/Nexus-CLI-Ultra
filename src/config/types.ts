import type { ProviderType, TaskType, Theme } from "../shared/types";

/** Agent-specific configuration */
export interface AgentConfig {
  /** Whether autonomous mode is enabled */
  autoMode: boolean;
  /** Max iterations per task */
  maxIterations: number;
  /** Whether to require human approval for destructive actions */
  requireApproval: boolean;
}

/** Model routing rules */
export interface RoutingRule {
  taskType: TaskType;
  preferredProviders: ProviderType[];
  fallbackProviders: ProviderType[];
  /** Maximum cost per task in cents (0 = unlimited) */
  maxCostCents: number;
}

/** Provider-specific configuration */
export interface ProviderConfig {
  /** API key (can also be set via env var) */
  apiKey?: string;
  /** Base URL override */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Priority order (lower = tried first) */
  priority: number;
}

/** Complete Nexus configuration */
export interface NexusConfig {
  /** Config version */
  version: string;
  /** Default provider */
  defaultProvider: string;
  /** Default model */
  defaultModel: string;
  /** Working directory */
  workingDir: string;
  /** Theme configuration */
  theme: Theme;
  /** Provider configurations */
  providers: Record<string, ProviderConfig>;
  /** Agent settings */
  agent: AgentConfig;
  /** Model routing rules */
  routing: RoutingRule[];
  /** Storage settings */
  storage: {
    /** Path to SQLite database */
    dbPath: string;
    /** Max sessions to keep */
    maxSessions: number;
    /** Whether to auto-save sessions */
    autoSave: boolean;
  };
  /** Logging settings */
  logging: {
    level: "debug" | "info" | "warn" | "error";
    filePath?: string;
    verbose: boolean;
  };
  /** Plugin settings */
  plugins: {
    enabled: boolean;
    paths: string[];
  };
}
