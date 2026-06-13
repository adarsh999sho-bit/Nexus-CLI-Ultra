/** Message in a chat conversation */
export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Options for a non-streaming completion */
export interface CompleteOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  signal?: AbortSignal;
}

/** Options for a streaming completion */
export interface StreamOptions extends CompleteOptions {
  onToken?: (token: string) => void;
}

/** A chunk received during streaming */
export interface StreamChunk {
  type: "text" | "done" | "error";
  content?: string;
  error?: string;
  usage?: TokenUsage;
}

/** Token usage information */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/** A complete LLM response */
export interface LlmResponse {
  content: string;
  usage?: TokenUsage;
  model: string;
}

/** Model capability flags */
export interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxContextWindow: number;
  maxOutputTokens: number;
  supportsSystemPrompt: boolean;
}

/** Model information */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapabilities;
  isFree: boolean;
  pricing?: {
    inputPer1k: number;  // in cents
    outputPer1k: number; // in cents
  };
}

/** Provider health status */
export interface ProviderHealth {
  available: boolean;
  latencyMs?: number;
  lastError?: string;
  lastChecked: Date;
}

/** Configuration for a provider instance */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
  rateLimitRpm?: number;  // requests per minute
}

/** The unified LLM provider interface */
export interface LlmProvider {
  /** Provider name */
  readonly name: string;

  /** Initialize the provider (check API key, test connection) */
  initialize(): Promise<void>;

  /** Non-streaming completion */
  complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse>;

  /** Streaming completion (async generator) */
  stream(
    messages: LlmMessage[],
    model?: string,
    options?: StreamOptions,
  ): AsyncGenerator<StreamChunk>;

  /** List available models */
  listModels(): Promise<ModelInfo[]>;

  /** Get provider health status */
  health(): Promise<ProviderHealth>;

  /** Count tokens in a string (approximate) */
  countTokens(text: string): number;

  /** Check if this provider is available (has API key, can connect) */
  isAvailable(): boolean;
}
