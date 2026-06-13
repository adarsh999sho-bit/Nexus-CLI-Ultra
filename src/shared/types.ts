/** Role of a message in a conversation */
export enum Role {
  User = "user",
  Assistant = "assistant",
  System = "system",
}

/** A single message in a conversation */
export interface Message {
  role: Role;
  content: string;
}

/** Content block types for structured messages */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError: boolean };

/** A conversation session */
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/** LLM provider types */
export type ProviderType =
  | "openai-compat"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "openrouter"
  | "huggingface";

/** Model capability classification */
export type TaskType =
  | "code-gen"
  | "code-review"
  | "debug"
  | "explain"
  | "refactor"
  | "format"
  | "architect"
  | "security"
  | "test"
  | "docs"
  | "plan"
  | "research";

/** Model tier for cost-aware routing */
export type ModelTier = "free" | "low-cost" | "premium";

/** A model variant offered by a provider */
export interface ModelVariant {
  id: string;
  name: string;
  provider: ProviderType;
  tier: ModelTier;
  contextWindow: number;
  strengths: TaskType[];
  isFree: boolean;
}

/** Tool execution result */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/** Theme definition */
export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  background: string;
  foreground: string;
}

/** Command execution mode */
export type ExecutionMode = "interactive" | "direct" | "autonomous";

/** Agent action for audit trail */
export interface AuditAction {
  timestamp: Date;
  agent: string;
  action: string;
  tool: string;
  input: unknown;
  result: unknown;
  success: boolean;
}
