import type { NexusConfig } from "./types";

export const DEFAULT_THEME = {
  name: "nexus-dark",
  primary: "#00d4ff",
  secondary: "#7c3aed",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  muted: "#6b7280",
  background: "#0f172a",
  foreground: "#e2e8f0",
};

export const DEFAULT_PROVIDERS = {
  deepseek: {
    enabled: true,
    priority: 10,
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-v4-flash-free",
  },
  gemini: {
    enabled: true,
    priority: 20,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
  },
  qwen: {
    enabled: true,
    priority: 30,
    baseUrl: "https://api.qwen.ai/v1",
    defaultModel: "qwen-3-free",
  },
  groq: {
    enabled: true,
    priority: 40,
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  mistral: {
    enabled: true,
    priority: 50,
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
  },
  openrouter: {
    enabled: true,
    priority: 60,
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "auto",
  },
  ollama: {
    enabled: true,
    priority: 0,
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "codellama",
  },
  anthropic: {
    enabled: false,
    priority: 70,
    defaultModel: "claude-sonnet-4-20250514",
  },
  openai: {
    enabled: false,
    priority: 80,
    defaultModel: "gpt-4o",
  },
};

export const DEFAULT_ROUTING = [
  {
    taskType: "format",
    preferredProviders: ["ollama", "groq"],
    fallbackProviders: [],
    maxCostCents: 0,
  },
  {
    taskType: "explain",
    preferredProviders: ["deepseek", "qwen"],
    fallbackProviders: ["gemini"],
    maxCostCents: 0,
  },
  {
    taskType: "debug",
    preferredProviders: ["gemini", "deepseek"],
    fallbackProviders: ["openrouter"],
    maxCostCents: 0,
  },
  {
    taskType: "code-gen",
    preferredProviders: ["deepseek", "qwen"],
    fallbackProviders: ["gemini", "openrouter"],
    maxCostCents: 0,
  },
  {
    taskType: "code-review",
    preferredProviders: ["gemini", "deepseek"],
    fallbackProviders: ["openrouter"],
    maxCostCents: 1,
  },
  {
    taskType: "architect",
    preferredProviders: ["gemini", "openrouter"],
    fallbackProviders: ["anthropic"],
    maxCostCents: 5,
  },
  {
    taskType: "security",
    preferredProviders: ["gemini", "openrouter"],
    fallbackProviders: ["anthropic"],
    maxCostCents: 5,
  },
  {
    taskType: "plan",
    preferredProviders: ["deepseek", "gemini"],
    fallbackProviders: ["openrouter"],
    maxCostCents: 2,
  },
  {
    taskType: "refactor",
    preferredProviders: ["deepseek", "qwen"],
    fallbackProviders: ["gemini"],
    maxCostCents: 0,
  },
  {
    taskType: "test",
    preferredProviders: ["deepseek", "qwen"],
    fallbackProviders: ["gemini"],
    maxCostCents: 0,
  },
  {
    taskType: "docs",
    preferredProviders: ["qwen", "deepseek"],
    fallbackProviders: ["gemini"],
    maxCostCents: 0,
  },
  {
    taskType: "research",
    preferredProviders: ["gemini", "openrouter"],
    fallbackProviders: ["deepseek"],
    maxCostCents: 2,
  },
] as const;

export const DEFAULT_CONFIG: NexusConfig = {
  version: "1.0.0",
  defaultProvider: "deepseek",
  defaultModel: "deepseek-v4-flash-free",
  workingDir: ".",
  theme: DEFAULT_THEME,
  providers: DEFAULT_PROVIDERS as unknown as NexusConfig["providers"],
  agent: {
    autoMode: false,
    maxIterations: 10,
    requireApproval: true,
  },
  routing: DEFAULT_ROUTING as unknown as NexusConfig["routing"],
  storage: {
    dbPath: "",
    maxSessions: 50,
    autoSave: true,
  },
  logging: {
    level: "info",
    filePath: undefined,
    verbose: false,
  },
  plugins: {
    enabled: true,
    paths: [],
  },
};
