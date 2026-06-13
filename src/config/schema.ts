import { z } from "zod";

const themeSchema = z.object({
  name: z.string(),
  primary: z.string(),
  secondary: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
  info: z.string(),
  muted: z.string(),
  background: z.string(),
  foreground: z.string(),
});

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
});

const agentConfigSchema = z.object({
  autoMode: z.boolean().default(false),
  maxIterations: z.number().int().min(1).max(100).default(10),
  requireApproval: z.boolean().default(true),
});

const taskTypeSchema = z.union([
  z.literal("code-gen"),
  z.literal("code-review"),
  z.literal("debug"),
  z.literal("explain"),
  z.literal("refactor"),
  z.literal("format"),
  z.literal("architect"),
  z.literal("security"),
  z.literal("test"),
  z.literal("docs"),
  z.literal("plan"),
  z.literal("research"),
]);

const logLevelSchema = z.union([
  z.literal("debug"),
  z.literal("info"),
  z.literal("warn"),
  z.literal("error"),
]);

const routingRuleSchema = z.object({
  taskType: taskTypeSchema,
  preferredProviders: z.array(z.string()),
  fallbackProviders: z.array(z.string()).default([]),
  maxCostCents: z.number().int().min(0).default(0),
});

export const nexusConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  defaultProvider: z.string().default("deepseek"),
  defaultModel: z.string().default("deepseek-v4-flash-free"),
  workingDir: z.string().default("."),
  theme: themeSchema.optional(),
  providers: z.record(providerConfigSchema).optional(),
  agent: agentConfigSchema.optional(),
  routing: z.array(routingRuleSchema).optional(),
  storage: z.object({
    dbPath: z.string().optional(),
    maxSessions: z.number().int().min(1).max(1000).default(50),
    autoSave: z.boolean().default(true),
  }).optional(),
  logging: z.object({
    level: logLevelSchema.default("info"),
    filePath: z.string().optional(),
    verbose: z.boolean().default(false),
  }).optional(),
  plugins: z.object({
    enabled: z.boolean().default(true),
    paths: z.array(z.string()).default([]),
  }).optional(),
});

export type ValidatedConfig = z.infer<typeof nexusConfigSchema>;
