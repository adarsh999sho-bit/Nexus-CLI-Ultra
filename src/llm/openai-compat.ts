import type {
  LlmProvider,
  LlmMessage,
  LlmResponse,
  CompleteOptions,
  StreamOptions,
  StreamChunk,
  ModelInfo,
  ProviderHealth,
  ProviderConfig as ProviderCfg,
} from "./types";

interface OpenAiChatMessage {
  role: string;
  content: string;
}

interface OpenAiChoice {
  message: OpenAiChatMessage;
  finish_reason: string;
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAiResponse {
  id: string;
  model: string;
  choices: OpenAiChoice[];
  usage?: OpenAiUsage;
}

interface OpenAiStreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  usage?: OpenAiUsage;
}

interface OpenAiModel {
  id: string;
  created: number;
  owned_by: string;
}

export class OpenAiCompatProvider implements LlmProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private maxRetries: number;
  private timeoutMs: number;
  private available = false;
  private modelsCache: ModelInfo[] = [];

  constructor(
    name: string,
    config: ProviderCfg,
  ) {
    this.name = name;
    this.apiKey = config.apiKey || "";
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async initialize(): Promise<void> {
    this.available = !!this.apiKey;
    if (!this.apiKey) {
      // Try environment variable
      const envKey = `NEXUS_${this.name.toUpperCase()}_API_KEY`;
      this.apiKey = process.env[envKey] || process.env.OPENAI_API_KEY || "";
      this.available = !!this.apiKey;
    }
    if (this.apiKey) {
      try {
        await this.health();
      } catch {
        this.available = false;
      }
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private convertMessages(messages: LlmMessage[]): OpenAiChatMessage[] {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async complete(
    messages: LlmMessage[],
    model?: string,
    options?: CompleteOptions,
  ): Promise<LlmResponse> {
    const body = {
      model: model || this.defaultModel,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stop,
      stream: false,
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout("/chat/completions", body, options?.signal);
        const data = (await response.json()) as OpenAiResponse;
        return {
          content: data.choices[0]?.message?.content || "",
          usage: data.usage
            ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens, total: data.usage.total_tokens }
            : undefined,
          model: data.model,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (this.isRetryable(lastError) && attempt < this.maxRetries) {
          await this.delay(1000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  }

  async *stream(
    messages: LlmMessage[],
    model?: string,
    options?: StreamOptions,
  ): AsyncGenerator<StreamChunk> {
    const body = {
      model: model || this.defaultModel,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stop,
      stream: true,
    };

    try {
      const response = await this.fetchWithTimeout("/chat/completions", body, options?.signal);
      if (!response.body) {
        yield { type: "error", error: "No response body" };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }
          try {
            const chunk = JSON.parse(data) as OpenAiStreamChunk;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              yield { type: "text", content };
              options?.onToken?.(content);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
      yield { type: "done" };
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.modelsCache.length > 0) return this.modelsCache;

    try {
      const response = await this.fetchWithTimeout("/models");
      const data = (await response.json()) as { data: OpenAiModel[] };
      this.modelsCache = data.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: this.name,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: m.id.includes("vision") || m.id.includes("turbo"),
          maxContextWindow: 128_000,
          maxOutputTokens: 4096,
          supportsSystemPrompt: true,
        },
        isFree: m.id.includes("free"),
      }));
      return this.modelsCache;
    } catch {
      return this.modelsCache;
    }
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await this.fetchWithTimeout("/models");
      this.available = response.ok;
      return {
        available: response.ok,
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
      };
    } catch (err) {
      this.available = false;
      return {
        available: false,
        lastError: String(err),
        lastChecked: new Date(),
      };
    }
  }

  countTokens(text: string): number {
    // Approximate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  private async fetchWithTimeout(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: signal || controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message;
    return (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("rate limit") ||
      msg.includes("timeout") ||
      msg.includes("abort")
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
